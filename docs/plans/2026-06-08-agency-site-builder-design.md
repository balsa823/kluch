# Agency Website Builder — Design

*Approved 2026-06-08.*

## Goal
On the agency dashboard, let an agency theme its white-label site (logo, preset colour
scheme, tagline) with a live preview, and open it via a "View site" button. The site is
served at a name-derived path `kluche.me/a/<slug>` (no DNS needed yet).

## 1. Name-derived slug (`packages/core`)
- `slugify(name)`: lowercase → strip diacritics (NFD + remove combining marks) → non-alphanumeric
  to `-` → collapse repeats → trim hyphens. `Popović Nekretnine` → `popovic-nekretnine`.
- `createAgency` derives `slug` from `name`; ensure uniqueness (append `-2`, `-3`…). Slug is
  read-only (no manual override this pass).
- One-off (live DB): regenerate slugs from names for existing agencies. Safe — partner users
  reference the agency by id, not slug.

## 2. Path-served agency site (`apps/web`)
- `GET /a/:slug` → look up agency by slug; 404 if none; else render via existing
  `renderAgencySite(agency, listings, filters)` with `searchProperties`. The search form's
  GET submits back to `/a/:slug` (relative action). Registered before the host middleware so
  it serves on any host.

## 3. Website editor (console `/agency` dashboard → new "Website" section)
- "View site" button → `https://kluche.me/a/<slug>` (new tab) — host derived from the API base
  origin's apex, or hardcode `kluche.me` for prod; in dev open the API base + `/a/<slug>`.
- Preset palettes (~6): Adriatic `#1F3A5C`/`#4E827A` (default), Gold & Black `#101010`/`#C9883C`,
  Sea `#0B5394`/`#76A5AF`, Olive `#3D4A2A`/`#8A9A5B`, Terracotta `#7A3B2E`/`#C9883C`, Mono `#222222`/`#666666`.
  Picking sets `colorPrimary`/`colorAccent`.
- Logo upload → `POST /api/agency/:id/logo` (multipart, field `logo`).
- Tagline text field.
- Live preview: themed header (primary bg, accent bottom-border, logo + name + tagline).
- Save → `POST /api/agency/:id/config { colorPrimary, colorAccent, tagline }`.
- Current values from `/api/platform/me` (returns the agency incl. colors/logo/tagline/slug).

## 4. Auth scoping (security)
- `POST /api/agency/:id/config` and `/api/agency/:id/logo` currently UNAUTHENTICATED. Require a
  partner token whose `dashboards.agency.agencyId === :id` (use existing `agencyScope`), else 403.

## 5. Testing
- core: `slugify` (diacritics, spaces, punctuation, collapse); `createAgency` uniqueness.
- web: `/a/:slug` renders agency name + listings; unknown slug → 404; config/logo with a
  foreign/missing partner token → 403, with the owner → 200.
- console: typecheck + `expo export --platform web` (with `--clear`).

## Out of scope now
Real subdomains, custom (non-preset) colours, multiple sites per agency, editable slug.
