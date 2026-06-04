# Kluch — Product Shape

**Date:** 2026-06-04
**Status:** Direction agreed (business brainstorm)

## The business in one line

Kluch is **vertical SaaS + a marketplace for rental agencies in Montenegro**: agencies run their business on Kluch (replacing their broken websites), and Kluch sends them **foreign tenants they can't reach on their own** plus the foreigner-specific tooling (translation, contracts, deposits) that closes those deals.

The website is the hook. **The demand + foreigner-tooling is the product.**

## Branding model: hybrid (Booking.com pattern)

Each agency keeps its own branded storefront, **but every listing also flows into one Kluch marketplace** where foreigners search across all agencies. This creates the flywheel:

```
more agencies → more inventory → more foreign demand to Kluch → more valuable to agencies → more agencies
```

That network effect is the moat and the fundraising story.

## Monetization: land cheap, expand on value

1. **Free / near-free base** — modern multilingual website + listings (the Trojan horse that gets inventory onto Kluch).
2. **Pay for performance** — lead fee / commission share when Kluch delivers a foreign tenant. (Where the money is.)
3. **Transaction fees** — digital contracts, deposit handling/escrow.
4. **Services margin** — boravak, cleaning, SIM, transport (tenant-side).
5. **Premium tier later** — featured marketplace placement, analytics, tenant app.

Landlords pay **nothing** recurring — that's the adoption weapon. Money comes from foreign demand + services, not from taxing supply.

## Three surfaces, one backend

```
        ┌──────────────────────── ONE KLUCH BACKEND ────────────────────────┐
        │  agencies · listings · leads · leases · deposits · tickets ·       │
        │  messages · contracts · payments · translation (DeepL)            │
        └────────────────────────────────────────────────────────────────────┘
              ▲                          ▲                          ▲
        B2C — Marketplace          B2B — Agency console       Internal — Kluch admin
        + Tenant app               (the product you sell)     (you)
```

### 1. Foreigner side (B2C) — already designed
- **Marketplace** (public): browse listings across all agencies by region (sea / mountains / capital), filters, map, listing detail (gallery, rent + utilities, schedule a tour), register. → `brand/landing.html`
- **Tenant app** (post-rental): bento dashboard — rent, messages (translated), report a problem, documents, my home, bills, services, local guide. → `brand/app-mockup.html`

### 2. Agency console (B2B) — the product to sell
**MVP:**
- **Listings manager** — add property (photos, price, deposit, specs, location, availability); Kluch auto-translates to EN/RU/TR and publishes to the agency storefront + the Kluch marketplace.
- **Leads inbox** — foreign inquiries + tour requests as a pipeline: New → Contacted → Viewing → Signed. (The value they pay for.)
- **Storefront** — auto-generated branded website (the website replacement).
- **Tenants & leases** — active tenancies, rent status.
- **Messages** — translated chat with tenants.
- **Billing** — pay-per-lead / commission, invoices.

**Later:** digital contracts (multilingual e-sign), deposit escrow, maintenance dispatch, tours calendar, team seats, analytics.

### 3. Kluch admin (internal) — minimal
Onboard/approve agencies & set fee plan · moderate listing quality · invoice agencies · concierge/translation oversight · top-line analytics.

## Data model

**Already built** (`packages/db`): users, properties, leases, payments, tickets, messages + translation engine.

**To add:**
- `agencies` (SaaS tenant) + `agencyId` on properties/leases/staff (multi-tenancy)
- `listings` (public availability + multilingual content, distinct from internal property)
- `leads` (inquiry = listing + prospect + status)
- `contracts`, `deposits` (later)

## Build sequence (part-time-friendly, V1 = his agency)

1. **V1 — his agency only:** listings manager → auto storefront + listings on the marketplace → leads inbox → foreigner can register & request a tour. (One agency, but model data multi-tenant from day one.)
2. **V2 — tenancy layer:** contracts + deposit + tenant app (rent / tickets / messages) on his real tenants.
3. **V3 — open the network:** onboard 2–3 more agencies (multi-tenant + billing) → marketplace aggregates → flywheel.

His agency is not a detour — it is the **first customer and design partner** for the product sold to every other agency.

## Founder/commercial notes (context)

- Equity ~60/40 (cofounder full-time + brings agency / Balša builds V1, leads tech, raises funding). Fair **only with**: Kluch revenue booked to Kluch (not the private agency), IP/brand owned by the Kluch entity, vesting, and a full-time step-up trigger.
- Regulated activity (brokerage, deposits) rides on the licensed agency entity; Kluch invoices a B2B tech/lead-gen fee. Get a Montenegrin lawyer before holding deposits/rent.
