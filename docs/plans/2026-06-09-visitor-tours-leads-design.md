# Filters + Phone Tracking + Visitor Tours — Design (phased)

*Approved 2026-06-09.* Three phases sharing one data backbone.

## Shared data model
Extend `inquiries` into a unified leads concept:
- add `kind text not null default 'inquiry'` (`inquiry` | `tour` | `phone_click`)
- add `visitorId uuid` (nullable, → visitors, added in Phase 3)
- add `tourDate text` (nullable; preferred date as entered)
Console tabs filter by `kind`. `createInquiry`/`listInquiries` extended to accept/return `kind`.

## Phase 1 — Filters (polish + fix)  [build now]
- Add a **Type** `<select name="type">` to the agency-site search form: Any / Residential / Land /
  Commercial, pre-selected from `filters.type`. `parseSearchFilters` already validates `type`.
- **Fix price units:** prices are stored in **cents** (`priceMinor`) but the Min/Max boxes take **euros**.
  In `parseSearchFilters`, multiply `minPrice`/`maxPrice` by 100 so the euro inputs filter correctly.
  (Label the inputs "Min price (€)" / "Max price (€)".)
- Verify City/Type/Min/Max/Bedrooms all filter; light restyle of the search bar.
- Tests: `parseSearchFilters` converts €→cents; `searchProperties` filters by `type`; render form
  contains the Type select with options.

## Phase 2 — Agency phone + click tracking + console inbox tabs
- `agencies.phone text` (nullable). Set Stam's number (provided by user). Shown on listings as a
  "Show / call number" control.
- Public `POST /a/:slug/phone-click` (body: `propertyId`, body-limit, anonymous) → creates a
  `phone_click` lead (agencyId, propertyId, kind='phone_click', + visitorId if a visitor token is
  present). Client reveals/dials `tel:` on click.
- Partner-authed `GET /api/agency/leads?kind=` → `listInquiries(agencyId, {kind})`.
- Console **Leads** area with **Tours / Inquiries / Clicks** tabs (filter by kind), newest first,
  each row showing the listing + contact/visitor + time. New sidebar nav item.

## Phase 3 — Visitor accounts + schedule-a-tour
- `visitors` table: id, email unique, name, passwordHash, createdAt. Core
  `createVisitor`/`verifyVisitor`/`getVisitorById`. Visitor token via `signToken` with a `visitor`
  claim (distinct from partner tokens; verified by a `bearerVisitor` resolver).
- Public endpoints: `POST /api/visitor/signup`, `/api/visitor/login`, `GET /api/visitor/me`.
- On the white-label site: client JS for visitor signup/login (token in localStorage on that
  origin) + a **"Schedule a tour"** button → if not logged in, prompt; if logged in, a form
  (preferred date + note) → `POST /a/:slug/tour` → `tour` lead with `visitorId`.
- Tours appear in the console Tours tab with the visitor's name/email.

## Testing (per phase)
- P1: parseSearchFilters €→cents + type; searchProperties type filter; render Type select.
- P2: phone-click endpoint stores a phone_click lead (anon + with visitor); leads list filters by
  kind; console tabs render; agency phone shows + click fires.
- P3: visitor signup/login/me; tour endpoint requires a visitor token, stores a tour lead with date;
  console Tours shows visitor.

## Out of scope
Real availability/time-slot booking; visitor email verification/password reset; notifications/email.
