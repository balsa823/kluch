# Phase 3 — Visitor accounts + expand-card (tour + call) — Design

*Approved 2026-06-09.* Adds visitor (foreigner) Kluche accounts and a modal listing-detail
on the white-label site where a visitor can register/login and request a tour, plus a phone
call-now icon. Builds on Phase 2 leads (`kind`/`visitorId`/`tourDate` already exist).

## Backend
- **`visitors` table**: `id uuid pk`, `email text unique`, `name text`, `passwordHash text`,
  `createdAt`. Core `visitors.ts`: `Visitor` type, `createVisitor({email,name?,password})`
  (lowercase+trim email, reuse `hashPassword`), `verifyVisitor(email,password)`,
  `getVisitorById`.
- **Visitor token**: `signToken({ sub: visitorId, t: "visitor" }, secret, TTL)`. `bearerVisitor(c)`
  resolver: verify token, require `payload.t === "visitor"`, `getVisitorById(sub)`. Distinct from
  partner/agency-user tokens (those have no `t:"visitor"`; this one isn't accepted by `agencyScope`).
- **Endpoints** (public, JSON, CORS, bodyLimit):
  - `POST /api/visitor/signup` `{email,password,name?}` → validate (email shape, password ≥ 8,
    caps) → `createVisitor` → `{ token, visitor:{id,email,name} }`; 409 on duplicate email.
  - `POST /api/visitor/login` `{email,password}` → `verifyVisitor` → 401 or `{ token, visitor }`.
  - `GET /api/visitor/me` (bearer visitor) → `{ visitor }` or 401.
  - `POST /a/:slug/tour` (bearer visitor required, bodyLimit): resolve agency by slug (404);
    read `propertyId` (validate belongs to agency, else 400), `tourDate` (required), `note?`;
    `createInquiry({ agencyId, propertyId, kind:"tour", visitorId, tourDate, message:note,
    name: visitor.name, contact: visitor.email })` → 201; 401 without visitor token.

## White-label site (render.ts: server HTML + inline JS)
- Embed the page's listings as a `<script type="application/json" id="kluche-listings">` blob
  (id, name, city, priceMinor, currency, dealType, bedrooms, bathrooms, areaM2, type, photos[]).
- Each `.card` is clickable (`data-id`) → opens a **modal**: photo gallery (prev/next over photos),
  specs, a **call** phone-icon button, and a **Schedule-a-tour** panel. Backdrop/X closes.
- **Call icon (📞)** on the card (separate control, `stopPropagation`) and in the modal: reveal/dial
  `tel:` + POST the Phase-2 phone-click (with the listing id).
- **Tour panel**: read visitor token from `localStorage("kluche_visitor")`; `GET /api/visitor/me`
  on open to confirm. If signed out → email+password form with a Login/Register toggle →
  `/api/visitor/signup|login` → store token. If signed in → date input + note → `POST /a/:slug/tour`
  → confirmation. All inline JS; i18n keys added to the `en` dict.

## Console
- Tours tab already lists `kind=tour` leads; they now carry visitor name/email + tourDate + note.
- Fix `leads.tsx` tour-date rendering to **date-only** (avoid the timezone-shifted time).

## Security / constraints
- Visitor token carries `t:"visitor"`; `bearerVisitor` requires it; `agencyScope` never accepts it.
- Reuse `hashPassword`/`verifyPassword`/`signToken`/`verifyToken`. Password ≥ 8, field caps,
  bodyLimit on all new POSTs. Forged-propertyId guard on the tour endpoint. No email verification.

## Tests
- core: createVisitor/verifyVisitor (case-insensitive, wrong pw → null); tour lead via createInquiry.
- web: signup (dup → 409), login (bad → 401), me (no token → 401); tour requires visitor token
  (401 without), stores a tour lead with visitorId+tourDate+visitor contact, forged property → 400/dropped.
- render: listings JSON blob present; card has data-id + modal markup + phone icon; tour/auth forms.
- console: Tours rows show visitor + date-only date.
