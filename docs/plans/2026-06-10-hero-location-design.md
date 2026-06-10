# Hero search redesign + Location (city/area) filter — Design

*Approved 2026-06-10.* Replace the white-label site's field-grid search with a keypartners-style
hero: a big search box + a yellow/brand Search button, and a row of **chip → popover** filters
(**Location · Price · Listing · Beds · Type**). Add an editable **`area`** field to listings so the
Location filter can target a whole Montenegro city or specific city areas (multi-select). Reference
mockup: `brand/search-mockup.html`.

## Location data (single source of truth)
- New pure, dependency-free package **`@kluche/locations`** exporting `MNE_LOCATIONS:
  { city: string; areas: string[] }[]` (fixed Montenegro cities + curated areas) and helpers
  `cityNames()`, `areasFor(city)`, `isKnownArea(city, area)`. Imported by **both** `@kluche/web`
  (render + parse/validate) and `@kluche/app` (editor dropdowns) so the lists never drift.
  - If the Expo/metro bundler can't resolve the workspace package cleanly, fall back to a duplicated
    `apps/app/lib/locations.ts` guarded by a parity check — but try the shared package first.

## Data model
- `properties.area text` (nullable). Additive migration. Existing 1,232 listings have `area = null`
  → they match whole-city filtering immediately; area filtering applies once an agent tags them.
- `updateProperty` whitelist gains `area`; `createProperty` accepts optional `area`.

## Search semantics
- `SearchFilters.locations?: { city: string; area?: string }[]`. In `searchConditions`, the
  locations OR together: a `{city}` entry → `properties.city = city`; a `{city, area}` entry →
  `city = city AND area = area`. No locations → no location constraint.
- Free-text box → `q`: if it matches the ref-code shape (`^[A-Z]{2,6}-\d+$`) → exact `refCode`,
  else ilike on name/address. (Keeps the existing `code` behaviour folded in.)
- Price (euros→cents), `bedrooms` (gte), `type`, `dealType` unchanged.

## White-label hero (render.ts)
- Hero: title (agency tagline), a search `<input name="q">` + Search button (agency accent colour).
- Chip row, each a button toggling a popover (mirrors the mockup, with up-caret):
  - **Location** — searchable, multi-select list of cities (whole city) + indented areas; selected
    items become hidden `<input name="loc" value="City">` / `value="City|Area">` on submit; chip
    shows the name or "Location · N" with ✕.
  - **Price** — min/max € inputs. **Listing** — Any/For rent/For sale. **Beds** — Any/1+/2+/3+/4+.
    **Type** — Any/Residential/Land/Commercial. Each writes its hidden form field; active chip gets ✕.
- One GET `<form>`; inline JS manages popovers + selection + serialising hidden inputs, then submit.
- The `MNE_LOCATIONS` list is embedded as a JSON script blob for the popover. i18n (en/sr/ru/tr)
  for all chip labels/options/Search/Any. Pagination + URL round-trip preserved (incl. repeated `loc`).

## Console editor (agency.tsx)
- Add + Edit forms: **City** = dropdown of `cityNames()`; **Area** = dropdown of `areasFor(city)`
  (optional "—"), reset when city changes, hidden when the city has no areas. `createListing`/
  `updateListing` send `area`. Console i18n keys for the labels.

## Tests
- `@kluche/locations`: cities non-empty, areas belong to a city, helper lookups.
- core: `updateProperty` sets area (and ignores junk); `createProperty` with area; `searchConditions`
  location OR (whole-city vs city+area, multiple), exact-vs-ilike for `q`.
- web: `parseSearchFilters` parses repeated `loc` + `q` (code vs text); render output has the search
  box, the chip row, the embedded locations blob, and an active-chip ✕; `/a/:slug?loc=Budva|Bečići`
  returns only matching listings.
- console: typecheck + expo export; editor area dropdown reflects city; i18n parity.

## Out of scope
Map search; geocoding; auto-tagging existing listings' areas (agents tag via the editor); a third
distinct Montenegrin locale.
