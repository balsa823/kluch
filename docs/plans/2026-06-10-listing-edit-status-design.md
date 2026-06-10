# Listing Edit + Status + Delete — Design

*Approved 2026-06-10.* Agencies can edit a listing's specs, change its status
(Published/Rented/Sold/Draft), and delete it, from the console.

## Statuses
- Extend `propertyStatusEnum` `["draft","published"]` → `["draft","published","rented","sold"]`
  (additive `ALTER TYPE ... ADD VALUE` migration — safe, non-destructive).
- **Public site shows only `published`** — `searchProperties`/`countProperties` keep
  `status='published'`, so Rented/Sold/Draft are hidden from the marketplace + agency site.
  (Flip later to show "taken" badges if desired.)

## Backend (core + web)
- core `listings.ts`:
  - `updateProperty(db, id, patch)` — whitelist {name, address, city, priceMinor, currency,
    bedrooms, bathrooms, areaM2, type, dealType}; never touches agencyId/slug/status/sourceId/photos.
  - `setPropertyStatus(db, id, status)` — `status` must be one of the enum values, else throw.
  - `deleteProperty(db, id)` — first `update inquiries set propertyId=null where propertyId=id`
    (avoid FK violation), then delete the property row. Returns void.
- web (partner-authed; **the listing must belong to `agencyScope`'s agency** else 403):
  - helper `ownedListing(c, id)` → loads the property, returns it iff `property.agencyId === scope`, else null.
  - `POST /api/listings/:id` (bodyLimit) → validate id; ownedListing or 403; `updateProperty` with the
    request body's whitelisted fields (price comes in **euros** → ×100 to priceMinor); return updated.
  - `POST /api/listings/:id/status` `{status}` → ownedListing or 403; validate status; `setPropertyStatus`.
  - `DELETE /api/listings/:id` → ownedListing or 403; `deleteProperty`; return `{ok:true}`.

## Console (apps/app)
- `api.ts`: `updateListing(token, id, input)`, `setListingStatus(token, id, status)`,
  `deleteListing(token, id)`; `Property` type `status` widened to the union; `CreateListingInput`
  reused for edit input.
- `agency.tsx`: each listing row gets:
  - a **status control** (a small segmented/select: Published / Rented / Sold / Draft) → `setListingStatus` → refresh.
  - an **Edit** button → a **prefilled modal** (reuse the add-listing fields: name, city, address,
    price €, bedrooms, bathrooms, area, type, rent/sale) → Save → `updateListing` → refresh.
  - a **Delete** button → confirm (Alert/confirm) → `deleteListing` → refresh.
- Price shown/edited in euros (priceMinor/100 in, ×100 out — done server-side on the update endpoint
  so the client sends euros, consistent with the search form).

## Tests
- core: `updateProperty` changes whitelisted fields only (ignores agencyId/status); `setPropertyStatus`
  accepts enum values, rejects junk; `deleteProperty` nulls referencing inquiries then deletes.
- web: update/status/delete each reject a foreign agency's listing (403) and a bad id (400);
  update converts euros→cents; status rejects invalid; delete removes + nulls inquiries.
- console: typecheck + web export; edit modal prefills + saves; status control; delete confirm.

## Out of scope
Photo add/remove in the editor; bulk actions; showing Rented/Sold on the public site.
