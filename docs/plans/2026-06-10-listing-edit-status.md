# Listing Edit + Status + Delete — Plan

> subagent-driven. Groups: A (backend: enum + core + endpoints), B (console: api client + edit modal + status + delete).

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Test DB :5433. Reuse: `agencyScope`/`bodyLimit`/`getProperty`/`isUuid` (app.ts), `createProperty`/`publishProperty`/`listAgencyProperties` (listings.ts), `inquiries` table (FK on propertyId), console `agency.tsx` add-listing form + `Property`/`CreateListingInput` (api.ts).

## Task 1 — status enum + core update/status/delete (TDD)
- `schema.ts`: `propertyStatusEnum` → `["draft","published","rented","sold"]`. Generate migration; the change should emit additive `ALTER TYPE ... ADD VALUE` for `rented`,`sold` (NOT a destructive swap — verify the SQL; hand-fix to two `ADD VALUE IF NOT EXISTS` if needed). Apply to test DB; `generate` clean.
- `listings.ts`:
  - `PropertyStatus = NonNullable<Property["status"]>` (or the enum union).
  - `updateProperty(db, id, patch: { name?; address?; city?; priceMinor?; currency?; bedrooms?|null; bathrooms?|null; areaM2?|null; type?; dealType? })` — build a whitelisted `set` object (only defined keys), `db.update(properties).set(safe).where(eq(id)).returning()`. NEVER set agencyId/slug/status/sourceId/photos.
  - `setPropertyStatus(db, id, status)` — `if (!["draft","published","rented","sold"].includes(status)) throw new Error("invalid status")`; update + returning.
  - `deleteProperty(db, id)` — `await db.update(inquiries).set({ propertyId: null }).where(eq(inquiries.propertyId, id)); await db.delete(properties).where(eq(properties.id, id));` (import `inquiries`).
- Tests (`listings.test.ts`): updateProperty changes name/price/bedrooms but ignores an attempted agencyId/status in the patch (call with only whitelisted keys — assert agencyId unchanged); setPropertyStatus("rented") works, setPropertyStatus("junk") throws; deleteProperty with an inquiry referencing it → inquiry.propertyId becomes null and the property is gone.
- Commit `feat(core): updateProperty + setPropertyStatus(+rented/sold) + deleteProperty`.

## Task 2 — listing mutation endpoints (TDD, web)
- `app.ts`: helper `async function ownedListing(c, id)`: `if (!isUuid(id)) return null; const scope = await agencyScope(c); if (!scope) return null; const p = await getProperty(db, id); return p && p.agencyId === scope ? p : null;`
- `POST /api/listings/:id` (bodyLimit): `const p = await ownedListing(c, id); if (!p) return 403/400` (400 for bad uuid, 403 otherwise — or just 403). Read body, build a whitelisted patch (name/address/city/priceMinor/bedrooms/bathrooms/areaM2/type/dealType; coerce numbers; **priceMinor arrives in cents** from the client). `updateProperty` → return updated.
- `POST /api/listings/:id/status` `{status}` (bodyLimit): ownedListing or 403; `try { setPropertyStatus } catch { 400 invalid status }`; return updated.
- `DELETE /api/listings/:id`: ownedListing or 403; `deleteProperty`; `{ok:true}`.
- Tests (api.test.ts): seed agency+partner+a listing (createProperty under the agency); with the owner partner token: update changes fields; status→"sold" persists; status→"junk"→400; delete removes it (listAgencyProperties empty) and a prior inquiry's propertyId nulled. With a DIFFERENT agency's partner token (or none): each of the three → 403. Bad uuid → 400.
- Commit `feat(web): owner-scoped listing update/status/delete endpoints`.

## Task 3 — console: api client + edit modal + status control + delete
- `apps/app/lib/api.ts`: widen `Property.status` to `"draft"|"published"|"rented"|"sold"` (or keep string + a `LISTING_STATUSES` const). Add:
  - `export type UpdateListingInput = { name; address; city; priceMinor; bedrooms?; bathrooms?; areaM2?; type; dealType };`
  - `updateListing(token, id, input)` → `POST /api/listings/${id}`.
  - `setListingStatus(token, id, status)` → `POST /api/listings/${id}/status` `{status}`.
  - `deleteListing(token, id)` → `DELETE /api/listings/${id}`.
- `apps/app/app/agency.tsx`:
  - Each listing row: replace the static `StatusPill` with a tappable **status control** (a small inline picker — tap cycles or opens a 4-option chooser: Published/Rented/Sold/Draft) → `setListingStatus` → refresh on success; show all 4 states with distinct pill colors. Add an **Edit** button and a **Delete** button (Delete → confirm via `window.confirm` on web / `Alert.alert` on native; reuse `Platform`).
  - **Edit modal**: a modal (mirror the website.tsx/add-form styling) prefilled from the selected listing — fields: name, address, city, **price in € (priceMinor/100)**, bedrooms, bathrooms, area m², type (residential/land/commercial), rent/sale. Save → `updateListing(token, id, { ...,$ priceMinor: Math.round(Number(priceEuros)*100) })` → close + refresh. Reuse the add-form's input components/styles.
  - Wire callbacks from `Agency` into the row component (onEdit/onStatus/onDelete).
- Verify `pnpm --filter @kluche/app typecheck` + `expo export --platform web --output-dir /tmp/v --clear`.
- Commit `feat(app): edit listing modal + status control + delete`.

## Task 4 — deploy (ops)
- Build backend + roll (enum migration on boot); rebuild console (`--clear`) + SWA deploy.
- Verify in Stefan's console: edit a Stam listing's price/specs → saved + reflected on `/a/stam`;
  set one to Rented → it disappears from `/a/stam` (still listed in console as Rented); delete a test
  listing → gone. Clean up afterward (don't leave Stam's real data altered — edit/delete a throwaway,
  or revert).

## Notes
- Price: client sends `priceMinor` (cents) on both create and update — keep it consistent (the edit
  modal does €→cents, mirroring the add form).
- Enum migration is the one to watch — must be additive ADD VALUE, not a destructive recreate.
- Scope guard (`ownedListing`) is the key security control — an agency must never edit/delete/restatus
  another agency's listing. Cover with 403 tests.
