# Phase 2 — Agency phone + click tracking + console leads tabs — Plan

> subagent-driven. Backbone for Phase 3 too.

**Goal:** Show Stam's phone on its listings; clicking a listing's call button reveals/dials it AND logs a `phone_click` lead; the console gets a Leads area with Tours / Inquiries / Clicks tabs. Stam phone to set: **+382 69 546 092**.

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Tests: core/web vitest (test DB :5433); console typecheck + `expo export --platform web --output-dir /tmp/v --clear`.

## Task 1 — leads schema + agency phone (db) + core
- `inquiries`: add `kind text not null default 'inquiry'`, `visitorId uuid` (nullable, no FK yet), `tourDate text` (nullable); **drop NOT NULL on `name` and `contact`** (a phone_click has neither). `agencies`: add `phone text` (nullable). Migration (generate; the NOT NULL drop may need hand-edit — `ALTER COLUMN name DROP NOT NULL`, same for contact). Apply to test DB; confirm `generate` clean.
- core `inquiries.ts`: `CreateInquiryInput` gains `kind?`, `visitorId?`, `tourDate?`, and `name`/`contact` become optional; `createInquiry` passes them. `listInquiries(db, agencyId, opts?: { kind?: string })` filters by kind when given. `Inquiry` type auto-updates.
- core `agencies.ts`: `updateAgencyConfig` whitelist gains `phone` (so it can be set/edited); add nothing else.
- Tests: createInquiry with kind='phone_click' + no name/contact succeeds; listInquiries({kind:'phone_click'}) filters; updateAgencyConfig sets phone.
- Commit `feat(core): leads kind/visitor/tourDate + agency phone`.

## Task 2 — phone-click endpoint + leads list API (web)
- `POST /a/:slug/phone-click` (public, `bodyLimit` 8KB): resolve agency by slug (404); read `propertyId` (validate is a property of this agency, like the inquiry endpoint — else null); `createInquiry({ agencyId, propertyId, kind: 'phone_click' })`; return `{ phone: agency.phone }` as JSON (so the client can dial). No personal data required.
- `GET /api/agency/leads?kind=inquiry|tour|phone_click` (partner-authed via `agencyScope`; 403 if none): `listInquiries(db, scope, { kind })` → `{ leads }`. Include the property name (join or per-row lookup) so the console can show context.
- Tests: phone-click stores a phone_click lead (and 404 unknown slug, forged propertyId dropped); leads endpoint returns only the requested kind for the scoped agency, 403 without a token.
- Commit `feat(web): phone-click endpoint + partner leads list`.

## Task 3 — phone button on listings (render.ts)
- If `agency.phone`, render a **"Show number"** / call button on each card (and/or the contact section) carrying the listing's id (`data-pid`). Inline JS: on click → `POST /a/<slug>/phone-click {propertyId}` (fire-and-forget), then reveal the number + set `location.href = "tel:" + phone` (or show the number text). Escape phone via `esc`/a `tel:`-safe check.
- i18n: add `card.call` / `card.showNumber` to the `en` dict.
- Test (render.test.ts): when `agency.phone` set, a card contains the call button with `data-pid`; absent when no phone.
- Commit `feat(web): per-listing call button (logs a phone-click)`.

## Task 4 — console Leads area (Tours / Inquiries / Clicks)
- `apps/app/lib/api.ts`: `listLeads(token, kind)` → `GET /api/agency/leads?kind=`; a `Lead` type.
- New `apps/app/app/leads.tsx`: a screen inside `ConsoleLayout` with three tabs (Tours / Inquiries / Clicks) that fetch `listLeads(token, kind)` and render rows (listing name, contact/visitor, message/tourDate, time). Empty states.
- Sidebar: add a **Leads** nav item (top menu, under Listings) → `/leads`; register `leads` screen in `_layout.tsx`.
- Verify typecheck + export. Commit `feat(app): Leads area with Tours/Inquiries/Clicks tabs`.

## Task 5 — deploy + set Stam phone (ops)
- Build backend + roll (migration applies); rebuild console (`--clear`) + SWA deploy.
- One-off: set Stam `agencies.phone = '+382 69 546 092'` (via `updateAgencyConfig` or SQL).
- Verify: a Stam listing shows the call button → clicking logs a phone_click (check Clicks tab + DB); submit an inquiry → shows in Inquiries tab.

## Notes
- Reuse `agencyScope`/`bearerPartner`/`bodyLimit`; the forged-propertyId guard pattern from the inquiry endpoint. YAGNI: no visitor linkage yet (Phase 3 fills `visitorId`/`tourDate`/the Tours tab content).
