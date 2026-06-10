# Hero search + Location/area filter — Plan

> subagent-driven. Groups: A (locations pkg + schema/migration + core + tests), B (web: parse +
> render hero redesign + i18n + tests), C (console editor city/area dropdowns + i18n), D (deploy).
> Each group: implement → spec review → quality review. Reference mockup: `brand/search-mockup.html`.

**Goal:** keypartners-style hero (search box + Location/Price/Listing/Beds/Type chip-popovers) on the
white-label site, backed by an editable `area` field, with multi-select city/area Location filtering.

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Test DB :5433. Web tests via
vitest; console has no unit runner (typecheck + expo export + `pnpm check:i18n`).

---

## Task 1 — `@kluche/locations` package
**Files:** create `packages/locations/{package.json,tsconfig.json,src/index.ts,src/__tests__/locations.test.ts}`; add to workspace.
- Pure ESM, ZERO runtime deps. `export type MneCity = { city: string; areas: string[] }`,
  `export const MNE_LOCATIONS: MneCity[]` (cities + curated areas — copy the list from
  `brand/search-mockup.html`'s `MNE` array as the seed), `cityNames(): string[]`,
  `areasFor(city: string): string[]`, `isKnownArea(city, area): boolean`.
- package.json: name `@kluche/locations`, type module, main/exports → `dist` or use the repo's TS
  build setup (match how `@kluche/core` is consumed — likely `exports` to `./src/index.ts` via the
  workspace's ts tooling; mirror an existing leaf package's package.json).
- Tests (vitest): MNE_LOCATIONS non-empty, every entry has a string city + array areas, `areasFor`
  returns the right list, `isKnownArea` true/false cases.
- Commit `feat(locations): @kluche/locations package (MNE cities + areas)`.

## Task 2 — schema + core (TDD)
**Files:** modify `packages/db/src/schema.ts` (+ migration), `packages/core/src/listings.ts`,
`packages/core/src/__tests__/listings.test.ts`; `packages/core` depends on `@kluche/locations`.
- schema: add `area: text("area")` to `properties`. Generate additive migration; apply to test DB; `generate` clean.
- `CreatePropertyInput` += `area?: string`; `createProperty` inserts it. `UpdatePropertyPatch` +=
  `area?: string | null`; `updateProperty` whitelists `area`.
- `SearchFilters` += `locations?: { city: string; area?: string }[]`. `searchConditions`: when
  `locations?.length`, push an `or(...)` of per-entry conditions (`eq(city)` or `and(eq(city),
  eq(area))`); import `or` from drizzle. Keep existing city/refCode/price/bedrooms/type/dealType.
- Tests: createProperty+area; updateProperty sets area, ignores non-whitelisted; search by
  `[{city:"Budva"}]` returns all Budva, by `[{city:"Budva",area:"Bečići"}]` only that area, multiple
  entries OR; area null rows excluded from an area-specific query.
- Commit `feat(core): editable area + location (city/area) search`.

## Task 3 — web parse + free-text q (TDD)
**Files:** `apps/web/src/app.ts` (parseSearchFilters), `apps/web/src/__tests__/*`.
- `parseSearchFilters`: read repeated `loc` via `c.req.queries("loc")` (array); each value split on
  first `|` → `{city, area?}`; build `filters.locations`. Read `q`: trim; if `/^[A-Z]{2,6}-\d+$/i`
  → `filters.refCode = q.toUpperCase()`, else set a new `filters.text` (ilike name/address) — add
  `text?: string` to SearchFilters + a `name/address ilike` condition in core (fold into Task 2 if
  cleaner). Keep `city`/`code`/price/bedrooms/type/dealType parsing for backward-compat.
- Note: `parseSearchFilters` takes `c.req.query()` today (a flat record) — switch to reading the
  Hono context (`c`) or pass `c.req.queries()` so repeated `loc` survive. Adjust call sites.
- Tests: `?loc=Budva&loc=Kotor|Dobrota` → locations `[{city:Budva},{city:Kotor,area:Dobrota}]`;
  `?q=ST-0042` → refCode; `?q=more` → text; price/beds still parse.
- Commit `feat(web): parse repeated loc params + free-text q`.

## Task 4 — render hero redesign + i18n (TDD)
**Files:** `apps/web/src/render.ts`, `apps/web/src/__tests__/render.test.ts`.
- Replace the current `<form class="search">` grid + remove the leftover deal-type select work as
  needed. Build the hero from `brand/search-mockup.html` (port its CSS + structure + inline JS):
  search `<input name="q">` + Search button (agency accent), chip row Location/Price/Listing/Beds/
  Type, popovers, embedded `MNE_LOCATIONS` JSON blob, hidden-input serialisation on submit, active
  chip ✕, click-outside close. Pre-select from `filters` on render (server-side) so the URL round-
  trips (e.g. active `loc`/price/beds/type show as selected + chips active).
- i18n: add keys for hero.title fallback, search.placeholder, search.submit (exists), filter.location,
  filter.price, filter.listing, filter.beds, filter.type, opt.any, opt.rent, opt.sale, beds.1plus…,
  type.* (reuse existing search.type* / tab.* where present) to all four dicts (en/sr/ru/tr).
- Escape everything (esc/attr/jsonForScript). Pagination via existing pager keeps `loc`/`q`/price/etc
  (extend `filterParams` to emit repeated `loc` + `q`).
- Tests: output contains `name="q"`, the chip row, `id`/blob for locations, active-state pre-select
  for a given filter, and `/a/:slug?loc=Budva` integration returns Budva listings only.
- Commit `feat(web): keypartners-style hero with Location/Price/Listing/Beds/Type filters`.

## Task 5 — console editor city/area dropdowns + i18n
**Files:** `apps/app/app/agency.tsx`, `apps/app/lib/api.ts`, `apps/app/lib/i18n/dict.ts`;
`apps/app` depends on `@kluche/locations` (verify metro/expo resolves it — else duplicate list in
`apps/app/lib/locations.ts` + a parity check).
- `Property`/`CreateListingInput`/`UpdateListingInput` += `area?: string | null`; `createListing`/
  `updateListing` send it.
- Add/Edit forms: City = dropdown of `cityNames()`; Area = dropdown of `areasFor(city)` (with a
  blank "—" option), resets when city changes, hidden if the city has no areas. Default city to the
  listing's existing city if present (even if free-text legacy value — still selectable/overridable).
- i18n keys `listings.city`/`listings.area` (+ any) in en + sr.
- Verify `pnpm --filter @kluche/app typecheck`, `expo export --platform web --output-dir /tmp/v
  --clear`, `pnpm check:i18n`.
- Commit `feat(app): city + area dropdowns in the listing editor`.

## Task 6 — deploy (ops)
- Merge (finishing-a-development-branch), push. Build backend image + `terraform apply` (migration on
  boot) + health. Rebuild console (`expo export --clear`) + SWA deploy. Verify on kluche.me/a/stam:
  hero + chips work, Location popover lists cities/areas, filtering by a city narrows results; in
  Stefan's console, edit a Stam listing's city/area and confirm it then matches the Location filter.
  Clean up any throwaway edits.

## Notes
- `@kluche/locations` must stay pure (no deps) so both Node (web) and the Expo bundler can import it.
- Migration additive (ADD COLUMN), like 0010/0011.
- Don't translate listing data; only chrome.
- Existing listings: area null → whole-city filter works now; area search needs tagging via editor.
