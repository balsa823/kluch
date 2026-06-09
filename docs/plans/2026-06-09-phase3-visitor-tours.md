# Phase 3 — Visitor accounts + expand-card — Plan

> subagent-driven. Groups: A (backend: visitors+auth+tour), B (white-label modal/auth/tour/call JS), C (console Tours date).

**Setup:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Test DB :5433. Reuse: `hashPassword`/`verifyPassword` (auth.ts), `signToken`/`verifyToken` (token.ts), `createInquiry` (kind/visitorId/tourDate/optional name/contact), `bearerPartner`/`agencyScope`/`bodyLimit`/`getAgencyBySlug`/`getProperty`/`isUuid` (app.ts), `renderAgencySite` + inline-script + i18n `en` dict (render.ts), `leads.tsx` (console Tours).

## Task 1 — visitors table + core (TDD)
- `schema.ts`: `visitors` table (id uuid pk, email text unique, name text, passwordHash text("password_hash"), createdAt timestamptz). Migration; apply to test DB; `generate` clean.
- `packages/core/src/visitors.ts`: `Visitor` type; `createVisitor(db,{email,name?,password})` (lowercase+trim, `hashPassword`); `verifyVisitor(db,email,password)`; `getVisitorById(db,id)`. Export from index.
- Tests: create+verify (case-insensitive, wrong pw → null), getVisitorById. Commit `feat(core): visitors table + create/verify`.

## Task 2 — visitor auth + tour endpoints (TDD, web)
- `app.ts`: `bearerVisitor(c)` (verifyToken, require `payload.t==="visitor"`, getVisitorById). 
- `POST /api/visitor/signup` (bodyLimit 8KB): validate email regex + password length 8..200 + name cap; `createVisitor`; catch unique-violation → 409; return `{token: signToken({sub,t:"visitor"}), visitor:{id,email,name}}`.
- `POST /api/visitor/login`: `verifyVisitor` → 401 or `{token, visitor}`.
- `GET /api/visitor/me`: `bearerVisitor` → 401 or `{visitor:{id,email,name}}`.
- `POST /a/:slug/tour` (bodyLimit): `getAgencyBySlug` (404); `bearerVisitor` (401 if none); read `propertyId` (must be a property of this agency else 400), `tourDate` (required, ≤ 40 chars, else 400), `note` (≤ 2000); `createInquiry({agencyId, propertyId, kind:"tour", visitorId: visitor.id, tourDate, message: note||undefined, name: visitor.name||null, contact: visitor.email})` → 201 `{ok:true}`.
- Tests (api.test.ts): signup→token+visitor, dup email→409, bad email/short pw→400; login bad→401, good→token; me no-token→401, with→visitor; tour without visitor token→401, with→201 + a `tour` lead (listInquiries kind=tour has visitorId+tourDate+contact=email); tour with foreign/forged propertyId→400. Commit `feat(web): visitor auth + tour request endpoints`.

## Task 3 — modal + call icon + tour/auth JS (render.ts)
- Emit `<script type="application/json" id="kluche-listings">${jsonForScript(listings.map(pick))}</script>` (id,name,city,priceMinor,currency,dealType,bedrooms,bathrooms,areaM2,type,photos).
- `.card`: add `data-id="${esc(listing.id)}"` + `role=button`; the existing call control becomes a **phone icon** (📞) button with `data-pid` and `onclick` stopPropagation (keep logging the phone-click + reveal/dial). Card click (not on the icon) opens the modal.
- Modal markup (one hidden `<div id="kluche-modal">` with: gallery img + prev/next, title/price/specs, a 📞 call button, and a tour panel container). Styled with the theme CSS vars.
- Inline JS: 
  - parse the listings JSON into a map by id;
  - `openModal(id)` fills gallery + specs; gallery prev/next cycles photos;
  - call buttons → `phoneClick(pid)` (POST `/a/<slug>/phone-click`, reveal/dial);
  - tour panel: `me()` via `GET /api/visitor/me` with `localStorage.kluche_visitor`; if none → render auth form (email/password + Login/Register toggle → POST signup/login, store token, re-render); if signed in → date `<input type="date">` + note → `POST /a/<slug>/tour` (Bearer visitor) → show "Tour requested".
- i18n: add `card.call`, `modal.tour`, `modal.scheduleTour`, `auth.email`, `auth.password`, `auth.login`, `auth.register`, `tour.date`, `tour.note`, `tour.submit`, `tour.done` to the `en` dict.
- Escape everything; `tel:` guard already exists; visitor token only in localStorage on this origin.
- Tests (render.test.ts): output has `id="kluche-listings"`, a `.card` with `data-id`, the phone-icon button, the `#kluche-modal` container, and the tour form scaffolding. Existing render tests pass (re-point if needed). Commit `feat(web): listing modal with gallery, call icon, and visitor tour/auth`.

## Task 4 — console Tours date formatting
- `apps/app/app/leads.tsx`: render `tourDate` as date-only (e.g. `new Date(d).toLocaleDateString()` or raw `YYYY-MM-DD`), and ensure tour rows show visitor name + contact + tourDate. Typecheck + export. Commit `fix(app): date-only tour date in Leads`.

## Task 5 — deploy + verify (ops)
- Build backend + roll (visitors migration on boot); rebuild console (`--clear`) + SWA deploy.
- Verify on `kluche.me/a/stam`: click a card → modal opens with gallery; the 📞 icon dials + logs a click; register a test visitor → schedule a tour → it appears in Stefan's console Tours tab. Clean up any test visitor/tour rows after.

## Notes
- Visitor token MUST carry `t:"visitor"` and `bearerVisitor` MUST check it; confirm `agencyScope` can't be satisfied by a visitor token (it calls getAgencyUserById/getPartnerUserById by the visitor's sub → null). Add a test that a visitor token gets 403 on `/api/agency/leads`.
