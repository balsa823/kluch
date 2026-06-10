# Agency settings — Design

*Approved 2026-06-10.* A full **Settings** screen in the console where an agency configures the
content that drives its white-label site: homepage hero copy, contact + address, business hours,
Montenegro holidays, social links, and an about blurb. Texts are single-version (shown in all
languages) for now. Holidays use a built-in Montenegro list (toggle on) + custom closures.

## Schema (additive columns on `agencies`)
Text: `heroHeadline`, `heroImageUrl`, `faviconUrl`, `email`, `whatsapp`, `viber`, `address`,
`mapUrl`, `aboutBlurb`, `footerName`, `notifyEmail`, `defaultLang`.
Boolean: `observeHolidays` (default false).
JSONB: `businessHours` (`{ mon..sun: { open: "HH:MM", close: "HH:MM" } | null }`),
`customClosures` (`{ from: "YYYY-MM-DD", to?: "YYYY-MM-DD", label?: string }[]`),
`socials` (`{ facebook?, instagram?, linkedin?, youtube?, tiktok? }`).
*(Existing `phone`, `tagline`, `logoUrl`, `colorPrimary/Accent` stay; branding stays in the Website editor.)*

## Core
- `updateAgencyConfig` whitelist extended to every new field with validation: URLs trimmed +
  shape-checked (http/https or relative), `businessHours` validated to the 7-day `HH:MM` shape,
  `customClosures` to date strings, `socials` to URL strings, `defaultLang` ∈ supported langs,
  caps on text length. Never trust raw patch (no name/slug/refSeq).
- `packages/core/src/holidays.ts`:
  - `orthodoxEaster(year): Date` (Meeus Julian computus → Gregorian).
  - `montenegroHolidays(year): { date: "YYYY-MM-DD"; name: string }[]` — fixed (New Year 1–2 Jan,
    Orthodox Christmas 6–7 Jan, Labour 1–2 May, Independence 21–22 May, Statehood 13–14 Jul) +
    Orthodox Good Friday (Easter−2) + Easter Monday (Easter+1). *(Dates per the agreed list.)*
  - `openStatus(agency, now: Date): { open: boolean; until?: string; holiday?: string }` — converts
    `now` to Europe/Podgorica, checks `customClosures` + (if `observeHolidays`) the national list,
    then the weekday's `businessHours`. Pure (takes `now`) so it's testable.

## Web (render.ts)
- **Hero**: headline = `agency.heroHeadline` || i18n default ("Find Your Perfect Home"); subtitle =
  `agency.tagline`; background = `agency.heroImageUrl` || first listing photo || gradient; `<link
  rel=icon>` from `faviconUrl`.
- **Footer**: a real footer with columns — about blurb + socials (only the filled ones), Explore
  links, **Business hours** with a live **Open now / Closed (holiday?)** badge (computed via
  `openStatus(agency, new Date())` at render), Contact (phone, WhatsApp/Viber, email, address, map
  link). i18n keys for day names, "Open now", "Closed", "Closed (holiday)", "Business hours", etc.

## Console (settings.tsx — full rebuild)
Grouped, saveable form (reuses the `/api/agency/:id/config` endpoint + `agencyScope`):
- **Homepage**: hero headline, hero image URL, favicon URL.
- **Contact**: phone, WhatsApp, Viber, email, address, map URL.
- **Business hours**: 7 rows (day → open/close or a "Closed" toggle).
- **Holidays**: "Observe Montenegro national holidays" switch + a custom-closures editor (add/remove
  date or range + optional label).
- **Social**: Facebook, Instagram, LinkedIn, YouTube, TikTok URLs.
- **About**: about blurb, footer legal name.
- **Leads**: notification email.
Loads current config from `getAgency`/platform `me`; Save → `updateAgencyConfig`. Console i18n keys
(en + sr) for every label/section/day/placeholder. Branding (logo/colours/tagline) remains in Website.

## Tests
- core: `orthodoxEaster` for 2024/2025/2026 (May 5 / Apr 20 / Apr 12); `montenegroHolidays` includes
  the fixed dates + computed Good Friday/Easter Monday; `openStatus` open/closed across weekday hours,
  a closed day, a custom closure, and a national holiday; `updateAgencyConfig` accepts each new field,
  validates bad hours/URLs/lang, ignores non-whitelisted keys.
- web: render hero uses heroHeadline/heroImageUrl when set (fallbacks otherwise); footer shows hours +
  the open/closed badge for a fixed time, socials only when present, address/email/phone.
- console: typecheck + expo export + i18n parity; settings form loads + saves the new fields.

## Out of scope
Actual email sending / auto-reply (store `notifyEmail` only); per-language hero copy; image upload for
hero/favicon (URL fields for now — logo already has upload); a live map embed (link only).

## Holiday dates to confirm
New Year 1–2 Jan · Orthodox Christmas 6–7 Jan · Orthodox Good Friday & Easter Monday (moving) ·
Labour 1–2 May · Independence 21–22 May · Statehood 13–14 Jul. (Agency can add custom closures; the
built-in list can be corrected if any date is wrong.)
