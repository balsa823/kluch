# Map view + toggle — Plan

> subagent-driven. Groups: A (locations coords + schema/core), B (render map view + i18n),
> C (console settings toggle), D (deploy). Reference: brand/map-mockup.html.

## Group A — geo coords + mapEnabled (TDD)
- `packages/locations/src/index.ts`: add an internal coords table + exports
  `cityCoords(city): {lat:number;lng:number} | null` and `areaCoords(city, area): {lat:number;lng:number} | null`.
  Seed city centres for all MNE cities (approx) and area centres for Podgorica's areas (from
  brand/map-mockup.html AREAS) + a few main coastal areas; unknown → null. Tests in the package.
- `packages/db/src/schema.ts`: add `mapEnabled: boolean("map_enabled").notNull().default(false)` to
  `agencies`; additive migration; apply to test DB; generate clean.
- `packages/core/src/agencies.ts`: `AgencyConfigPatch` += `mapEnabled?: boolean`; in
  `updateAgencyConfig`, accept boolean (mirror `observeHolidays`). Test it sets/validates.
- Commit `feat(core): area/city coords + agency mapEnabled`.

## Group B — render map view (TDD, web)
- `apps/web/src/app.ts`/`render.ts`: pass `agency.mapEnabled` through (already on the agency object).
- `render.ts`:
  - Helper (server) `listingPin(listing)`: centre = areaCoords(city,area) ?? cityCoords(city); if
    none → null. Seeded random offset within 460m (seed = listing.id), like the mock. Add `lat`/`lng`
    to each entry in the `kluche-listings` JSON (null when unresolved).
  - When `agency.mapEnabled`: render a **List / Map** segmented toggle above `.grid`; a hidden
    `#kluche-map` container (Leaflet target) + the area-circle data as a JSON blob (areas/cities
    present on this page with centre + count). Load Leaflet CSS/JS from unpkg + Carto tiles, grayscale
    via CSS. Inline JS (guarded so it no-ops when the map is off / Leaflet absent): build the map on
    first switch to Map view, draw circles + pins, pin click → openModal(id) (reuse), circle/chip
    click → navigate to pageHref-style `?loc=` (reuse the server filter). Keep all regex out of the
    template-literal JS (string ops only — see the thumb() lesson; add to the new-Function test).
  - i18n keys `view.list`,`view.map`,`map.approx` in all four dicts.
- Tests (render.test.ts): mapEnabled false → no `#kluche-map`/toggle; true → toggle + Leaflet include
  + listings JSON has numeric lat/lng for a known-city listing and null for an unknown city; the
  emitted inline `<script>` still passes `new Function`. Pin offset deterministic + within radius
  (unit-test the exported `listingPin` if exported, else assert lat/lng near the area centre).
- Commit `feat(web): white-label Map view (gated by mapEnabled) with area circles + approx pins`.

## Group C — console Settings toggle
- `apps/app/lib/api.ts`: add `mapEnabled?: boolean` to `Agency` + `SettingsPatch`.
- `apps/app/app/settings.tsx`: a **Map view** switch (reuse the observeHolidays switch pattern) in a
  "Site"/Homepage section; include `mapEnabled` in the saved patch. i18n keys (en+sr).
- Verify typecheck + expo export + check:i18n.
- Commit `feat(app): Map view on/off toggle in settings`.

## Group D — deploy
- Merge, push. Backend image rebuild + roll (migration on boot). Console rebuild (--clear) + SWA.
- Verify: Stam settings → toggle Map on; kluche.me/a/stam shows List/Map switch; Map view renders
  grayscale with area circles + approx pins inside circles; pin → modal; area → filters. Toggle off →
  no map. Revert Stam toggle after.

## Notes
- Coords approximate/illustrative; areas without coords fall back to city centre; unknown city → no pin.
- Reuse existing modal + `?loc=` server filter so map and grid stay consistent.
- Inline-JS: string ops only (no regex literals) — covered by the new-Function script-validity test.
