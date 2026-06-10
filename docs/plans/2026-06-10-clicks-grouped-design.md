# Grouped phone-click counts — Design

*Approved 2026-06-10.* The console **Leads → Clicks** tab currently lists one row per
phone-click. Group them **per listing**, showing the listing name, its ref code, a click
**count**, and the last-clicked time — sorted **most-clicked first** — so the agent sees which
listings drive calls and how many clicks each got.

## Data
Phone clicks are `inquiries` with `kind="phone_click"` and a `propertyId`. The
`GET /api/agency/leads?kind=phone_click` endpoint already looks up each lead's property (for
`propertyName`); it will also surface the property's **`refCode`**.

## Backend (web)
- `/api/agency/leads`: the per-property enrichment loop already calls `getProperty` (which returns
  `refCode`). Add `refCode` to the enriched lead (alongside `propertyName`).
- `Lead` type (`apps/app/lib/api.ts`): add `refCode: string | null`.

## Console (apps/app/app/leads.tsx)
- A pure helper `groupPhoneClicks(leads): ClickGroup[]` — groups by `propertyId` (clicks with no
  property fall under a single "—/Unknown listing" group keyed by `""`); each group =
  `{ propertyId, propertyName, refCode, count, lastCreatedAt }`; sorted by `count` desc, ties broken
  by `lastCreatedAt` desc.
- Clicks tab renders grouped rows: **name**, a **ref-code chip** (e.g. `ST-0042`), `N click(s)`
  (singular/plural), and `last <date/time>` (reuse the existing date formatting). Tours/Inquiries
  tabs are unchanged (still one row per lead).
- Subtitle for the Clicks tab reads total clicks (the sum), so the headline number still reflects
  total activity while rows show the per-listing breakdown.

## Tests
- core/web: leads endpoint returns `refCode` for a phone-click whose property has one; null when no
  property.
- console: `groupPhoneClicks` — counts per listing, sort by count then recency, plural/singular,
  null-property bucket; typecheck + web export green.

## Out of scope
Server-side aggregation/pagination (the clicks list is already returned in full); grouping the
Tours/Inquiries tabs; charts.
