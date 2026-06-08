# Bulk Import (Stefan's bestate4 listings → Stam) — Design

*Approved 2026-06-08.* Import the ~1,232 listings under bestate4 agentId
`PWdimWiiFXPstz17SMnViPkAEQF3` into the Stam Kluche agency, change property types to
Residential/Land/Commercial, and add basic pagination to the agency site.

## 1. Property types → residential / land / commercial
- `propertyTypeEnum` becomes `["residential","land","commercial"]`. Migration alters
  `properties.type` with a remap (`apartment|studio|house → residential`) via a new enum +
  `ALTER COLUMN ... USING` + drop old (drizzle-kit may need a hand-edited SQL).
- Console `TYPES` (`agency.tsx:25`) → the three new values; default `residential`.
- Seed listings' `type` values updated to the new enum.
- Render type label stays capitalized (`esc` + capitalize).

## 2. Field mapping (extend `mapBestate4`)
- `title→name`; location→address/city (existing); bedrooms/bathrooms/area (existing).
- **type** ← source `type` (Residential→residential, Land→land, Commercial→commercial; default residential).
- **dealType** ← source `listingType` (FOR_RENT→rent, FOR_SALE→sale; default rent).
- **price**: rent → `monthlyRent`, sale → `price`; `priceMinor = amount*100`; keep real values,
  leave `0` only where genuinely missing.

## 3. Idempotency — `sourceId` on properties
- Add nullable `sourceId text` to `properties` (the Firestore doc id). Unique index on
  `(agency_id, source_id)`. The bulk import skips a listing whose `sourceId` already exists →
  resumable / re-runnable. `createProperty` accepts optional `sourceId`.

## 4. Bulk importer (core)
- `fetchAgentListings(agentId)`: paginate the public Firestore `listings` collection
  (`propertyhub-d94aa`), return raw docs for the agent (with their doc id).
- `importAgentListings(db, agencyId, agentId, storage, { onProgress? })`: per listing →
  if a property with that `sourceId` exists under the agency, skip; else `mapBestate4` →
  `createProperty({..., sourceId, dealType})` → download **all** images to Blob
  (`properties/<id>/photo-<i>.<ext>`, reusing the existing per-image fetch+upload from
  `importListing`) → `addPropertyPhotos` → `publishProperty`. Per-listing try/catch (log +
  continue). Returns `{ created, skipped, failed }`.

## 5. Pagination (agency site)
- `SearchFilters` gains `page?` (1-based). `searchProperties` gains `limit`/`offset`
  (page size **24**). New `countProperties(db, agencyId, filters)` for total.
- `parseSearchFilters` reads `page`. `GET /a/:slug` computes offset, fetches the page + count,
  passes `{ page, pageSize, total }` to `renderAgencySite`, which renders Prev/Next + "Page X of N"
  with links preserving the current filters/query.

## 6. Run mechanism
- One-off `apps/web/src/import-agent.ts` (args/env: agency slug + agentId), run once against
  live with `DATABASE_URL` + `AZURE_STORAGE_ACCOUNT/KEY/CONTAINER`. Resumable via `sourceId`.
  ~1,232 listings × ~8 images ≈ 10k downloads — runs in batches with progress logging; small
  download concurrency to be polite to Firebase Storage. Not committed.

## 7. Testing
- `mapBestate4`: type mapping, dealType mapping, price field per deal (monthlyRent vs price), 0-stays-0.
- enum migration: existing rows remapped to `residential`.
- `searchProperties` limit/offset + `countProperties`; `parseSearchFilters` page.
- `importAgentListings`: idempotent re-run (skips by sourceId), maps+creates+publishes, one
  failing listing doesn't abort the batch (inject a fake fetch + FakeStorage).
- console types compile; site renders pager.

## Out of scope now
Edit-listing UI; importing the other 7 agents; image re-sync/dedup beyond sourceId; infinite scroll.
