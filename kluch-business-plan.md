# Kluche — Business Plan

*Lean internal founder doc — v0.3 (June 2026)*

> **Name:** Kluche — from *ključ / ключ*, "key" in Montenegrin and Russian.
> **Domain:** kluche.me (.me is Montenegro's country code — the brand and domain are one.)
> **Tagline:** *Your keys to Montenegro.*

> **Note on numbers:** this doc deliberately avoids precise market-size and revenue
> projections we can't yet stand behind. Figures appear only where we're confident or are
> clearly labelled *illustrative — to validate*.

---

## 1. Vision

**Kluche is one account, every key.** A single Kluche login is the master key to everything a
foreigner needs to live in Montenegro — starting with a home, then the paperwork that comes
with it. We deliver this as a family of focused **vertical marketplaces**, each on its own
subdomain, all featured at the `kluche.me` hub and all reachable with the same account.

We begin with rental, because that's the recurring, trust-building relationship and the
inventory our cofounder's agency already controls. Rental is the wedge. The unified account
across verticals is the business.

## 2. The brand

**Kluche** means "key" in the languages of most of our target customers (Serbian,
Montenegrin, Russian, Ukrainian) and reads near-identically to English "clutch" — *reliable,
comes through when it matters*. The metaphor is literal in the product: **one master key
(your account) opens every door (each vertical).**

- Hub: `kluche.me` — features all verticals, one login.
- `rent.kluche.me`, `law.kluche.me`, `tax.kluche.me`, … — the doors.
- Pronounceable in EN / RU / SR / TR / DE without instruction.

## 3. Problem

- **Agencies have broken or no websites.** Most Montenegrin rental agencies market via
  classifieds, Facebook, and word of mouth. The few sites that exist are dated, mono-lingual,
  and invisible to the foreigners actually looking.
- **Foreigners have no single trusted front door.** Finding a rental, then sorting residency,
  company formation, and tax, means starting from scratch with a different fragmented set of
  local-language-only providers each time.
- **No aggregation.** A foreigner can't search across agencies in one place, and an agency
  can't reach the foreigner audience without building distribution alone.
- **Language and trust gaps** sit on top of all of it.

## 4. Solution

A web platform with two faces, unified by one account.

**For agencies (rent vertical, live first)**
- A **free, white-label website** generated for the agency — their logo, their styling, their
  listings, at `their-name.kluche.me` (or their own domain), "powered by Kluche" in the footer.
- Import existing listings (e.g. from their current site) and manage them from a console.
- Their listings are simultaneously **aggregated into the Kluche marketplace** at `kluche.me`.

**For foreigners (the marketplace + the account)**
- Search rentals across every agency in one place, in their language.
- One Kluche account that, over time, also opens the **law** and **tax** verticals — the same
  login, the same trusted brand, the next service one click away.

The cofounder's existing agency is the launch customer and first inventory.

## 5. Architecture (how the pieces fit)

- **`kluche.me`** — the hub/landing that features all verticals and the aggregated rental
  marketplace.
- **`rent.kluche.me`** — the rental vertical: the agency website builder + the rental
  marketplace.
- **`law.kluche.me`**, **`tax.kluche.me`** — subsequent service verticals.
- **One Kluche account (SSO)** — works across every vertical. This shared identity is the
  thing competitors can't easily copy: it turns each foreigner's rental relationship into a
  distribution channel for every other service.

The platform is multi-tenant by host: the same backend serves the hub, each agency's
white-label site (resolved from the request domain), and the per-vertical front ends.

## 6. Go-to-market

1. **Land-grab rental agencies.** The free website is the hook — agencies get a modern,
   multilingual site and marketplace distribution at no cost and near-zero effort (we import
   their listings for them).
2. **Open to all, with featured tiers.** Any agency can join. Paid **featured / exclusivity**
   placement (per town or category) is the first monetization and creates urgency for the
   strongest local players to lock in their position.
3. **Foreigner demand follows inventory.** Once the marketplace has the best local listings,
   the foreigner audience aggregates — and that audience is what we cross-sell the law and tax
   verticals to.
4. **Geographic rollout:** start in the capital with the cofounder's agency, then coast
   (Budva, Tivat, Kotor) town by town.

## 7. Revenue streams

*(Model is qualitative; exact pricing to be set from pilot data.)*

1. **Featured / exclusivity placement** — agencies pay for prominence or area exclusivity in
   the marketplace. Primary early revenue.
2. **Marketplace finder / lead fees** — a fee tied to qualified tenant introductions or
   completed rentals sourced through Kluche.
3. **Service-vertical commission** — law and tax verticals take a margin on services delivered
   by vetted partners (or in-house, later).
4. **Optional agency tooling** — premium console features (analytics, more sites, integrations)
   as a later upsell.

We are deliberately *not* charging landlords a management fee or taking a large rent cut — the
market won't bear it, and the free builder is what wins the inventory.

## 8. Expansion: the service verticals

The rental relationship and the shared account create distribution nobody else in Montenegro
has: a trusted, recurring relationship with foreigners who, predictably, need the same
paperwork.

- **`law.kluche.me`** — residency permits (boravak), company formation (d.o.o.), contracts,
  notary/apostille. Almost every long-term foreigner renews residency annually.
- **`tax.kluche.me`** — accounting, tax filing, bookkeeping — recurring, high-margin.
- *(later)* health insurance, bank-account introductions, driver's-licence conversion,
  school placement.

Kluche is the trusted front door and the account; licensed lawyers, accountants, and notaries
do the regulated work under partnership/referral terms (and eventually as in-house hires).

## 9. Why now / unfair advantage

- **Cofounder already runs a rental agency** → instant inventory, ops experience, and landlord
  trust to seed the rent vertical.
- **No one aggregates Montenegrin agencies** or wraps them in a free, multilingual web
  presence.
- **AI translation is finally good enough** to remove the language barrier across listings and
  tenant communication at near-zero cost.
- **Record-high foreign-resident population** in Montenegro — the customer base is here now.
- **The account is a compounding moat** — each vertical we add makes the single login more
  valuable and raises switching costs.

## 10. Operations

- **Tech:** multi-tenant web app (host-based routing for agency sites + verticals), Postgres,
  object storage for listing media, LLM for translation, token auth shared across verticals.
  Telegram remains available as a secondary tenant-comms channel, not the headline product.
- **People (early):** 2 founders; ops/sales led by the cofounder; service specialists added
  per vertical as it launches.
- **Infrastructure:** runs on a small, scale-to-zero cloud stack provisioned with Terraform.

## 11. Ownership & legal structure

**Two separate companies.** The cofounder's existing rental agency remains 100% his — Kluche is
a new d.o.o. owned by the two founders. The agency becomes Kluche's first customer at arm's
length, not a contribution to the cap table.

| Document | Purpose |
|---|---|
| Articles of Association (Statut) | Founding doc registered at CRPS |
| Shareholders' Agreement | Vesting, deadlock, non-compete, ROFR/drag/tag, reserved matters, conflict-of-interest disclosures (the cofounder's agency is also a customer) |
| IP Assignment Agreement | Each founder assigns Kluche code, brand, and contracts to the d.o.o. |
| Service Agreement (agency ↔ Kluche) | Cofounder's agency signs on standard customer terms |
| Director / Employment Agreements | Roles, salaries, exclusivity |

Key risks to bake into the Shareholders' Agreement: founder **vesting** (with a cliff),
**deadlock resolution** (split decision domains — product/tech vs ops/sales — plus a shotgun
clause), an explicit **scope line** between the agency and Kluche, and **reserved matters**
requiring both founders' approval. Engaging a Montenegrin corporate lawyer to do this properly
is the single most important early investment.

## 12. Funding strategy

**Primary target: Innovation Fund of Montenegro — Early-Stage Startup Support** (grant for
Montenegro-registered, founder-owned startups with a working MVP and an early business model).
A pilot of real agencies with live white-label sites and aggregated listings is concrete
evidence ahead of typical applicants.

**Secondary:** Innovation Vouchers (R&D partnership, e.g. the translation/AI piece with a
Montenegrin university); IRF loans/guarantees for working capital later; EU IPA / Western
Balkans funds once larger.

*(Exact grant amounts and timelines: confirm against the current open call — figures move
year to year.)*

**Bootstrapped path if grants miss:** founders unpaid early, minimal burn, covered by featured
placements and the cofounder's existing book.

## 13. Roadmap

| Phase | Milestone |
|---|---|
| **Now** | `rent.kluche.me` live: agency website builder + listing import + aggregated marketplace; cofounder's agency onboarded; first additional agencies via free sites |
| **Next** | Featured/exclusivity tiers; multilingual marketplace search; more agencies across the capital + coast |
| **Then** | `law.kluche.me` — residency + company formation with vetted partners, on the shared account |
| **Later** | `tax.kluche.me`; then health / banking verticals; own-domain support for agencies |

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Agency adoption** — will agencies put listings on us? | The site is free, we do the import for them, and they keep their brand; first featured slots create urgency |
| **Chicken-and-egg** (inventory vs demand) | Seed inventory from the cofounder's agency before marketing to foreigners |
| **Trust / control** | Agencies keep ownership of their listings and branding; transparent terms |
| **Regulatory** (service verticals, payments) | Legal review before scaling; licensed partners do regulated work |
| **Language quality** | Human-reviewed AI translation; native-language support for key markets |
| **Founder deadlock (2 owners)** | Shareholders' Agreement with split domains, shotgun clause, reserved matters |
| **Foreign-resident volatility** | Diversify across nationalities so one geopolitical shift doesn't kill the base |

## 15. Next steps (next 30 days)

1. **Onboard the first agencies** onto `rent.kluche.me` with free white-label sites (cofounder's
   agency + 1–2 others), importing their listings.
2. **Ship marketplace aggregation** at `kluche.me` across those agencies.
3. **Define featured/exclusivity tiers** and price them from real conversations with agencies.
4. **Register the d.o.o.** and sign the Shareholders' Agreement with a corporate lawyer.
5. **Confirm the next Innovation Fund call** and prepare the application around the live pilot.
6. **Scope `law.kluche.me`** — line up one residency/company-formation partner for the next vertical.
