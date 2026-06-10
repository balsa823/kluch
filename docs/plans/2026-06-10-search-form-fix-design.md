# White-label search form fix + polish — Design

*Approved 2026-06-10.*

## Root cause (the "I can't select anything")
`render.ts` `applyLang()` runs on every page load and does
`document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(...))`.
The search-form and contact-form labels are written `<label data-i18n="search.city">City
<input name="city"></label>` — the translated element *contains* the form control, so setting
`textContent` deletes the `<input>`/`<select>`. Every field is destroyed on load, in any language.

## Fixes
1. **Stop clobbering controls.** Wrap each label's caption in `<span data-i18n="…">…</span>`
   (search + contact forms) so translation only rewrites the span. Belt-and-suspenders: make
   `applyLang` skip elements that have child *elements* (only translate leaf text nodes).
2. **Compose filters.** Rent/Sale tabs carry the current city/price/type/bedrooms/code params
   instead of dropping them; add a **Clear** link when any filter is active.
3. **Polish.** Tidy search-bar layout (field sizing, full-height button, mobile wrap). Render
   **"Price on request"** instead of €0 for listings with no/zero price.

## Tests (render.test.ts)
- Regression guard: after constructing the page, the search form still contains its `name="city"`
  input and `name="type"` select (i.e. the markup doesn't nest controls under the translated node).
- Tab links preserve active filters; Clear link present only when a filter is set.
- A listing with priceMinor 0/null renders "Price on request", a priced one renders the amount.

## Out of scope
Moving deal-type into the form as a select (tabs stay the deal-type control); search-by-map; saved searches.
