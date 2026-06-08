# Bulk Import — Implementation Plan

> **For Claude:** subagent-driven-development / executing-plans.

**Goal:** Import Stefan's ~1,232 bestate4 listings into the Stam agency; property types become Residential/Land/Commercial; agency site gets pagination.

**Tech:** pnpm `@kluche/*`, Node 22 nvm, Drizzle/drizzle-kit, Hono, Expo/RN-Web, Vitest (test DB :5433 `postgresql://kluch:kluch@localhost:5433/kluch_test`). Setup each bash: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`.

Reuse: `packages/core/src/importers.ts` (`unwrapFirestore`, `mapBestate4`, `importListing`'s per-image fetch+upload, `extFromContentType`, `FIRESTORE_BASE`), `listings.ts` (`searchProperties`, `createProperty`, `SearchFilters`, `PropertyType`), `apps/web/src/app.ts` (`parseSearchFilters`, `GET /a/:slug`), `render.ts`.

---

## Task 1: property types → residential/land/commercial (schema + migration)
**Files:** `packages/db/src/schema.ts`; **hand-written** migration; `apps/web/src/seed.ts`.
1. `schema.ts`: `propertyTypeEnum = pgEnum("property_type", ["residential","land","commercial"])`.
2. `pnpm --filter @kluche/db generate` will produce a broken enum diff — **replace** the generated SQL (or add a new migration file + journal entry) with a hand-written, safe swap:
```sql
ALTER TYPE "property_type" RENAME TO "property_type_old";
CREATE TYPE "property_type" AS ENUM('residential','land','commercial');
ALTER TABLE "properties" ALTER COLUMN "type" TYPE "property_type"
  USING (CASE WHEN "type" IS NULL THEN NULL ELSE 'residential'::"property_type" END);
DROP TYPE "property_type_old";
```
Apply to test DB (`DATABASE_URL=postgresql://kluch:kluch@localhost:5433/kluch_test pnpm --filter @kluche/db migrate`); confirm it runs and the meta snapshot matches (regenerate snapshot if needed so future generates are clean).
3. `seed.ts`: change the 3 listings' `type` from apartment/studio/house → `residential` (all three).
4. Commit `feat(db): property types residential/land/commercial + remap migration`.

## Task 2: `sourceId` on properties (idempotency)
**Files:** `schema.ts`, migration, `packages/core/src/listings.ts`.
- Add `sourceId: text("source_id")` to `properties`. Add a unique index `uniqueIndex("properties_agency_source").on(agencyId, sourceId)` (Postgres treats NULLs as distinct, so manual listings with null sourceId are unaffected).
- `CreatePropertyInput` + `createProperty`: accept optional `sourceId`.
- Add `getPropertyBySource(db, agencyId, sourceId)` → Property | null.
- Generate + apply migration. Test: create with sourceId, `getPropertyBySource` finds it; null sourceId allowed. Commit `feat(core): property sourceId + lookup for import idempotency`.

## Task 3: extend `mapBestate4` (TDD)
**Files:** `packages/core/src/importers.ts`, `packages/core/src/__tests__/importers.test.ts`.
- Add to `ParsedListing`: `dealType?: "rent"|"sale"`.
- In `mapBestate4`: `type` ← map source `type` string (case-insensitive: "residential"→residential, "land"→land, "commercial"→commercial; default residential). `dealType` ← `listingType` ("FOR_RENT"→rent, "FOR_SALE"→sale; default rent). price: rent → `monthlyRent`, sale → `price`; `priceMinor = amount*100` (0 stays 0).
- Tests (TDD): a FOR_RENT residential doc → {type:"residential", dealType:"rent", priceMinor: monthlyRent*100}; a FOR_SALE land doc → {type:"land", dealType:"sale", priceMinor: price*100}; missing price → 0. Commit `feat(core): map bestate4 type/dealType/price`.

## Task 4: pagination in search (TDD)
**Files:** `packages/core/src/listings.ts`, `apps/web/src/app.ts`.
- `SearchFilters`: add `page?: number`. `searchProperties`: add `limit`/`offset` params (signature `(db, agencyId, filters, opts?: {limit?:number; offset?:number})`) → append `.limit().offset()` when given, ordered `desc(createdAt)`. New `countProperties(db, agencyId, filters)` (same conditions, returns count int).
- `parseSearchFilters`: read `page` (positive int, default undefined).
- Tests: create 30 listings; `searchProperties(..., {}, {limit:24, offset:0})` → 24; offset 24 → 6; `countProperties` → 30. Commit `feat(core): paginated search + countProperties`.

## Task 5: `importAgentListings` (TDD)
**Files:** `packages/core/src/importers.ts`, test.
- `fetchAgentListings(agentId, fetchImpl=fetch)`: paginate `${FIRESTORE_BASE}?pageSize=300`(+pageToken), collect docs whose `fields.agentId.stringValue === agentId`; return `[{ id, fields }]` (id = last path segment of doc.name).
- `importAgentListings(db, agencyId, agentId, storage?, opts?: { fetchImpl?, onProgress? })`: for each → `id` as sourceId; if `getPropertyBySource(db, agencyId, id)` exists → skip; else `mapBestate4(unwrapFirestore(fields))` → `createProperty({agencyId, sourceId:id, dealType, ...})` → if storage, download each image (reuse importListing's fetch+upload loop; best-effort per image) → `addPropertyPhotos` → `publishProperty`. try/catch per listing (push to failed). Return `{created, skipped, failed}`.
- Tests (TDD): a fake `fetchImpl` returning 2 docs for the agent (+1 for another agent, ignored) → import creates 2 (FakeStorage); re-run → skipped 2, created 0; a doc that throws in mapping → counted in `failed`, others still created. Commit `feat(core): importAgentListings (idempotent bulk import)`.

## Task 6: agency-site pagination UI (web)
**Files:** `apps/web/src/app.ts` (`GET /a/:slug`), `apps/web/src/render.ts`, `render.test.ts`.
- `GET /a/:slug`: `const page = Math.max(1, filters.page ?? 1); const pageSize = 24; const offset=(page-1)*pageSize;` fetch `searchProperties(db, agency.id, filters, {limit:pageSize, offset})` + `countProperties(...)`; pass `{ sent, page, pageSize, total }` to `renderAgencySite`.
- `renderAgencySite(agency, listings, filters, opts)`: render a pager below the grid — Prev/Next links + "Page X of N", hrefs preserve current query (city/dealType/etc.) with `page=`. Hide Prev on page 1, Next on last page. No pager when total ≤ pageSize.
- Tests: 30 listings, page 1 shows pager "Page 1 of 2" + a Next link with `page=2`; page 2 has Prev. Commit `feat(web): agency-site pagination`.

## Task 7: console types → new enum
**Files:** `apps/app/app/agency.tsx`.
- `TYPES = ["residential","land","commercial"] as const`; default `useState<ListingType>("residential")`; reset to `"residential"`. Verify `pnpm --filter @kluche/app typecheck` + `expo export --platform web --output-dir /tmp/v --clear`. Commit `feat(app): listing types residential/land/commercial`.

## Task 8: run + deploy (ops)
1. Build backend image + `terraform apply -var backend_image=…`; migrations (type remap, sourceId) run on boot; confirm revision Healthy. Rebuild console (`--clear`) + SWA deploy.
2. One-off `apps/web/src/import-agent.ts` (not committed): calls `importAgentListings(db, <Stam agency id>, "PWdimWiiFXPstz17SMnViPkAEQF3", new AzureBlobStorage())`. Run with `DATABASE_URL` + `AZURE_STORAGE_ACCOUNT/KEY/CONTAINER` set inline. Resumable — re-run until `created` stops growing. Log progress every N.
3. Verify: `kluche.me/a/stam` shows listings with pager; rent/sale tags + prices; a spot-check listing's photos load from our Blob; re-running the import reports all skipped.

## Notes
- Enum migration is the one hand-written SQL — get the `USING` cast right (NULL-safe).
- Idempotency via `(agencyId, sourceId)` unique index makes the long import safe to resume.
- Be polite to Firebase Storage: small image-download concurrency, continue on per-image failure.
