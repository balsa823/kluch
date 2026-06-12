# Map view bottom overlay — Implementation Plan

> **For Claude:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** When an agency's white-label site is in Map view, float a bottom overlay over the map with (1) city shortcut chips that fly the map to that city, and (2) the existing hero search box + filter chips (relocated, not duplicated), so visitors filter without scrolling the page.

**Architecture:** Server-rendered `apps/web/src/render.ts` (one big HTML template literal with inline CSS + inline `<script>`). We add a `#kluche-map-cities` JSON blob (distinct cities among this page's listings that resolve via `cityCoords`), make `#kluche-map` a tall position:relative container with an absolute `.map-overlay` at the bottom, and on `showMap()` relocate the existing `#hero-form` DOM node into the overlay (preserving its listeners) + add a class flipping popovers to open upward; `showList()` moves it back.

**Tech Stack:** Hono, TypeScript, Leaflet (CDN), `@kluche/locations` (`cityCoords`). Tests: vitest in `apps/web/src/__tests__/render.test.ts`.

**CRITICAL constraint:** The inline `<script>` is inside a template literal. Regex literals get their `\/`/`\.` escapes stripped → SyntaxError kills the whole script. **Use string ops only.** A test guards this: `expect(() => new Function(scriptBody)).not.toThrow()`.

---

### Task 1: Server-side city shortcuts blob + i18n key

**Files:**
- Modify: `apps/web/src/render.ts` (~line 320–341, the `mapEnabled` block; ~line 991 markup)
- Modify: `apps/web/src/i18n.ts` (add `map.jumpToCity` to en/sr/ru/tr)
- Test: `apps/web/src/__tests__/render.test.ts`

**Step 1: Write failing tests**

Add to render.test.ts (a describe block "map overlay"). Assume there's an existing helper that renders the page with an agency + listings; mirror existing map tests. Tests:
- With `mapEnabled: true` + listings in known cities (e.g. `city: "Podgorica"`, `city: "Budva"`) → rendered HTML contains `id="kluche-map-cities"` and the JSON parses to an array including objects `{ name, lat, lng, zoom }` with numeric lat/lng (e.g. Podgorica ~42.44, ~19.26).
- A listing with an unknown city (e.g. `city: "Atlantis"`) is excluded from the cities blob.
- With `mapEnabled: false` → no `kluche-map-cities` in output.

**Step 2: Run → fail.** `cd apps/web && pnpm test render` (expect new assertions fail).

**Step 3: Implement.**
In render.ts, inside the existing `if (mapEnabled)` block (after `mapAreas` is built), derive cities:
```ts
type MapCity = { name: string; lat: number; lng: number; zoom: number };
const mapCities: MapCity[] = [];
if (mapEnabled) {
  const seen = new Map<string, MapCity>();
  for (const l of listings) {
    if (seen.has(l.city)) continue;
    const c = cityCoords(l.city);
    if (!c) continue;
    // Bigger cities → slightly wider zoom; default 14, Podgorica/Nikšić 13.
    const zoom = l.city === "Podgorica" || l.city === "Nikšić" ? 13 : 14;
    seen.set(l.city, { name: l.city, lat: c.lat, lng: c.lng, zoom });
  }
  mapCities.push(...seen.values());
}
```
(Keep insertion order = order cities first appear in listings; first = default-active.)

Add the blob next to the areas blob (~line 991):
```ts
<script type="application/json" id="kluche-map-cities">${jsonForScript(mapCities)}</script>
```

In i18n.ts add to each dict: `"map.jumpToCity":"Jump to city"` (en) / `"Skoči na grad"` (sr) / `"Перейти к городу"` (ru) / `"Şehre git"` (tr).

**Step 4: Run → pass.**

**Step 5: Commit** `feat(web): server-side city shortcuts blob for map overlay`.

---

### Task 2: Overlay markup + CSS (tall map container, bottom overlay, popover-upward)

**Files:**
- Modify: `apps/web/src/render.ts` (map CSS block ~833–848; map markup ~987–991)
- Test: `apps/web/src/__tests__/render.test.ts`

**Step 1: Write failing tests.**
- With `mapEnabled: true` → output contains `class="map-overlay"` and an element with `id="map-overlay-cities"` (the chip container) and `id="map-overlay-filters"` (the empty slot the hero-form is moved into).
- The map-note text still present.

**Step 2: Run → fail.**

**Step 3: Implement.**
Replace the map `<section>` markup (~987–990) with:
```ts
<section id="kluche-map" style="display:none">
  <div id="kluche-map-canvas"></div>
  <div class="map-overlay">
    <div class="map-overlay-cities-wrap">
      <p class="map-overlay-label" data-i18n="map.jumpToCity">${T_("map.jumpToCity")}</p>
      <div class="map-overlay-cities" id="map-overlay-cities"></div>
    </div>
    <div id="map-overlay-filters"></div>
    <p class="map-note" data-i18n="map.approx">${T_("map.approx")}</p>
  </div>
</section>
```
(The `map-overlay-cities-wrap` is hidden by JS if no cities resolve.)

CSS — change `#kluche-map`/`#kluche-map-canvas` and add overlay styles (mirror brand/map-view-mockup.html):
```css
#kluche-map { position: relative; margin: 0 0 1rem; }
#kluche-map-canvas { height: calc(100dvh - 220px); min-height: 420px; width: 100%; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(31,58,92,.12); }
.map-overlay {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 500;
  background: rgba(255,255,255,0.97); backdrop-filter: blur(6px);
  border-top: 1px solid var(--color-accent); border-radius: 18px 18px 0 0;
  box-shadow: 0 -8px 30px rgba(0,0,0,.18);
  padding: 0.7rem 0.8rem calc(0.8rem + env(safe-area-inset-bottom,0px));
  display: flex; flex-direction: column; gap: 0.6rem;
}
.map-overlay-label { font-size: 0.7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #8a8676; margin: 0 0 .35rem .15rem; }
.map-overlay-cities { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: .15rem; -webkit-overflow-scrolling: touch; }
.map-overlay-cities::-webkit-scrollbar { display: none; }
.map-city { flex: 0 0 auto; border: 1.5px solid var(--color-accent); background: #fff; border-radius: 999px; padding: .42rem .85rem; font: inherit; font-size: .9rem; font-weight: 600; color: var(--color-primary); cursor: pointer; white-space: nowrap; }
.map-city:hover { border-color: var(--color-primary); }
.map-city.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
/* hero-form relocated into overlay: compact + popovers open UPWARD */
.map-overlay #hero-form { margin: 0; }
.map-overlay .chips { margin: 0; gap: 1.1rem; overflow-x: auto; flex-wrap: nowrap; padding-bottom: .1rem; }
.map-overlay .chips::-webkit-scrollbar { display: none; }
.map-overlay .pop { top: auto; bottom: calc(100% + 14px); }
.map-overlay .pop::before { top: auto; bottom: -8px; box-shadow: 3px 3px 6px rgba(0,0,0,.05); }
.map-note { margin: 0; color: #6b6557; font-size: 0.78rem; }
```

**Step 4: Run → pass.**

**Step 5: Commit** `feat(web): map overlay markup + upward-popover CSS`.

---

### Task 3: Relocate hero-form + city flyTo JS

**Files:**
- Modify: `apps/web/src/render.ts` (map IIFE ~1551–1654)
- Test: `apps/web/src/__tests__/render.test.ts`

**Step 1: Write failing tests.**
- With `mapEnabled: true` → the inline `<script>` body still passes `new Function(scriptBody)` (extract the bare script body the same way the existing guard test does — reuse that helper).
- The script references `"kluche-map-cities"`, `"map-overlay-filters"`, `"hero-form"`, and `"flyTo"` (string `.includes` checks).

**Step 2: Run → fail.**

**Step 3: Implement.** Inside the map IIFE:

Add a flag + element refs near the top of the IIFE:
```js
var heroForm = document.getElementById("hero-form");
var filterSlot = document.getElementById("map-overlay-filters");
var heroHost = heroForm ? heroForm.parentNode : null; // the <header> to move it back to
var citiesBox = document.getElementById("map-overlay-cities");
var citiesWrap = citiesBox ? citiesBox.parentNode : null;
```

Build city chips (string ops only — no regex):
```js
var cities = [];
try {
  var cn = document.getElementById("kluche-map-cities");
  cities = JSON.parse(cn ? cn.textContent : "[]") || [];
} catch (e) { cities = []; }
if (!cities.length && citiesWrap) citiesWrap.style.display = "none";
cities.forEach(function (c, i) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "map-city" + (i === 0 ? " active" : "");
  b.textContent = String(c.name);
  b.addEventListener("click", function () {
    var all = citiesBox.querySelectorAll(".map-city");
    for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
    b.classList.add("active");
    if (leafletMap) { try { leafletMap.flyTo([c.lat, c.lng], c.zoom, { duration: 0.6 }); } catch (e) {} }
  });
  if (citiesBox) citiesBox.appendChild(b);
});
```

In `showMap()`: after `initMap()` + `invalidateSize()`, relocate the form into the overlay (guarded so it only moves once / when not already there):
```js
if (heroForm && filterSlot && heroForm.parentNode !== filterSlot) {
  filterSlot.appendChild(heroForm);
}
```
In `showList()`: move it back:
```js
if (heroForm && heroHost && heroForm.parentNode !== heroHost) {
  heroHost.appendChild(heroForm);
}
```
Note: when relocated into `.map-overlay`, the existing "close popovers when clicking outside" handler still works (it's document-level). The upward-popover CSS is purely scoped by `.map-overlay .pop`.

If the default-active city exists, the existing `fitBounds`/initial-center logic in `initMap` still runs first; that's fine — the city chips are an explicit override. (Do NOT auto-flyTo on init; keep current fitBounds behaviour.)

**Step 4: Run → pass.** Also run the full `apps/web` test suite.

**Step 5: Commit** `feat(web): relocate hero-form into map overlay + city flyTo`.

---

### Task 4: Headless verification + deploy

**Files:** none (verify + deploy)

**Step 1:** Build the site locally / run existing render snapshot; confirm no inline-script SyntaxError via the guard test.

**Step 2:** (Controller does this, not subagent) Merge to master, push, `az acr build`, `terraform apply`, wait for new revision, headless-Chrome check: Map view shows overlay with city chips, tapping a chip flies the map, filter chips open upward, 0 console errors.

---

## Out of scope
Per-area shortcuts; changing popover internals; payment gating; pin clustering; the mock's duplicate standalone filters (we relocate the real form).
