# Partner Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** One partner login (agencies + lawyers) in a single `partner_users` table whose token carries the set of accessible dashboards, redirecting each partner to their vertical dashboard subdomain (`rent.kluche.me` / `law.kluche.me`).

**Architecture:** New `partner_users` table with a `dashboards` jsonb map (key → metadata). New `/api/platform/login` + `/api/platform/me` on the Hono backend issue/verify a token whose payload includes a `dashboards` array of keys. The existing Expo console SPA gains a vertical-agnostic `/login`, an `/agency` dashboard (existing listings, scoped via the partner's `agencyId`), and a `/law` stub; after login it redirects to the first dashboard's subdomain (or in-app route when not on a `*.kluche.me` host), passing the token in the URL fragment. A "Take me to the platform" link is added to the public landing page.

**Tech Stack:** pnpm monorepo (`@kluche/*`), Node 22 via nvm, Drizzle ORM + postgres.js, drizzle-kit migrations, Hono, Expo Router (React-Native-Web), Vitest (test DB on :5433 via `docker-compose.test.yml`), Azure Container Apps + Static Web App, Terraform.

**Prerequisites for the implementer:**
- `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`
- Test DB up: `docker compose -f docker-compose.test.yml up -d` then `DATABASE_URL=postgres://postgres:postgres@localhost:5433/kluch_test pnpm --filter @kluche/db migrate`
- Run a package's tests: `pnpm --filter @kluche/core test` / `pnpm --filter @kluche/web test`

---

## Task 1: `partner_users` schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts` (after the `agencyUsers` block, ~line 74)
- Generate: `packages/db/migrations/0003_*.sql`

**Step 1:** Add the table to `schema.ts`:

```ts
// Unified partner login (agencies + lawyers). `dashboards` maps a dashboard key
// ("agency" | "law") to its metadata, e.g. { agency: { agencyId } } or { law: { lawFirmId } }.
export const partnerUsers = pgTable("partner_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  dashboards: jsonb("dashboards").$type<Record<string, Record<string, string>>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Ensure `jsonb` is imported from `drizzle-orm/pg-core` at the top of the file (add to the existing import if missing).

**Step 2:** Generate the migration:
```bash
pnpm --filter @kluche/db generate
```
Expected: a new `migrations/0003_*.sql` creating `partner_users`.

**Step 3:** Apply to the test DB and verify:
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/kluch_test pnpm --filter @kluche/db migrate
```
Expected: migration runs clean.

**Step 4:** Commit.
```bash
git add packages/db/src/schema.ts packages/db/migrations
git commit -m "feat(db): partner_users table with dashboards map"
```

---

## Task 2: core `partnerUsers` + auth helpers (TDD)

**Files:**
- Create: `packages/core/src/partnerUsers.ts`
- Create: `packages/core/src/__tests__/partnerUsers.test.ts`
- Modify: `packages/core/src/index.ts` (add `export * from "./partnerUsers.js";`)

**Step 1 — failing test** (`partnerUsers.test.ts`), mirror existing core tests (see `agencyUsers` usage and `packages/db/src/test-helpers.ts` for `db`, `resetDb`):

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "@kluche/db/test-helpers";
import { createPartnerUser, verifyPartnerUser, getPartnerUserById, dashboardKeys } from "../partnerUsers.js";

beforeEach(async () => { await resetDb(); });

describe("partnerUsers", () => {
  it("creates and verifies by password", async () => {
    const u = await createPartnerUser(db, {
      email: "P@Agency.me", password: "secret123",
      dashboards: { agency: { agencyId: "00000000-0000-0000-0000-000000000001" } },
    });
    expect(u.email).toBe("p@agency.me");
    expect(await verifyPartnerUser(db, "p@agency.me", "secret123")).toMatchObject({ id: u.id });
    expect(await verifyPartnerUser(db, "p@agency.me", "wrong")).toBeNull();
  });

  it("dashboardKeys returns the map keys", () => {
    expect(dashboardKeys({ agency: { agencyId: "x" } })).toEqual(["agency"]);
    expect(dashboardKeys({})).toEqual([]);
  });
});
```

**Step 2:** Run, expect FAIL (module missing):
```bash
pnpm --filter @kluche/core exec vitest run src/__tests__/partnerUsers.test.ts
```

**Step 3 — implement** `partnerUsers.ts`:

```ts
import { eq } from "drizzle-orm";
import { partnerUsers, type Database } from "@kluche/db";
import { hashPassword, verifyPassword } from "./auth.js";

export type PartnerUser = typeof partnerUsers.$inferSelect;
export type DashboardMap = Record<string, Record<string, string>>;

export function dashboardKeys(d: DashboardMap): string[] {
  return Object.keys(d ?? {});
}

export async function createPartnerUser(
  db: Database,
  input: { email: string; name?: string; password?: string; dashboards: DashboardMap },
): Promise<PartnerUser> {
  const [u] = await db.insert(partnerUsers).values({
    email: input.email.toLowerCase().trim(),
    name: input.name,
    passwordHash: input.password ? hashPassword(input.password) : undefined,
    dashboards: input.dashboards,
  }).returning();
  return u;
}

export async function getPartnerUserById(db: Database, id: string): Promise<PartnerUser | null> {
  const [u] = await db.select().from(partnerUsers).where(eq(partnerUsers.id, id));
  return u ?? null;
}

export async function verifyPartnerUser(db: Database, email: string, password: string): Promise<PartnerUser | null> {
  const [u] = await db.select().from(partnerUsers).where(eq(partnerUsers.email, email.toLowerCase().trim()));
  if (!u || !u.passwordHash) return null;
  return verifyPassword(password, u.passwordHash) ? u : null;
}
```

**Step 4:** Run, expect PASS. **Step 5:** Commit `feat(core): partnerUsers create/verify + dashboardKeys`.

---

## Task 3: platform login + me endpoints (TDD)

**Files:**
- Modify: `apps/web/src/app.ts` (add routes near `/api/auth/login`, ~line 135; add a `bearerPartner` helper near `bearerUser`, ~line 123)
- Modify: `apps/web/src/__tests__/api.test.ts` (add a describe block)

**Token shape:** `signToken({ sub: partnerUser.id, dashboards: dashboardKeys(u.dashboards) }, sessionSecret, TOKEN_TTL)`.

**Step 1 — failing test** in `api.test.ts` (follow the file's existing setup: it builds the app with `createApp(db, {...})` and seeds via core helpers). Add:

```ts
it("platform login returns a token carrying dashboard keys", async () => {
  const agency = await createAgency(db, { name: "Acme", slug: "acme" });
  await createPartnerUser(db, {
    email: "p@acme.me", password: "pw123456",
    dashboards: { agency: { agencyId: agency.id } },
  });
  const res = await app.request("/api/platform/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "p@acme.me", password: "pw123456" }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.dashboards).toEqual(["agency"]);
  expect(typeof body.token).toBe("string");

  const me = await app.request("/api/platform/me", { headers: { authorization: `Bearer ${body.token}` } });
  expect(me.status).toBe(200);
  const meBody = await me.json();
  expect(meBody.dashboards).toEqual(["agency"]);
  expect(meBody.agency?.id).toBe(agency.id);
});

it("platform login rejects bad credentials", async () => {
  const res = await app.request("/api/platform/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nobody@x.me", password: "x" }),
  });
  expect(res.status).toBe(401);
});
```

Add imports at the top of the test as needed: `createPartnerUser`, `createAgency`.

**Step 2:** Run, expect FAIL:
```bash
pnpm --filter @kluche/web exec vitest run src/__tests__/api.test.ts
```

**Step 3 — implement** in `app.ts`. Add imports: `verifyPartnerUser, getPartnerUserById, dashboardKeys` from `@kluche/core`. Add a partner resolver and routes:

```ts
/** Resolves the partner user from a Bearer token, or null. */
async function bearerPartner(c: Context) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const payload = verifyToken<{ sub?: string }>(header.slice("Bearer ".length), sessionSecret);
  if (!payload?.sub) return null;
  return getPartnerUserById(db, payload.sub);
}

app.post("/api/platform/login", async (c) => {
  const { email, password } = await c.req.json();
  const u = await verifyPartnerUser(db, String(email ?? ""), String(password ?? ""));
  if (!u) return c.json({ error: "invalid credentials" }, 401);
  const dashboards = dashboardKeys(u.dashboards);
  return c.json({
    token: signToken({ sub: u.id, dashboards }, sessionSecret, TOKEN_TTL),
    dashboards,
    user: { id: u.id, email: u.email, name: u.name },
  });
});

app.get("/api/platform/me", async (c) => {
  const u = await bearerPartner(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const dashboards = dashboardKeys(u.dashboards);
  const agencyId = u.dashboards?.agency?.agencyId;
  const agency = agencyId ? await getAgency(db, agencyId) : null;
  return c.json({ user: { id: u.id, email: u.email, name: u.name }, dashboards, agency });
});
```

Also extend the agency-scoped listing endpoints to accept a partner token: in `GET /api/listings` and `POST /api/listings`, if `bearerUser` is null, fall back to `bearerPartner` and use `partner.dashboards.agency.agencyId` as the agency scope. (Keep the existing agency_users path working.) Add a small helper `agencyScope(c)` returning the agencyId from whichever token type is present.

**Step 4:** Run, expect PASS. **Step 5:** Commit `feat(web): /api/platform/login + /me with dashboards token`.

---

## Task 4: seed an agency partner user

**Files:**
- Modify: `apps/web/src/seed.ts` (after the agency + agency-user seed)

**Step 1:** After the existing seed creates the agency, also create a partner user (idempotent — only when missing):

```ts
import { createPartnerUser, verifyPartnerUser } from "@kluche/core";
// ...after agency is created/seeded...
if (!(await verifyPartnerUser(db, "admin@popovic.me", "kluch1234"))) {
  await createPartnerUser(db, {
    email: "admin@popovic.me", name: "Balša", password: "kluch1234",
    dashboards: { agency: { agencyId: agency.id } },
  });
}
```

**Step 2:** Run seed against the test DB; verify login works via a quick `verifyPartnerUser` check (or rely on Task 3 tests). **Step 3:** Commit `feat(web): seed agency partner user`.

---

## Task 5: console API client — platform login/me

**Files:**
- Modify: `apps/app/lib/api.ts`

**Step 1:** Add types + functions (mirror existing `login`/`me`):

```ts
export type PartnerLogin = { token: string; dashboards: string[]; user: { id: string; email: string; name: string | null } };

export function platformLogin(email: string, password: string): Promise<PartnerLogin> {
  return request("/api/platform/login", {
    method: "POST", headers: headers(), body: JSON.stringify({ email, password }),
  });
}

export function platformMe(token: string): Promise<{ user: any; dashboards: string[]; agency: Agency | null }> {
  return request("/api/platform/me", { method: "GET", headers: headers(token) });
}
```

**Step 2:** Commit `feat(app): platform login/me API client`.

---

## Task 6: dashboard subdomain map + redirect helper

**Files:**
- Create: `apps/app/lib/platform.ts`

**Step 1:** Implement the vertical→subdomain map + redirect logic (web only):

```ts
export const DASHBOARD_HOSTS: Record<string, string> = {
  agency: "rent.kluche.me",
  law: "law.kluche.me",
};
export const DASHBOARD_ROUTES: Record<string, string> = {
  agency: "/agency",
  law: "/law",
};

/** True when running on a *.kluche.me host (production subdomains). */
function isKlucheHost(): boolean {
  return typeof window !== "undefined" && /\.kluche\.me$/.test(window.location.hostname);
}

/**
 * Routes a freshly-authenticated partner to their first dashboard.
 * On *.kluche.me: cross-subdomain redirect with the token in the fragment.
 * Elsewhere (localhost / SWA default): in-app navigation, token already stored.
 */
export function routeToDashboard(token: string, dashboards: string[], navigate: (path: string) => void) {
  const key = dashboards[0];
  if (!key) return;
  if (isKlucheHost()) {
    const host = DASHBOARD_HOSTS[key];
    if (host && window.location.hostname !== host) {
      window.location.href = `https://${host}/#token=${encodeURIComponent(token)}`;
      return;
    }
  }
  navigate(DASHBOARD_ROUTES[key] ?? "/agency");
}
```

**Step 2:** Commit `feat(app): dashboard subdomain map + routeToDashboard`.

---

## Task 7: capture token from URL fragment on load

**Files:**
- Modify: `apps/app/lib/auth.tsx` (in the boot effect, before reading stored token)

**Step 1:** At the start of the boot effect, if `window.location.hash` contains `token=`, store it and strip the hash:

```ts
if (typeof window !== "undefined" && window.location.hash.includes("token=")) {
  const m = window.location.hash.match(/token=([^&]+)/);
  if (m) {
    await setToken(decodeURIComponent(m[1]));
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
```

**Step 2:** Manually verify on web (`pnpm --filter @kluche/app exec expo start --web`) that visiting `/#token=abc` stores `abc` and clears the hash. **Step 3:** Commit `feat(app): accept handoff token from URL fragment`.

---

## Task 8: platform login screen + auth wiring

**Files:**
- Modify: `apps/app/lib/auth.tsx` (switch `login` to `platformLogin`; store `dashboards`; expose them)
- Modify: `apps/app/app/login.tsx` (call platform login, then `routeToDashboard`)

**Step 1:** In `auth.tsx`, change `login` to call `platformLogin`, persist the token, set `dashboards` state, hydrate via `platformMe`. Boot effect uses `platformMe` instead of `me`. Expose `dashboards: string[]` on the context.

**Step 2:** In `login.tsx`, after a successful `login(email, password)`, call `routeToDashboard(token, dashboards, (p) => router.replace(p))`.

**Step 3:** Manually verify on web: logging in as `admin@popovic.me / kluch1234` navigates to `/agency`. **Step 4:** Commit `feat(app): platform login → route to first dashboard`.

---

## Task 9: `/agency` (existing dashboard) + `/law` stub + index routing

**Files:**
- Rename/keep: `apps/app/app/dashboard.tsx` → expose at `/agency` (create `apps/app/app/agency.tsx` re-exporting, or move the file and update links)
- Create: `apps/app/app/law.tsx` (stub)
- Modify: `apps/app/app/index.tsx` (redirect by auth + dashboards)

**Step 1:** `law.tsx` — minimal stub using existing theme tokens:

```tsx
import { View, Text } from "react-native";
export default function Law() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1F3A5C" }}>
      <Text style={{ color: "#F1ECE0", fontSize: 22, fontWeight: "700" }}>Law dashboard</Text>
      <Text style={{ color: "#9fb0c3", marginTop: 8 }}>Coming soon</Text>
    </View>
  );
}
```

**Step 2:** Make the agency dashboard available at `/agency` (move `dashboard.tsx` → `agency.tsx`, or add a thin `agency.tsx` that renders the same component). Update any internal links (`/dashboard` → `/agency`).

**Step 3:** `index.tsx` — when authed, `routeToDashboard` using stored token + dashboards; else `/login`.

**Step 4:** Manually verify on web: authed partner with `["agency"]` lands on `/agency`; visiting `/law` shows the stub. **Step 5:** Commit `feat(app): /agency dashboard + /law stub + index routing`.

---

## Task 10: "Take me to the platform" button on the landing page

**Files:**
- Modify: `index.html` and `apps/web/static/landing.html` (keep them in sync), and `brand/landing.html`

**Step 1:** Add a small fixed top-right link in the landing header:

```html
<a class="platform-link" href="https://rent.kluche.me/login">Take me to the platform →</a>
```
with CSS placing it top-right (position: fixed; top/right ~1rem; subtle pill). For local/non-prod, the href can stay as the production URL (it only matters in prod).

**Step 2:** Sync `cp index.html apps/web/static/landing.html`. **Step 3:** Local check via the web server (`/` serves the landing with the button). **Step 4:** Commit `feat(web): platform entry button on landing`.

---

## Task 11: deploy + DNS

**Files:** none (ops)

**Step 1:** Build the backend image and roll it (this also carries the pending business-plan deck edits):
```bash
cd infra
ACR=$(terraform output -raw acr_login_server); TAG="platform-$(date +%Y%m%d%H%M%S)"
az acr build -r "${ACR%%.*}" -t "kluch-backend:$TAG" -t kluch-backend:latest -f ../Dockerfile ..
terraform apply -auto-approve -var "backend_image=${ACR}/kluch-backend:$TAG"
```
(NOTE: this CLI's `az acr build` does NOT support `--no-cache`; a content change busts the COPY layer on its own. After rolling, confirm the active revision is Healthy via `az containerapp revision list` before declaring success.)

**Step 2:** Build + deploy the console to the SWA:
```bash
BACKEND_URL=$(terraform -chdir=infra output -raw backend_url)
EXPO_PUBLIC_API_URL="$BACKEND_URL" pnpm --filter @kluche/app exec expo export --platform web --output-dir dist
npx @azure/static-web-apps-cli deploy apps/app/dist --deployment-token "$(terraform -chdir=infra output -raw swa_api_token)" --env production
```

**Step 3:** DNS at Namecheap — add CNAMEs `rent` and `law` → `<swa_default_hostname>`; bind both custom domains on the SWA (`az staticwebapp hostname set`). Verify `https://rent.kluche.me/login` and `https://law.kluche.me` resolve over TLS.

**Step 4:** End-to-end check: `kluche.me` → button → login as `admin@popovic.me` → lands on the agency dashboard (rent) with listings.

**Step 5:** Commit any config; push `master`.

---

## Notes
- DRY: reuse `hashPassword`/`verifyPassword` and `signToken`/`verifyToken` — do not reimplement.
- YAGNI: no chooser UI, no law data model beyond the `dashboards` metadata, no foreigner accounts this pass.
- Keep the existing `/api/auth/login` (agency_users) working for backward compat; the console moves to platform login.
- Tests that touch the DB require the test Postgres on :5433.
