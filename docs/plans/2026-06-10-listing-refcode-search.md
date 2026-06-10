# Listing Reference Codes + Search Hardening — Plan

> **For Claude:** subagent-driven. Groups: A (db+core: schema/migration, prefix+allocate, createProperty txn, search incl. code, backfill — all TDD), B (web: parseSearchFilters code + render badge/field/i18n + filter tests), C (ops: deploy + run backfill on prod).

**Goal:** Give every listing a memorable per-agency sequential ref code (`ST-0042`), show it on the
white-label cards/modal, let people search by it, backfill existing listings, and lock in
search/filter behaviour with tests.

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Test DB :5433
(kluch:kluch / kluch_test). Reuse: `createProperty`/`searchConditions`/`searchProperties`/
`countProperties`/`SearchFilters` (listings.ts), `createAgency`/`slugify` (agencies.ts),
`parseSearchFilters` (app.ts), `renderAgencySite` + card markup + `kluche-listings` JSON +
`en/sr/ru/tr` i18n dicts (render.ts), the bulk importer (importers.ts) which calls createProperty.

---

## Task 1 — schema + migration (additive)

**Files:** Modify `packages/db/src/schema.ts`; generate migration under `packages/db/migrations/`.

- `agencies`: add `refPrefix: text("ref_prefix")`, `refSeq: integer("ref_seq").notNull().default(0)`.
- `properties`: add `refCode: text("ref_code")`; add a **partial unique index**
  `uniqueIndex("properties_agency_refcode").on(table.agencyId, table.refCode).where(sql\`ref_code is not null\`)`.
- `pnpm --filter @kluche/db exec drizzle-kit generate`; verify the SQL is additive (ADD COLUMN +
  CREATE UNIQUE INDEX … WHERE) — no drops. Apply to test DB; `generate` again → clean (no diff).
- Commit `feat(db): ref_prefix/ref_seq on agencies + ref_code on properties`.

## Task 2 — prefix derivation + code allocation + createProperty (TDD, core)

**Files:** Modify `packages/core/src/listings.ts` (or a new `refcode.ts` imported by listings);
Test `packages/core/src/__tests__/refcode.test.ts`.

- `export function derivePrefix(name: string, slug?: string): string` — uppercase; keep A–Z;
  take first 2 letters of the cleaned name; if <2, fall back to first 2 A–Z of `slug`; else `"AG"`.
  Tests: `"Stam"→"ST"`, `"Popović Nekretnine"→"PO"`, `"123 Estates"→"ES"`, `"Стан"` (Cyrillic, no
  A–Z) + slug `"stan-mn"`→`"ST"`, empty→`"AG"`.
- `export async function allocateRefCode(tx, agencyId): Promise<string>` —
  `UPDATE agencies SET ref_seq = ref_seq + 1 WHERE id=agencyId RETURNING ref_seq, ref_prefix`
  (drizzle `.update(...).set({ refSeq: sql\`\${agencies.refSeq} + 1\` }).returning({...})`); throw
  if no row / null prefix; return `${prefix}-${String(seq).padStart(4,"0")}`.
  Tests: first call on a fresh agency (prefix `ST`, seq 0) → `"ST-0001"`; next → `"ST-0002"`;
  padding holds to 4 then grows (seq 12345 → `"ST-12345"`); two different agencies independent.
- Modify `createProperty` to run inside `db.transaction(async (tx) => { const refCode =
  await allocateRefCode(tx, input.agencyId); insert … values({ …, refCode }) })`. Keep the
  `Database` type (postgres-js drizzle supports `.transaction`).
  Test: `createProperty` returns a property whose `refCode` matches `^[A-Z]{2,}-\d{4,}$` and two
  successive creates under one agency increment.
- Commit `feat(core): derivePrefix + allocateRefCode + createProperty assigns ref codes`.

## Task 3 — search by code (TDD, core)

**Files:** Modify `packages/core/src/listings.ts`; Test `packages/core/src/__tests__/listings.test.ts`.

- `SearchFilters`: add `refCode?: string`.
- `searchConditions`: `if (filters.refCode) conditions.push(eq(properties.refCode, filters.refCode));`
  (refCode arrives already uppercased from the parser).
- Tests (extend existing search tests; seed an agency + a few published properties — note these now
  get auto codes): search with `{ refCode: "<one listing's code>" }` returns exactly that listing;
  a non-existent code → []; `countProperties` agrees. Also add/confirm coverage for city (ilike),
  minPrice/maxPrice (range), bedrooms (gte), type, dealType, published-only, and pagination
  (limit/offset) — these are the "make filters work" guarantees.
- Commit `feat(core): search listings by reference code + filter test coverage`.

## Task 4 — backfill existing listings (TDD, core)

**Files:** Create `packages/core/src/backfillRefCodes.ts`; Test `packages/core/src/__tests__/backfillRefCodes.test.ts`; export from `packages/core/src/index.ts`.

- `export async function backfillRefCodes(db): Promise<{ agencies: number; assigned: number }>`:
  for each agency — if `refPrefix` empty, set it via `derivePrefix(name, slug)`; select that
  agency's properties where `refCode is null` ordered by `createdAt asc, id asc`; assign
  `prefix-0001…` continuing from the agency's current `refSeq`; update each property + set the
  agency `refSeq` to the last number used. Idempotent: a property with a code is skipped; numbers
  never reused. Run per-agency in a transaction.
- Tests: seed 2 agencies with N codeless listings (insert directly, bypassing createProperty so
  refCode is null) → after backfill each agency's listings have sequential codes by createdAt,
  prefixes set, refSeq = count; running it twice assigns nothing new (assigned=0) and codes are
  unchanged.
- Commit `feat(core): idempotent ref-code backfill`.

## Task 5 — parseSearchFilters + render badge/field/i18n (TDD, web)

**Files:** Modify `apps/web/src/app.ts` (parseSearchFilters), `apps/web/src/render.ts`;
Tests `apps/web/src/__tests__/*` (parse + render + an `/a/:slug?code=` integration test).

- `parseSearchFilters`: read `query.code`; if present, `trim().toUpperCase()`; set
  `filters.refCode` only when it matches `/^[A-Z]{2,6}-\d+$/` (ignore junk silently).
- `render.ts`:
  - Add `refCode` to the `kluche-listings` JSON `pick`.
  - Card markup: a small badge chip showing `listing.refCode` (escaped) — e.g. top-left of the card.
  - Modal: show the code near the title.
  - Search form: add a "Ref. code" `<input name="code" value="${attr(filters.refCode ?? "")}">`.
  - i18n: add `search.code` (en "Ref. code", sr "Šifra", ru "Код", tr "Kod") and a `card.code`/
    label if needed, to all four dicts.
- Tests: `parseSearchFilters({code:"st-0042"})` → `refCode:"ST-0042"`; junk code ignored;
  render output contains the badge for a listing with a code, the code in the JSON blob, and the
  `name="code"` field; `/a/:slug?code=<code>` returns just that listing (seed agency+listing).
- `pnpm --filter @kluche/web exec vitest run` green; `pnpm --filter @kluche/app typecheck` still green.
- Commit `feat(web): show ref code on cards/modal + search by code + filter parsing tests`.

## Task 6 — deploy + backfill prod (ops)

- Merge to master (finishing-a-development-branch), push.
- Build backend image (`az acr build` plain), `terraform apply -var backend_image=…` (migration
  applies on boot), wait for the revision Running, `/health` 200.
- Run `backfillRefCodes` against **prod** once: a tiny node/tsx invocation with the prod connection
  string passed **inline as an env var** (never written to a file), e.g.
  `DATABASE_URL='…' pnpm --filter @kluche/core exec tsx -e 'import {db…} run backfill'` — or add a
  guarded `backfill:refcodes` script. Capture the `{agencies, assigned}` summary.
- Rebuild console (`expo export --platform web --output-dir dist --clear`) only if render/app
  changed user-facing console behaviour (it doesn't here — skip unless typecheck demanded a change).
- Verify on `kluche.me/a/stam`: cards show `ST-####` badges; `?code=ST-0001` returns one listing;
  the search form's Ref. code field works. Spot-check Stam's count of codes == listing count.

## Notes
- `createProperty` becoming transactional must not break the importer (it calls createProperty per
  row) or any existing createProperty caller — signature unchanged, just wrapped internally.
- Migration must be additive (ADD COLUMN / partial unique index), like 0010 was.
- Ref code is server-allocated only — never added to `updateProperty`'s whitelist.
- Backfill ordering by `createdAt asc` makes Stam's imported listings get codes in import order.
