# Agency Website Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A multi-tenant `apps/web` (Hono) that serves each agency a free, branded, searchable white-label website resolved by Host header — backed by an extended Postgres schema and Supabase Storage for images.

**Architecture:** One Hono app in the existing monorepo, sharing `packages/db` + `packages/core`. Host-header middleware resolves the request to the marketplace, the console, or a specific agency (by `slug.kluche.me` subdomain or custom domain). Agency sites are server-rendered pure HTML/CSS; search is a `GET` form filtering that agency's published properties. Images live in Supabase Storage; Postgres stores only URLs. Multi-tenant (`agency_id`-scoped) from day one.

**Tech Stack:** TypeScript (ESM/NodeNext) · Hono + @hono/node-server · Drizzle ORM + Postgres (Supabase) · @supabase/supabase-js (Storage only) · Vitest · Cloudflare (DNS + wildcard TLS) · Railway.

---

## How to use this plan

- Work top to bottom; each task is bite-sized and ends in a commit.
- **TDD for `packages/*`:** failing test → watch it fail → minimal code → pass → commit.
- **Hono is unit-testable** via `app.request(new Request("http://popovic.kluche.me/"))` — no real server needed, so host routing and search are tested directly.
- See the design doc: `docs/plans/2026-06-05-agency-website-builder-design.md`.

## Prerequisites

- Builds on the **monorepo foundation from `feat/phase1-bot`** (`packages/db`, `packages/core`, pnpm workspace). Execute on that branch (or a branch off it), not bare `master`.
- **Node 22**, **pnpm**, **Docker** test Postgres up (`pnpm db:up`).
- For live verification only (later tasks): a Supabase project (Postgres URL + Storage service key) and a `kluche.me` zone on Cloudflare. The DB/storage logic is testable locally without these.

---

## Milestone 1 — Schema: agencies, agency_users, domains, property listing fields

### Task 1.1: Add agency enums + tables to the schema

**Files:**
- Modify: `packages/db/src/schema.ts`

**Step 1: Add enums** (near the existing enums):

```ts
export const agencyRoleEnum = pgEnum("agency_role", ["admin", "agent"]);
export const propertyTypeEnum = pgEnum("property_type", ["apartment", "studio", "house"]);
export const propertyStatusEnum = pgEnum("property_status", ["draft", "published"]);
```

**Step 2: Add tables** (after `properties`):

```ts
export const agencies = pgTable("agencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  colorPrimary: text("color_primary").notNull().default("#1F3A5C"),
  colorAccent: text("color_accent").notNull().default("#4E827A"),
  tagline: text("tagline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agencyDomains = pgTable("agency_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  domain: text("domain").notNull().unique(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agencyUsers = pgTable("agency_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: agencyRoleEnum("role").notNull().default("agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 3: Extend `properties`** — add these columns to the existing `properties` table definition:

```ts
  agencyId: uuid("agency_id").references(() => agencies.id),
  priceMinor: integer("price_minor"),
  currency: text("currency").notNull().default("EUR"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  areaM2: integer("area_m2"),
  type: propertyTypeEnum("type"),
  status: propertyStatusEnum("status").notNull().default("draft"),
  photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
```
(Import `sql` from `drizzle-orm` at the top if not present.)

**Step 4: Typecheck**

Run: `pnpm --filter @kluch/db typecheck`
Expected: PASS.

**Step 5: Generate + apply migration**

Run: `pnpm --filter @kluch/db generate`
Then (test DB): `DIRECT_DATABASE_URL=postgresql://kluch:kluch@localhost:5433/kluch_test pnpm --filter @kluch/db migrate`
Expected: a new migration file; "migrations applied".

**Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/migrations
git commit -m "feat(db): add agencies, agency_users, domains, and property listing fields"
```

### Task 1.2: Schema round-trip test

**Files:** Test `packages/db/src/__tests__/agencies.test.ts`

- **Test:** insert an `agencies` row (slug unique), insert an `agency_users` row referencing it with role default `agent`, insert a `properties` row with `agencyId` + `status` default `draft` + empty `photos`. Assert reads back.
- **Run:** `pnpm db:up && pnpm --filter @kluch/db test` → PASS.
- **Commit:** `test(db): agencies/agency_users/properties round-trip`.

---

## Milestone 2 — Core logic (TDD)

> Reuse the test harness pattern: import `db`, `migrateTestDb`, `resetDb` from `@kluch/db/test-helpers`. Add the new tables to the `resetDb()` TRUNCATE list in `packages/db/src/test-helpers.ts` (agencies, agency_domains, agency_users) — order them before/with the tables that reference them using `CASCADE` (already present).

### Task 2.0: Update resetDb truncate list
**Files:** Modify `packages/db/src/test-helpers.ts` — add `agency_users, agency_domains, agencies` to the `TRUNCATE ... RESTART IDENTITY CASCADE` statement. Run any existing db test to confirm still green. Commit: `test(db): include agency tables in resetDb`.

### Task 2.1: `slug` helper + `createAgency`
**Files:** Create `packages/core/src/agencies.ts`; Test `packages/core/src/__tests__/agencies.test.ts`.

- **Test first:**
  - `slugify("Popović Nekretnine")` → `"popovic-nekretnine"` (lowercase, ASCII-fold, hyphens, no diacritics).
  - `createAgency(db, { name, slug? })` inserts an agency; if slug omitted, derives from name; ensures uniqueness (append `-2` on collision).
  - Defaults: `colorPrimary`/`colorAccent` set, `status` n/a.
- **Implement** `slugify` (strip diacritics via `normalize("NFD").replace(/\p{Diacritic}/gu,"")`, non-alnum → `-`, collapse, trim) + `createAgency` with collision-retry on slug.
- Verify pass; **commit** `feat(core): add slugify and createAgency`.

### Task 2.2: `getAgencyBySlug` + `getAgencyByDomain` + `updateAgencyConfig`
**Files:** extend `packages/core/src/agencies.ts` + test.

- **Test first:**
  - `getAgencyBySlug(db, "popovic-nekretnine")` returns the agency or null.
  - `getAgencyByDomain(db, "popovicnekretnine.me")` joins `agency_domains` → returns the agency or null (only when a matching domain row exists).
  - `updateAgencyConfig(db, agencyId, { logoUrl, colorPrimary, colorAccent, tagline })` updates and returns the row.
- **Implement.** Verify, **commit** `feat(core): agency lookups by slug/domain + config update`.

### Task 2.3: `addAgencyDomain`
**Files:** extend `agencies.ts` + test.
- **Test:** `addAgencyDomain(db, agencyId, "popovicnekretnine.me")` inserts a domain row (lowercased, unique); duplicate throws.
- Implement, verify, **commit** `feat(core): add agency custom domain`.

### Task 2.4: `agency_users` — `createAgencyUser`, `listAgencyUsers`
**Files:** Create `packages/core/src/agencyUsers.ts` + test.
- **Test:** create admin + agent; `listAgencyUsers(db, agencyId)` returns both; role defaults to `agent`; duplicate email throws.
- Implement, verify, **commit** `feat(core): agency users with admin/agent roles`.

### Task 2.5: Properties — `createProperty`, `publishProperty`, `searchProperties`
**Files:** Create `packages/core/src/listings.ts`; Test `packages/core/src/__tests__/listings.test.ts`.

- **Test first (the important one — search):**
  - `createProperty(db, { agencyId, name, address, city, priceMinor, bedrooms, type, photos })` → row with `status="draft"`.
  - `publishProperty(db, id)` → `status="published"`.
  - `searchProperties(db, agencyId, filters)` returns only **published** properties for that agency, filtered by optional `city` (ilike), `minPrice`/`maxPrice` (on `priceMinor`), `bedrooms` (>=), `type`. No filters → all published for the agency.
  - **Isolation test:** a property from another agency is never returned.
- **Implement** with Drizzle `and(...)` building a dynamic where-array; use `ilike` for city, `gte`/`lte` for price, `gte` for bedrooms, `eq` for type, always `eq(status,"published")` + `eq(agencyId,...)`.
- Verify pass; **commit** `feat(core): property create/publish/search (agency-scoped, published-only)`.

### Task 2.6: Storage abstraction (TDD with a fake)
**Files:** Create `packages/core/src/storage.ts`; Test `packages/core/src/__tests__/storage.test.ts`.

- **Test first:** `FakeStorage` implements `Storage`; `upload(path, bytes, contentType)` records the call and returns a deterministic public URL like `https://fake.storage/<path>`.
- **Implement:**
  ```ts
  export interface Storage { upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>; }
  export class FakeStorage implements Storage { calls=[]; async upload(p,b,c){ this.calls.push({p,c,size:b.length}); return `https://fake.storage/${p}`; } }
  export class SupabaseStorage implements Storage {
    constructor(private url=process.env.SUPABASE_URL!, private key=process.env.SUPABASE_SERVICE_KEY!, private bucket=process.env.STORAGE_BUCKET ?? "kluch") {}
    async upload(path, bytes, contentType) { /* @supabase/supabase-js storage.from(bucket).upload(path, bytes, {contentType, upsert:true}); return public URL */ }
  }
  ```
  (Add `@supabase/supabase-js` to `packages/core` deps; the real impl is verified live later.)
- Verify pass; **commit** `feat(core): storage interface with Supabase impl + fake`.

### Task 2.7: Barrel exports
**Files:** Modify `packages/core/src/index.ts` to export the new modules. Typecheck. **Commit** `feat(core): export agency/listings/storage`.

---

## Milestone 3 — `apps/web` (Hono multi-tenant server)

### Task 3.1: Scaffold `apps/web`
**Files:** Create `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`.

```json
{
  "name": "@kluch/web", "private": true, "type": "module", "main": "./src/index.ts",
  "scripts": { "dev": "tsx watch src/index.ts", "start": "tsx src/index.ts", "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@kluch/core": "workspace:*", "@kluch/db": "workspace:*",
    "hono": "^4.5.0", "@hono/node-server": "^1.12.0"
  }
}
```
- `tsconfig.json` extends base (like other packages); `vitest.config.ts` mirrors core's (`fileParallelism:false`).
- `pnpm install`. **Commit** `feat(web): scaffold @kluch/web`.

### Task 3.2: Host → site resolution (TDD)
**Files:** Create `apps/web/src/site.ts`; Test `apps/web/src/__tests__/site.test.ts`.

- **Test first** (`resolveSite(host, db)` — pass a fake db/lookup or use the real test DB with a seeded agency):
  - `kluche.me` / `www.kluche.me` → `{ kind: "marketplace" }`
  - `agency.kluche.me` → `{ kind: "console" }`
  - `popovic.kluche.me` → `{ kind: "agency", agency }` (via slug)
  - `popovicnekretnine.me` (seeded custom domain) → `{ kind: "agency", agency }`
  - unknown host → `{ kind: "notfound" }`
- **Implement** `resolveSite(host, db, baseDomain="kluche.me")`: strip port; match base/www/agency; else if endsWith `.<base>` → `getAgencyBySlug(first label)`; else `getAgencyByDomain(host)`; null → notfound.
- Verify pass; **commit** `feat(web): host-based site resolution`.

### Task 3.3: Agency site renderer (TDD)
**Files:** Create `apps/web/src/render.ts`; Test `apps/web/src/__tests__/render.test.ts`.

- **Test first:** `renderAgencySite(agency, listings, filters)` returns an HTML string that:
  - contains the agency name and (if set) `<img ... src="logoUrl">`,
  - injects `--color-primary`/`--color-accent` CSS variables from the agency,
  - renders one card per listing (title, formatted price, city) with its first photo,
  - contains a `<form method="get">` with inputs named `city`, `minPrice`, `maxPrice`, `bedrooms`,
  - contains a **"Powered by Kluch"** footer.
- **Implement** a template literal producing pure HTML/CSS in the Kluch design language, themed by the agency colors. Reuse `formatMoney` from core.
- Verify pass; **commit** `feat(web): white-label agency site renderer`.

### Task 3.4: The Hono app + routing (TDD via app.request)
**Files:** Create `apps/web/src/app.ts`; Test `apps/web/src/__tests__/app.test.ts`.

- **Test first** (seed an agency + 2 published + 1 draft property in the test DB, build `app`):
  - `app.request("http://popovic.kluche.me/")` → 200, body contains both published listings, not the draft.
  - `app.request("http://popovic.kluche.me/?city=Podgorica&maxPrice=50000")` → 200, body contains only matching listing(s).
  - `app.request("http://nope.kluche.me/")` → 404.
  - `app.request("http://agency.kluche.me/")` → 200 console placeholder.
- **Implement** `createApp(db)`: middleware sets resolved site on context; `GET /` branches on `site.kind` → marketplace placeholder / console placeholder / `renderAgencySite(agency, await searchProperties(db, agency.id, query))` / 404.
- Verify pass; **commit** `feat(web): Hono app with host routing + agency site + search`.

### Task 3.5: Config + server entry
**Files:** Create `apps/web/src/config.ts` (fail-fast: `DATABASE_URL`, `BASE_DOMAIN` default `kluche.me`, `PORT` default 8080; storage vars optional) and `apps/web/src/index.ts` (create db, `createApp`, serve via `@hono/node-server`, graceful shutdown).
- **Verify (manual):** `pnpm --filter @kluch/web dev`; `curl -H "Host: popovic.kluche.me" localhost:8080/` renders the seeded agency site; `curl -H "Host: nope.kluche.me" localhost:8080/` → 404.
- **Commit** `feat(web): config + server entry`.

### Task 3.6: Seed script for local multi-tenant testing
**Files:** Create `apps/web/src/seed.ts` — creates "Popović Nekretnine" agency (slug `popovic`, brand colors), an admin user, and 3 published properties (reuse details from the brand mockups / scraped Ljubović listing). Prints the local test URL hint (`curl -H "Host: popovic.kluche.me" localhost:8080/`).
- **Verify:** run against dev DB; site renders with the seeded listings + search.
- **Commit** `feat(web): local seed for agency site`.

---

## Milestone 4 — Console write paths (config + add property)

> Minimal API the agency admin console calls. Keep endpoints small and tested via `app.request`.

### Task 4.1: Site config endpoint
- `POST /api/agency/:id/config` (admin) → `updateAgencyConfig`. Test: posting colors/tagline updates the row; the rendered site reflects new colors. **Commit** `feat(web): agency site config endpoint`.

### Task 4.2: Create + publish property endpoints
- `POST /api/agency/:id/properties` → `createProperty` (draft); `POST /api/properties/:id/publish` → `publishProperty`. Tests via `app.request` assert creation + that publish makes it appear in search. **Commit** `feat(web): property create/publish endpoints`.

### Task 4.3: Image upload endpoint
- `POST /api/agency/:id/logo` and `POST /api/properties/:id/photos` accept multipart, call `Storage.upload`, persist URL(s). Test with `FakeStorage` injected into the app (constructor param) — assert the returned URL is saved to the row. Live Supabase verification deferred. **Commit** `feat(web): image upload endpoints (storage-injected)`.

---

## Milestone 5 — Deploy

### Task 5.1: Railway service for `apps/web`
- Add `apps/web` as a Railway service (or second service in the project). Start: run migrations then `pnpm --filter @kluch/web start`. Env: `DATABASE_URL` (Supabase pooled), `DIRECT_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STORAGE_BUCKET`, `BASE_DOMAIN=kluche.me`, `PORT`.

### Task 5.2: Cloudflare DNS + wildcard TLS
- In Cloudflare for `kluche.me`: `A`/`CNAME` for `kluche.me`, `www`, `agency`, and **`*` (wildcard)** → the Railway service. Cloudflare provides `*.kluche.me` TLS automatically (proxied). Verify `https://popovic.kluche.me` serves the agency site in production.
- **Commit** `chore(web): railway + cloudflare deploy config/docs`.

### Task 5.3: Supabase Storage bucket
- Create a public `kluch` bucket; confirm `SupabaseStorage.upload` writes and the public URL renders. Document in README.

---

## Definition of done (MVP)

- An agency exists with a slug, logo, and brand colors; an admin user; and published properties with photos in Supabase Storage.
- `https://<slug>.kluche.me` renders that agency's themed, searchable site with a "Powered by Kluch" footer; search filters work; drafts and other agencies' listings never leak.
- Unknown hosts 404; `agency.kluche.me` and `kluche.me` route to their placeholders.
- `pnpm -r test` green; `pnpm -r typecheck` clean.

## Deferred (later phases)

Custom domains + Cloudflare-for-SaaS TLS · the central marketplace aggregation at `kluche.me` · the agency console UI (this plan ships its API + the rendered sites) · owner/tenant accounts · promotion billing.
