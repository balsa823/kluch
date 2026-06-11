# Cookie-based server-side i18n for the white-label site — Design

*Approved 2026-06-11.* Persist the visitor's language in a **cookie** the server reads, so the
white-label page (`/a/:slug`) renders fully in that language (no English flash, works without JS,
shared links keep the language). The EN/SR/RU/TR selector + the first-visit modal set the cookie.

## Extract dictionary to a server module
`apps/web/src/i18n.ts`: `export type Lang = "en"|"sr"|"ru"|"tr"`; `export const LANGS:
{code:Lang;label:string}[]`; `export const DICT: Record<Lang, Record<string,string>>` (moved verbatim
from the inline `T` object in render.ts); `export function tr(lang: Lang, key: string): string`
(= `DICT[lang]?.[key] ?? DICT.en[key] ?? key`); `export function isLang(x): x is Lang`.

## render.ts — translate server-side
- `renderAgencySite(agency, listings, filters, opts)` — `opts` gains `lang?: Lang` and
  `showLangPicker?: boolean`. `const L = opts.lang ?? "en"; const T_ = (k) => esc(tr(L, k));`
- Every `data-i18n="x">English<` default becomes `data-i18n="x">${T_("x")}<` (keep the attr so live
  switching still works). Pre-set the active selector pill to `L`; `<html lang="${L}">`.
- Embed the dict for the client from the shared module: `var T = ${jsonForScript(DICT)}` and
  `var LANG = ${JSON.stringify(L)}` (no localStorage read needed for the initial state).
- Language modal: render visible (`display:flex`) when `showLangPicker`, hidden otherwise.
- Inline JS: `setLang(code)` writes the **cookie** `kluche_lang=<code>; path=/; max-age=1y;
  samesite=lax` (drop the localStorage dependency, or keep as mirror) then `applyLang()`; pills +
  modal buttons call it; modal backdrop-dismiss → `en`. No first-load storage read (server set LANG).

## app.ts — read the cookie
- At both `/a/:slug` render call sites: read `kluche_lang` from the request cookie (hono `getCookie`),
  `const lang = isLang(c) ? c : "en"`, pass `{ lang, showLangPicker: !cookiePresent }` to
  `renderAgencySite`. No cookie → English + show the picker.

## Tests
- i18n.ts: `tr("sr","nav.about")` returns Serbian, falls back to en then key.
- render: rendering with `{lang:"sr"}` emits Serbian text (hero/about/footer/nav) + active SR pill +
  `<html lang="sr">`; `{showLangPicker:true}` renders the modal visible, false hides it; setLang writes
  a cookie (assert `document.cookie` + `kluche_lang` in the inline JS).
- app/site: request with `Cookie: kluche_lang=sr` → Serbian HTML; no cookie → English + picker shown.

## Out of scope
Cookie consent banner; per-path language; translating listing data. Console (rent.kluche.me) keeps its
own localStorage i18n (separate app).
