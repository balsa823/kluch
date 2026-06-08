# Rich Agency Website Template — Design

*Approved 2026-06-08.* Inspired by keypartners.me (hero + search, rich cards, contact form),
themed per agency, multilingual.

## Data model (`packages/db` + `packages/core`)
- `dealType` pgEnum `["rent","sale"]`; add `dealType` column to `properties` (default `"rent"`). Migration.
  `createProperty` accepts `dealType`; `SearchFilters` gains optional `dealType`; `searchProperties` filters on it.
- New `inquiries` table: `id uuid pk`, `agencyId uuid → agencies`, `propertyId uuid → properties (nullable)`,
  `name text`, `contact text`, `message text`, `status text default "new"`, `createdAt timestamptz`. Migration.
  Core: `createInquiry(db,{agencyId,propertyId?,name,contact,message})`, `listInquiries(db,agencyId)`, `Inquiry` type.

## Rewritten `renderAgencySite(agency, listings, filters)` (`apps/web/src/render.ts`)
Themed by `colorPrimary`/`colorAccent` (existing `cssColor`/`safeUrl`/`esc` guards retained). Sections:
- **Nav**: logo + name; anchor links Properties/About/Contact; language picker EN/SR/RU/TR (client `data-i18n` + inline JS dict + menu, mirroring `index.html`).
- **Hero**: background = first listing photo (`safeUrl`) with a dark overlay; fallback = primary→darker gradient. Headline = tagline (or name); overlaid search `form GET` posting back to current path: city, dealType (rent/sale), min/max price, bedrooms.
- **Listings grid**: cards with photo, deal price (`For Rent €X/mo` vs `For Sale €X`), city, `beds · baths · m²` badges, type + deal tag, hover lift. Filter tabs All / For Rent / For Sale (links that set `?dealType=`).
- **Contact**: "Request info / book a viewing" form → `POST /a/:slug/inquiry` (name, contact, message, optional `propertyId`). Honeypot field + length caps. Renders a thank-you state when `?sent=1`.
- **Footer**: contact + "Powered by Kluche".

## Inquiry endpoint (`apps/web/src/app.ts`)
- `POST /a/:slug/inquiry` (public, form-encoded): resolve agency by slug (404 else); read name/contact/message (+ optional propertyId, honeypot `company`); if honeypot filled or fields missing/oversize → reject (redirect with `?sent=0` or 400); else `createInquiry` → 303 redirect to `/a/:slug?sent=1`. Length caps (name ≤120, contact ≤200, message ≤2000).

## i18n
Keys for: nav (properties/about/contact), search labels + button, deal tags (For Rent/For Sale/per month), filter tabs, contact heading + field labels + submit + thank-you, footer. Provide en/sr/ru/tr dicts inline. **Flag SR/RU/TR for native review** (short labels; do not assert correctness — see numbers-confidence memory).

## Console (`apps/app`)
- Add a Rent/Sale segmented toggle to the add-listing form (`agency.tsx`), default Rent; pass `dealType` to `createListing`. Update `CreateListingInput` + the API client.

## Testing
- core: `searchProperties` filters by dealType; `createInquiry`/`listInquiries` round-trip.
- web: `POST /a/:slug/inquiry` stores (valid) / rejects (honeypot + oversize) / 404 unknown slug; `renderAgencySite` output contains hero, a deal tag, the contact form, and the lang picker; rent vs sale price formatting.
- console: typecheck + web export.

## Out of scope now
Inquiries console screen, email notifications, hero-image upload, sale-specific fields.
