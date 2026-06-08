# Rich Agency Website Template — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans.

**Goal:** Upgrade the white-label agency site to a keypartners.me-style template (hero + search, rich rent/sale cards, "request info" form, EN/SR/RU/TR picker), themed per agency.

**Tech:** pnpm monorepo `@kluche/*`, Node 22 via nvm, Drizzle + postgres.js + drizzle-kit, Hono, Expo/RN-Web, Vitest (test DB :5433 `postgresql://kluch:kluch@localhost:5433/kluch_test`).

**Setup (every bash):** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`.

Existing to reuse: `render.ts` (`esc`, `cssColor`, `safeUrl`, `formatMoney`, `renderCard`); `app.ts` `parseSearchFilters` (~53), `GET /a/:slug` (~284), `getAgencyBySlug`, `searchProperties`; `index.html` for the i18n pattern (`data-i18n` + `langMenu` + JS dict). Property has no `dealType` yet.

---

## Task 1: `dealType` on properties (TDD, core + web)
**Files:** `packages/db/src/schema.ts`, migration; `packages/core/src/listings.ts`; `apps/web/src/app.ts` (parseSearchFilters); tests `packages/core/src/__tests__/listings.test.ts`, `apps/web/src/__tests__/*`.

1. Schema: `export const dealTypeEnum = pgEnum("deal_type", ["rent","sale"]);` and add to `properties`: `dealType: dealTypeEnum("deal_type").notNull().default("rent"),`. `pnpm --filter @kluche/db generate`; apply to test DB (`DATABASE_URL=postgresql://kluch:kluch@localhost:5433/kluch_test pnpm --filter @kluche/db migrate`).
2. `CreatePropertyInput` + `createProperty`: accept `dealType?: "rent"|"sale"` (default handled by column). `SearchFilters` (listings.ts:76): add `dealType?: "rent"|"sale"`. In `searchProperties`, when set, add `eq(properties.dealType, filters.dealType)` to the AND.
3. `parseSearchFilters` (app.ts): if `query.dealType === "rent"|"sale"`, set it.
4. **Tests (write first, fail, implement, pass):** core — create 1 rent + 1 sale property, `searchProperties(db, agencyId, {dealType:"sale"})` returns only the sale one; default create → `dealType==="rent"`. Run `pnpm --filter @kluche/core exec vitest run src/__tests__/listings.test.ts`.
5. Commit `feat(core): rent/sale dealType on properties + search filter`.

## Task 2: `inquiries` table + core helpers (TDD)
**Files:** `packages/db/src/schema.ts`, migration; create `packages/core/src/inquiries.ts`; `packages/core/src/index.ts`; test `packages/core/src/__tests__/inquiries.test.ts`.

1. Table:
```ts
export const inquiries = pgTable("inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  propertyId: uuid("property_id").references(() => properties.id),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  message: text("message"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```
Generate + apply migration. Also add `inquiries` truncation to `packages/db/src/test-helpers.ts` `resetDb`.
2. `inquiries.ts`: `Inquiry` type; `createInquiry(db, {agencyId, propertyId?, name, contact, message?})`; `listInquiries(db, agencyId)` (newest first). Export from index.
3. **Tests:** create an agency, `createInquiry`, `listInquiries` returns it; `propertyId` optional. Run the file.
4. Commit `feat(core): inquiries table + create/list`.

## Task 3: `POST /a/:slug/inquiry` endpoint (TDD, web)
**Files:** `apps/web/src/app.ts` (near `GET /a/:slug`), `apps/web/src/__tests__/api.test.ts` (or app.test.ts).

Spec: public, form-encoded body. Resolve agency by slug (404 if none). Read `name`, `contact`, `message`, optional `propertyId`, honeypot `company`. If `company` non-empty → 303 redirect to `/a/:slug?sent=1` WITHOUT storing (silently drop bots). If `name`/`contact` missing or over caps (name>120, contact>200, message>2000) → 400. Else `createInquiry` → 303 redirect `/a/:slug?sent=1`.
```ts
app.post("/a/:slug/inquiry", async (c) => {
  const agency = await getAgencyBySlug(db, c.req.param("slug"));
  if (!agency) return c.text("Not found", 404);
  const form = await c.req.parseBody();
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (s(form.company)) return c.redirect(`/a/${agency.slug}?sent=1`, 303); // honeypot
  const name = s(form.name), contact = s(form.contact), message = s(form.message);
  const propertyId = s(form.propertyId) || undefined;
  if (!name || !contact || name.length > 120 || contact.length > 200 || message.length > 2000)
    return c.json({ error: "invalid" }, 400);
  await createInquiry(db, { agencyId: agency.id, propertyId, name, contact, message: message || undefined });
  return c.redirect(`/a/${agency.slug}?sent=1`, 303);
});
```
**Tests:** valid form → 303 + `listInquiries` has 1; honeypot filled → 303 + 0 stored; missing name → 400; unknown slug → 404. Commit `feat(web): public inquiry endpoint for agency sites`.

## Task 4: rewrite `renderAgencySite` (TDD-light, web)
**Files:** `apps/web/src/render.ts`; tests in `apps/web/src/__tests__/render.test.ts`.

Rewrite to a richer, themed, multilingual template. Keep `esc`/`cssColor`/`safeUrl`. Sections:
- `<nav>`: logo (`safeUrl(agency.logoUrl)`) + name; anchor links `#properties #about #contact`; **language menu** EN/SR/RU/TR (buttons `data-code`), labels via `data-i18n`.
- **Hero**: `style="background-image: linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url('<first safe photo>')"` or gradient `--color-primary`→darker when no photo; H1 = `agency.tagline || agency.name`; search `<form method="get">` with: city text, dealType `<select>` (Any/Rent/Sale), min/max price, bedrooms, submit.
- **Filter tabs** (`#properties`): links `?` / `?dealType=rent` / `?dealType=sale` (preserve other params is nice-to-have; minimal is fine), active state from `filters.dealType`.
- **Cards** (extend `renderCard`): photo; **deal price** — rent → `${formatMoney(price)} / mo` + tag "For Rent"; sale → `formatMoney(price)` + tag "For Sale" (use `data-i18n` tags so they translate); city; badges `beds · baths · m²` (omit missing); type label. Hover lift via CSS.
- **Contact** (`#contact`): form `method="post" action="/a/<slug>/inquiry"` with hidden honeypot `company` (visually hidden), name, contact, message, submit. When `filters`-adjacent `sent` is truthy show a thank-you note — pass a `sent` boolean param into `renderAgencySite` (add a 4th arg `opts?: { sent?: boolean }`; the `GET /a/:slug` handler sets it from `c.req.query("sent")==="1"`).
- **Footer**: agency name + "Powered by Kluche".
- **i18n script**: inline `<script>` with a `T` dict for `en/sr/ru/tr` covering all `data-i18n` keys + a menu toggle + `applyLang()` setting `textContent`/placeholders; default `en`, persists to `localStorage`. Mirror `index.html`'s implementation. Add a comment: `SR/RU/TR strings are first-pass — review with a native speaker.`

**Tests (assert substrings, not full HTML):** output contains the agency name, a `data-i18n` lang button set (all 4 codes), `action="/a/<slug>/inquiry"`, a rent card showing `/ mo` and a sale card without it, and the honeypot input. Also update `GET /a/:slug` to pass `{ sent: c.req.query("sent")==="1" }`. Run `pnpm --filter @kluche/web exec vitest run`. Commit `feat(web): rich multilingual agency site template (hero, rent/sale cards, contact form)`.

## Task 5: Rent/Sale toggle in the console add-listing form
**Files:** `apps/app/lib/api.ts` (`CreateListingInput` + `createListing`), `apps/app/app/agency.tsx`.

- `CreateListingInput`: add `dealType: "rent" | "sale"`. `createListing` already forwards the body.
- `agency.tsx`: add `const [dealType, setDealType] = useState<"rent"|"sale">("rent")`; a segmented Rent/Sale control near the type selector (reuse the existing segmented-control styling used for `type`); include `dealType` in the `createListing` payload; reset to `"rent"` on form reset.
- Verify `pnpm --filter @kluche/app typecheck` + `expo export --platform web --output-dir /tmp/v --clear`. Commit `feat(app): rent/sale toggle in add-listing form`.

## Task 6: deploy (ops)
1. Build backend image (`az acr build`, plain) + `terraform apply -var backend_image=…`; the migrations (dealType + inquiries) run on boot; confirm revision Healthy/Running.
2. Rebuild console: `rm -rf apps/app/dist apps/app/.expo`; `EXPO_PUBLIC_API_URL=<backend_url> expo export --platform web --output-dir dist --clear`; SWA deploy.
3. Verify: `kluche.me/a/popovic-nekretnine` shows the new hero/cards/lang-picker; submit the contact form → `?sent=1` thank-you + a row via a quick `listInquiries` check; rent/sale toggle works in the console and the tag shows on the site.

## Notes
- DRY: reuse `esc/cssColor/safeUrl/formatMoney/getAgencyBySlug/searchProperties`. YAGNI: no inquiries UI, no email, no hero upload, no sale-specific fields.
- i18n: ship en/sr/ru/tr but comment that SR/RU/TR need a native review (do not assert correctness).
