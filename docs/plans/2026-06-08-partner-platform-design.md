# Partner Platform — One Login, Vertical Dashboards (Design)

*Approved 2026-06-08.*

## Goal

Separate the verticals. `kluche.me` is the public/foreigner side. Partner users
(agencies and lawyers) share **one login** in one table; their token carries the set of
dashboards they may access. After login they are redirected to the matching dashboard
subdomain (`rent.kluche.me` for agency, `law.kluche.me` for law). Single dashboard →
auto-redirect; multiple → redirect to the first for now (chooser later).

Out of scope this pass: foreigner (User) accounts + schedule-a-tour on `kluche.me`.

## Data model — new `partner_users` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `email` | text unique | login |
| `name` | text | |
| `passwordHash` | text | |
| `dashboards` | jsonb | map of dashboard-key → metadata, e.g. `{"agency": {"agencyId": "…"}}` or `{"law": {"lawFirmId": "…"}}`. One key for now; shape supports many. |
| `createdAt` | timestamptz | |

`agency_users`, `agencies` unchanged. Seed/migrate a `partner_user` for the existing
agency admin so the agency dashboard login keeps working.

Dashboard keys (initial): `"agency"`, `"law"`.

## Auth + token

- `POST /api/platform/login` `{ email, password }` → verify against `partner_users`
  → `{ token, dashboards: ["agency"] }` (the keys of the `dashboards` map).
- Token payload: `{ sub: partnerUserId, dashboards: [...keys] }`, signed with existing HMAC
  (`signToken`/`verifyToken`).
- `GET /api/platform/me` → resolves the partner user + dashboard metadata.
- Agency-scoped endpoints derive `agencyId` from `dashboards.agency.agencyId` in the token's
  partner user (replacing the old agency_users lookup for the console).

## Hosting + routing

- **`kluche.me`** (Hono-served landing): add a small **top-right "Take me to the platform"**
  link → platform login.
- The existing **console SPA** (`apps/app`, Expo/RN-Web on the Static Web App) hosts login +
  both dashboards, bound to **both** `rent.kluche.me` and `law.kluche.me` (CNAME → SWA).
- Console routes:
  - `/login` — vertical-agnostic platform login.
  - `/agency` — existing listings dashboard, scoped to the token's `agencyId`.
  - `/law` — **stub** ("Law dashboard — coming soon").
- Vertical → subdomain map: `agency → rent.kluche.me`, `law → law.kluche.me`.

## Token transport across subdomains

Login returns the token, then the client redirects to
`https://<vertical>.kluche.me/#token=<jwt>`. The target subdomain reads the fragment,
stores the token in localStorage, strips it from the URL, and renders that dashboard.
(localStorage is per-origin, so the token is handed over via the fragment — consistent with
the current Bearer model; no cookie/CSRF change.)

## Redirect rule

```
dashboards = token.dashboards            // array of keys
if dashboards.length <= 1: go to subdomain(dashboards[0])
else: go to subdomain(dashboards[0])     // chooser UI is a later iteration
```

## Deploy

1. Build + test on the SWA default host and localhost first.
2. Add `rent` and `law` CNAMEs → SWA; bind both custom domains on the SWA.
3. The kluche.me button can point at `rent.kluche.me/login` initially.
4. The backend image rebuilt for this work also carries the pending business-plan deck edits
   (rentK slide / verticals line / EU section), which go live on the same roll.

## Testing

- `partner_users` create + lookup; password verify (valid/invalid).
- platform login returns token whose `dashboards` matches the user's map keys.
- token → resolves partner user → agency endpoints scope by `agencyId`.
- redirect chooses `dashboards[0]`; single-dashboard auto-redirect.
- console `/login` → `/agency` (real) and `/law` (stub) render.
