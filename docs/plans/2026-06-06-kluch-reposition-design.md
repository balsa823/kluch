# Kluch Reposition — Design

*Approved 2026-06-06. Repositions the business plan from "Telegram-managed rental layer / OS for foreigners" to a multi-vertical marketplace platform.*

## Thesis

**Kluch = one account, every key.** A single Kluch account is the master key to a family of
vertical marketplaces, each on its own subdomain, all featured at the `kluche.me` hub:

- **rent.kluche.me** — the live wedge. Free white-label websites for rental agencies; their
  listings aggregate into a rental marketplace. Open to all agencies; featured/exclusivity
  tiers monetize.
- **law.kluche.me** — residency, company formation, contracts, notary.
- **tax.kluche.me** — accounting, tax filing, bookkeeping.
- *(later)* health, banking.

## Why it wins

1. The free builder is a land-grab for the best local rental inventory + distribution.
2. That inventory becomes the aggregated marketplace at `kluche.me`.
3. The **account is the moat**: a foreigner who uses Kluch for rent reaches law and tax with
   the same login. Each old "foreigner-service" becomes a vertical; the account ties them
   together.

## Monetization (qualitative — no invented projections)

- Marketplace finder/lead fees + featured placement (rent vertical).
- Per-vertical service commission or in-house margin (law, tax).
- Featured/exclusivity tiers for agencies.

## Document structure (full reposition)

Vision · Brand (master-key) · Problem · Solution · Architecture (hub + verticals + one
account) · Market · Go-to-market (land-grab, featured tiers) · Revenue · Roadmap
(rent now → law → tax/health/banking) · Economics · Competitive · Legal · Funding · Risks.

Keep brand/legal/funding/risks largely from the prior plan, lightly updated.

## Constraints

- **Numbers-light.** State only high-confidence facts; mark any illustrative figure as
  "to validate." No invented TAM/ARR precision.
- Roadmap names **Rent (now) → Law** explicitly; Tax/Health/Banking as broader vision.
- Web-first framing (Telegram is a secondary tenant-comms feature, not the headline).

## Deliverables

1. `kluch-business-plan.md` — canonical rewrite.
2. `presentation.html` (served at `kluche.me/bussines_plan.html`) — updated to match.
3. Redeploy backend so the live business-plan page reflects the new strategy.
