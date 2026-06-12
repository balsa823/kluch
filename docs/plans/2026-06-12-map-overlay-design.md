# Map view bottom overlay (city shortcuts + search/filters) — Design

*Approved 2026-06-12.* When an agency's site is in Map view, float a bottom overlay over the map
with: (1) **city shortcut chips** (tap → fly the map to that city, no panning), and below them
(2) the **search box + filter chips** (the existing hero filters), so you filter without scrolling.
Reference: brand/map-view-mockup.html.

## Approach: reuse the hero form by relocating it
The hero already has the full search form (`#hero-form`: `q` input + Location/Price/Listing/Beds/Type
chips with popovers + Search). To avoid duplicating that complex popover JS (and ID collisions):
- On **showMap()**: move the existing `#hero-form` DOM node into the map overlay's filter slot
  (appendChild preserves all listeners) and add a class so popovers open **upward** (bottom-anchored)
  instead of downward (they'd be off-screen at the bottom).
- On **showList()**: move it back to the hero.
This gives full, real search + filtering in the overlay with zero duplication.

## City shortcuts
- Server derives the distinct cities among THIS page's listings that have `cityCoords` (from
  `@kluche/locations`), each → `{ name, lat, lng, zoom }`. Embed as a JSON blob
  `#kluche-map-cities`. (Only cities the agency actually has listings in show up; unknown-coord
  cities skipped.) If none resolve, the shortcuts row is omitted.
- Render a horizontally-scrollable chip row at the top of the overlay; tap → `map.flyTo([lat,lng],
  zoom)` + mark active. Default-active = the first/most-common city (and the map starts centred there).

## Map layout
- `#kluche-map` becomes a tall, position:relative container (~`calc(100dvh - <navspace>)`, min 420px);
  the Leaflet canvas fills it; the `.map-overlay` is absolute at its bottom (rounded top, translucent,
  safe-area padding). Map controls (zoom) shifted so the overlay doesn't cover them.

## i18n
- `map.jumpToCity` ("Jump to city") in en/sr/ru/tr. Search/filter labels already exist.

## Tests
- render: with mapEnabled + listings in known cities → `#kluche-map-cities` blob present with numeric
  coords + the overlay markup; the relocate JS references `#hero-form`; inline `<script>` still passes
  `new Function`. mapEnabled false → none of it. City blob excludes unknown-coord cities.
- (Console unchanged.)

## Out of scope
Per-area shortcuts (cities only for now); changing the filter popover internals; payment gating.
Pin clustering. The mock's standalone duplicate filters (we relocate the real form instead).
