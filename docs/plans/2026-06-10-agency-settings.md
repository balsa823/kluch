# Agency settings — Plan

> subagent-driven. Groups: A (schema + core: config fields + holidays/open-status + validation +
> tests), B (web render: hero-from-settings + real footer w/ hours/open-now/socials + i18n + tests),
> C (console Settings screen rebuild + api.ts + i18n), D (deploy). Review each group.

**Goal:** Agencies configure homepage hero copy, contact/address, business hours, MNE holidays,
socials, and about — from a Settings screen — and it all renders on the white-label site.

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Test DB :5433. Console:
no unit runner (typecheck + expo export + `pnpm check:i18n`). Reuse: `updateAgencyConfig`/`getAgency`
(agencies.ts), `/api/agency/:id/config` + `agencyScope` (app.ts), `renderAgencySite` footer/hero
(render.ts), `AgencyConfig`/`updateAgencyConfig` (api.ts), the Website editor's form patterns + `useT`.

---

## Task 1 — schema + holidays + config core (TDD)
**Files:** `packages/db/src/schema.ts` (+ migration), `packages/core/src/agencies.ts`,
`packages/core/src/holidays.ts` (new) + export, tests.
- schema: add to `agencies` — text `heroHeadline,heroImageUrl,faviconUrl,email,whatsapp,viber,address,
  mapUrl,aboutBlurb,footerName,notifyEmail,defaultLang`; boolean `observeHolidays` default false;
  jsonb `businessHours,customClosures,socials` (import `jsonb`,`boolean` from drizzle pg-core).
  Generate additive migration; apply to test DB; `generate` clean.
- `holidays.ts`:
  - `export function orthodoxEaster(year): Date` — Meeus Julian algorithm, return the Gregorian Date.
  - `export function montenegroHolidays(year): { date: string; name: string }[]` — fixed dates above
    + `Good Friday` (Easter−2) + `Easter Monday` (Easter+1), each as `YYYY-MM-DD`.
  - `export function openStatus(agency, now: Date): { open: boolean; holiday?: string }` — get the
    Podgorica-local Y-M-D + weekday + HH:MM via `Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Podgorica',...})`;
    if a customClosure or (observeHolidays && national holiday) matches the date → `{open:false,holiday}`;
    else read `businessHours[weekday]`; open iff time within [open,close).
- `agencies.ts` `updateAgencyConfig`: extend the whitelist with all new fields. Validate: text caps;
  URL fields trimmed + `safeUrl`-style check (allow http/https/relative, reject `javascript:`);
  `businessHours` must be the 7-key shape with `HH:MM`|null (throw "Invalid hours" otherwise);
  `customClosures` an array of `{from,to?,label?}` with date-shaped strings; `socials` an object of
  URL strings; `defaultLang` ∈ ["en","sr","ru","tr"]. Keep colour validation.
- Tests (`agencies.test.ts`, `holidays.test.ts`): orthodoxEaster 2024=2024-05-05, 2025=2025-04-20,
  2026=2026-04-12; montenegroHolidays(2026) contains 2026-01-01, 2026-07-13, and Good Friday/Easter
  Monday around Apr 10/13; openStatus open within hours, closed outside, closed on a Sunday with
  null hours, closed on a custom closure, closed on a national holiday when observeHolidays; config
  update sets each new field, rejects bad hours/url/lang, ignores junk keys.
- Commit `feat(core): agency settings fields + MNE holidays + open-status`.

## Task 2 — web render: hero + footer (TDD)
**Files:** `apps/web/src/render.ts`, render tests.
- Hero: `agency.heroHeadline || t("hero.title")` for the H1; keep tagline as subtitle; background =
  `cssUrl(agency.heroImageUrl) || first-listing-photo || gradient`; `<link rel="icon">` from
  `safeUrl(agency.faviconUrl)` when set.
- Replace the minimal footer with a real one: columns —
  - **About**: `agency.aboutBlurb` (fallback to the existing about copy) + socials icons (render only
    the filled `agency.socials.*`, each `safeUrl`'d).
  - **Hours**: 7 day rows from `agency.businessHours` (localized day names) + an **Open now / Closed
    / Closed (holiday)** badge from `openStatus(agency, new Date())`.
  - **Contact**: phone (tel:), WhatsApp/Viber, email (mailto:), address, map link.
  - Legal line: `agency.footerName || agency.name` + "Powered by Kluche".
- i18n (en/sr/ru/tr): `hero.title`, `footer.hours`, `footer.openNow`, `footer.closed`,
  `footer.closedHoliday`, `footer.contact`, `footer.explore`, `day.mon..day.sun`, `footer.closedDay`.
- Escape everything. Tests: hero uses heroHeadline/heroImageUrl when set + fallbacks; footer renders
  hours + the badge (pass a known agency/time via the exported openStatus or assert markers), socials
  only when present, address/email present.
- Commit `feat(web): white-label hero + footer driven by agency settings`.

## Task 3 — console Settings screen (rebuild)
**Files:** `apps/app/app/settings.tsx` (rebuild), `apps/app/lib/api.ts`, `apps/app/lib/i18n/dict.ts`.
- `api.ts`: widen `AgencyConfig`/add a `Settings` type with all new fields; `updateAgencyConfig`
  already POSTs the body — ensure it carries the new fields. Add a way to load current settings (the
  platform `me`/`getAgency` already returns the agency; thread the full agency into Settings — fetch
  via existing me endpoint or add `getAgencySettings`).
- `settings.tsx`: grouped, scrollable form (reuse Website editor field/section styling + `useT`):
  Homepage (heroHeadline, heroImageUrl, faviconUrl), Contact (phone, whatsapp, viber, email, address,
  mapUrl), Business hours (7 rows: day label + open/close TextFields + a Closed toggle that nulls the
  day), Holidays (observe switch + add/remove custom closures), Social (5 URL fields), About
  (aboutBlurb, footerName), Leads (notifyEmail). Load current values, Save → `updateAgencyConfig`,
  show saved/err state. Keep it usable on web.
- i18n: add `settings.*` keys (section titles, every field label, day names, toggles, Save, saved/err)
  to en + sr, key-aligned (`pnpm check:i18n`).
- Verify typecheck + `expo export --platform web --output-dir /tmp/v --clear` + `pnpm check:i18n`.
- Commit `feat(app): full agency Settings screen`.

## Task 4 — deploy (ops)
- Merge, push. Build backend image + `terraform apply` (migration on boot) + health. Rebuild console
  (`expo export --clear`) + SWA deploy. Verify on rent.kluche.me: Settings loads, edit hero headline +
  hours + a social + address for Stam, Save; then on kluche.me/a/stam confirm the hero headline, the
  footer hours + Open/Closed badge, socials, and address all reflect it. Revert any throwaway edits.

## Notes
- Migration additive (ADD COLUMN), like 0010–0012.
- `openStatus` must be pure (take `now`) and tz-correct (Europe/Podgorica) — test with fixed dates.
- jsonb columns: validate shape in `updateAgencyConfig` before persisting; render must tolerate null/
  partial values (agencies that haven't configured hours/socials yet → footer hides those bits).
- Don't translate agency data; only chrome. Hero/about texts are single-version (shown as-is).
