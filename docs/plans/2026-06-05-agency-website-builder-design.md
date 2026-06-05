# Kluch — Agency Website Builder (multi-tenant) — Design

**Date:** 2026-06-05
**Status:** Approved (architecture brainstorm)
**Domain:** `kluche.me`

## Goal

Give every agency a **free, branded, searchable website** powered by Kluch. An agency admin
adds properties and configures their site (logo + colors); their site is served from a
Kluch backend at a free subdomain (`slug.kluche.me`) now, and their own custom domain later.
Every listing also feeds the central Kluch marketplace. This is the **free tier** that drives
the inventory land-grab; monetization (promotion, leads, services) layers on top.

**MVP scope = the "agency + listing" floor:** add/manage properties, configure the site,
and render a themed white-label site with search/filter. No owner/tenant accounts yet.

## Architecture

```
                          ┌── kluche.me / www      → central marketplace (later)
  Cloudflare (DNS + TLS)  │── agency.kluche.me     → agency console (admin/agent)
   *.kluche.me wildcard   │── <slug>.kluche.me     → agency white-label site  ← host-routed
   + SSL-for-SaaS (later) └── <custom-domain>      → agency white-label site  ← host-routed
                                      │
                            Railway: apps/web (Hono)  →  Supabase Postgres + Supabase Storage
                                      (shares packages/db + packages/core)
```

One Hono app (`apps/web`) in the existing monorepo, sharing `packages/db` and `packages/core`
with `apps/bot`. No separate "gateway" product — routing is Host-header middleware.

### Hosting / TLS

- **Cloudflare** in front: DNS, a single `*.kluche.me` **wildcard cert** covers all agency
  subdomains (zero per-agency cert work). Custom domains come later via **Cloudflare for SaaS**
  (or Caddy on-demand TLS) — then a custom domain is just a row in `agency_domains`.
- **Railway** runs the Hono app(s).
- **Supabase** for Postgres + object Storage.

### Request flow (host routing)

Middleware reads `Host` and resolves the tenant:

- `kluche.me` / `www.kluche.me` → marketplace
- `agency.kluche.me` → console
- `<slug>.kluche.me` → `getAgencyBySlug(slug)`
- anything else → `getAgencyByDomain(host)` (custom domain) → 404 if unknown

The agency route renders that agency's themed site: inject `logo_url` + colors as CSS
variables, list their published properties, and a `<form method="get">` search that filters
by query params (`city`, `minPrice`, `maxPrice`, `bedrooms`, `type`). **Pure server-rendered
HTML/CSS, no JS framework.**

## Data model (additions to existing schema)

```
agencies
  id, name, slug (unique, subdomain), logo_url,
  color_primary, color_accent, tagline, created_at

agency_domains
  id, agency_id → agencies, domain (unique), verified_at        -- custom domains (phase 2)

agency_users
  id, agency_id → agencies, email (unique), name,
  role enum('admin','agent'), created_at

properties  (extend existing)
  + agency_id → agencies
  + city, price_minor, currency, bedrooms, bathrooms, area_m2,
    type enum('apartment','studio','house'),
    status enum('draft','published'),
    photos text[]   -- Supabase Storage URLs
```

**Roles:** `admin` = add/edit properties + configure site (logo/colors/domain) + billing.
`agent` = manage listings/leads, no site config or billing.

## File / image storage

- **Supabase Storage** (S3-compatible, CDN + on-the-fly image resize). Binaries never in Postgres.
- Layout: `agencies/<id>/logo.<ext>`, `properties/<id>/photo-NN.jpg`.
- Postgres stores **URLs** only (`agencies.logo_url`, `properties.photos[]`).
- Upload: console → Hono receives file → upload to bucket → save URL. The existing scraper can
  pipe into the same bucket.
- Scale/cost upgrade path: Cloudflare R2 + Cloudflare Images (no egress, built-in transforms).

## Phases

1. **MVP (this plan):** schema + storage + `apps/web` host routing + agency site config (logo/
   colors/slug) + add/manage properties with photos + the themed white-label site with search,
   served on `<slug>.kluche.me`.
2. **Custom domains:** `agency_domains` + Cloudflare-for-SaaS/Caddy on-demand TLS.
3. **Central marketplace** at `kluche.me` aggregating all agencies' published listings.
4. **Owner/tenant accounts** (graduated participation; tenants first via the bot).

## Out of scope for MVP

Owner/tenant accounts · payments · promotion billing · leads inbox wiring · custom domains ·
the central marketplace aggregation (the agency sites come first).

## Decisions captured

- Routing = Host-header middleware in one Hono app, not a separate gateway.
- Subdomains + wildcard TLS now; custom domains via Cloudflare-for-SaaS later.
- Supabase Storage for files; URLs in Postgres.
- White-label sites are server-rendered pure HTML/CSS; search via GET query params.
- Multi-tenant from day one (`agency_id` scoping), even though only the cofounder's agency
  uses it first.
