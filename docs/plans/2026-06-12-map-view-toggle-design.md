# White-label Map view + agency toggle — Design

*Approved 2026-06-12.* Agencies can toggle a **Map view** on their white-label site. When on, the
site offers a List/Map switch; the map (grayscale Leaflet) shows each listing as a pin placed at a
**stable random point inside its area/city circle** (approximate — never the real address), with
clickable area circles that filter. Payment/entitlement gating is a later layer; for now it's a free
agency setting (`mapEnabled`).

## Geo data (@kluche/locations)
- Keep `MNE_LOCATIONS` `{ city, areas: string[] }` (don't break the editor dropdowns / hero filter).
- ADD coordinates without changing that shape:
  - `cityCoords(city): {lat,lng} | null` — approximate centre for each MNE city.
  - `areaCoords(city, area): {lat,lng} | null` — approximate centre for curated areas (Podgorica
    blocks/neighbourhoods to start; others fall back to the city centre).
- All coords are APPROXIMATE/illustrative (documented). Areas without coords → use the city centre.

## Schema + settings
- `agencies.mapEnabled boolean default false` (additive migration).
- `updateAgencyConfig` whitelists `mapEnabled` (boolean). Console Settings gets a Map on/off toggle.

## White-label site (render.ts)
- When `agency.mapEnabled`, render a **List / Map** toggle above the grid (List default).
- Map: Leaflet (unpkg CDN) + Carto Positron tiles + grayscale CSS (neutral base). For the listings on
  the current page, the SERVER computes each one's pin: centre = `areaCoords(city, area)` || 
  `cityCoords(city)`; a **seeded** (by listing id) random offset within ~460m → `{lat,lng}`; embed in
  the existing `kluche-listings` JSON (add `lat`/`lng`). Also embed the set of area/city circles
  present (centre + name + count).
- Client JS (only loaded/active when map is on): draw area circles (label + count), plot pins
  (price), click pin → open the existing listing modal; click an area circle/chip → filter (set
  `?loc=City|Area` and navigate, reusing the server location filter) so map + grid stay consistent.
- If a listing has no resolvable coords (unknown city), it's listed but not pinned (note shown).
- i18n: `view.list`, `view.map`, `map.approx` ("Approximate location — exact address on enquiry") in
  en/sr/ru/tr.

## Console (Settings)
- A **Map view** switch (`mapEnabled`) in settings.tsx (Homepage or a new "Site" section). Saves via
  the existing config endpoint. (Later: lock it behind a paid entitlement.)

## Tests
- locations: `cityCoords`/`areaCoords` return numbers for known, null for unknown; Podgorica + Budva
  resolve; an unknown area falls back via the caller to city centre.
- core: `updateAgencyConfig` sets `mapEnabled` (boolean), rejects non-boolean.
- web: render with `mapEnabled:false` → no map markup/toggle; `true` → List/Map toggle + Leaflet +
  the listings JSON carries lat/lng for listings with known city; the inline script still parses
  (new Function guard). pins are inside the area radius (seeded, deterministic).
- console: settings toggle present; typecheck + export + i18n parity.

## Out of scope (later)
Payment/Stripe entitlement; drawn boundary polygons (circles for now); coordinates for every area of
every city (Podgorica + main coastal first, rest fall back to city centre); geocoding exact addresses.
