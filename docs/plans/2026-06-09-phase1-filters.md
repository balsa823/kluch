# Phase 1 — Filters (polish + fix) — Plan

> subagent-driven / direct execution. Small, isolated.

**Goal:** Wire a working Type filter into the agency-site search form and fix the price-unit bug so City/Type/Min/Max/Bedrooms all actually filter.

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Tests: `pnpm --filter @kluche/web exec vitest run`, `pnpm --filter @kluche/core exec vitest run`.

## Task 1: fix price units (€ → cents) in `parseSearchFilters` (TDD)
- `apps/web/src/app.ts` `parseSearchFilters`: the Min/Max boxes are euros; `searchProperties`
  compares against `priceMinor` (cents). Multiply by 100:
  `if (minPrice !== undefined) filters.minPrice = minPrice * 100;` (same for max).
- Test (`apps/web/src/__tests__/*`): `parseSearchFilters({ minPrice: "500", maxPrice: "1000" })`
  → `{ minPrice: 50000, maxPrice: 100000 }`. And an integration-style test: seed listings at
  40000/60000/90000 cents, `searchProperties(db, id, parseSearchFilters({minPrice:"500",maxPrice:"700"}))`
  returns only the 60000 one.
- Commit `fix(web): search price filter uses euros (convert to cents)`.

## Task 2: Type select in the search form (render.ts)
- `apps/web/src/render.ts` search form: add a `<select name="type">` with Any/Residential/Land/
  Commercial, the current `filters.type` pre-selected (mirror the existing dealType select). Use
  `data-i18n` for the label + an i18n key for "Any type" if trivial; keep it consistent with the
  other fields. Relabel Min/Max price inputs to include "(€)".
- Test (`render.test.ts`): output contains `name="type"` with the three options and marks the active
  one selected when `filters.type` is set. Existing search tests still pass.
- Commit `feat(web): property-type filter in agency-site search`.

## Task 3: verify + light restyle
- Confirm the search bar styling is clean (it already renders as a rounded pill with labels);
  ensure the new Type select matches the dealType select styling. No structural redesign.
- Run full `pnpm --filter @kluche/web exec vitest run` + `pnpm --filter @kluche/web typecheck`.
- Commit if any styling tweak; otherwise covered above.

## Deploy
Build backend image + `terraform apply -var backend_image=…`; verify `kluche.me/a/stam` Type filter
narrows results and a Min/Max price like 500–700 returns sensible matches.
