# Console i18n + Leads tabs in header — Design

*Approved 2026-06-10.* Make the entire console (rent.kluche.me / apps/app) bilingual
(English + a single "Crnogorski / Srpski" local option) with a remembered language switcher,
and move the Leads Tours/Inquiries/Clicks tabs out of the page body into the top header bar.

## Languages
Two locales: `en` and `sr` (one local option, labelled **"Crnogorski / Srpski"** — Montenegrin
and Serbian Latin are effectively identical for UI copy). Default `en`. Choice persisted in
`localStorage` under `kluche_console_lang` (web console). `t()` falls back en → key.

## i18n core (`apps/app/lib/i18n`)
- **`dict.ts`** — pure module (no RN imports): `type Lang = "en" | "sr"`; `const dict: Record<Lang,
  Record<string, string>>` keyed by screen (`nav.*`, `leads.*`, `listings.*`, `website.*`,
  `settings.*`, `login.*`, `common.*`). Pure so it can be key-parity-checked outside RN.
- **`I18nProvider` + `useT()`** (`index.tsx`) — React context holding `lang`; `useT()` returns
  `{ t, lang, setLang }` where `t(key, vars?)` looks up `dict[lang][key] ?? dict.en[key] ?? key`
  and interpolates `{name}`-style vars. `setLang` writes localStorage (guarded try/catch).
  Initial lang read from localStorage on mount.
- **`LangSwitcher`** component — compact `EN | ME/SR` toggle calling `setLang`.

## Layout / header (`components/ConsoleLayout`)
- `ConsoleLayout` gains a sticky **top header bar**: left = `title` + optional `subtitle` +
  optional `tabs` slot; right = `<LangSwitcher/>` (present on every screen, remembered).
- New props: `title?: string; subtitle?: string; tabs?: ReactNode`. Screens drop their bespoke
  topbars and pass these instead. Login is outside ConsoleLayout — it gets the switcher inline.

## Leads
- Tours / Inquiries / Clicks render in the header `tabs` slot (not the content body). Labels,
  subtitle ("N clicks across M listings"), empty states, and click-group "N clicks / last …"
  all use `t()`.

## Scope of translation
All console surfaces: Sidebar (Listings/Leads/Website/Settings/Logout + user), Leads, Listings
(agency.tsx: add/edit/delete, status labels, validation messages), Website editor, Settings,
Login, shared buttons/empty/loading/error strings. `law.tsx` ("Coming soon") too.

## Verification
The console has no unit-test runner, so:
- **Key-parity check** (`apps/app/lib/i18n/__check__/parity.ts` run via `tsx`): asserts `en` and
  `sr` define exactly the same key set; exits non-zero on mismatch. Wire as a `pnpm` script.
- `pnpm --filter @kluche/app typecheck` + `expo export --platform web` must pass.
- Live: switch language on rent.kluche.me, confirm strings change + persist across reload; Leads
  tabs appear in the header.

## Out of scope
RTL; per-user server-side language preference (local only for now); translating the white-label
public site (already has its own en/sr/ru/tr); a third distinct Montenegrin locale.
