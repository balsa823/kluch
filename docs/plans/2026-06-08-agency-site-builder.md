# Agency Website Builder — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development.

**Goal:** Agency dashboard can theme its white-label site (logo, preset colour scheme, tagline) with live preview and a "View site" button; the site is served at `kluche.me/a/<name-slug>`.

**Architecture:** Name-derived slugs in core; a path route `GET /a/:slug` renders the existing white-label site; the Expo console gains a `/website` editor calling the (now auth-scoped) config + logo endpoints.

**Tech stack:** pnpm monorepo `@kluche/*`, Node 22 via nvm, Drizzle + postgres.js, Hono, Expo Router/RN-Web, Vitest (test DB :5433, `postgresql://kluch:kluch@localhost:5433/kluch_test`).

**Setup (every bash):** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22` ; run tests `pnpm --filter @kluche/core exec vitest run <file>` / `pnpm --filter @kluche/web exec vitest run src/__tests__/<file>`.

---

## Task 1: `slugify` + name-derived slug in `createAgency` (TDD, core)

**Files:** `packages/core/src/agencies.ts`, `packages/core/src/__tests__/agencies.test.ts` (existing).

**Step 1 — failing tests** (add to agencies.test.ts):
```ts
import { slugify } from "../agencies.js";
it("slugify strips diacritics, spaces, punctuation", () => {
  expect(slugify("Popović Nekretnine")).toBe("popovic-nekretnine");
  expect(slugify("  Stam!! ")).toBe("stam");
  expect(slugify("A & B  Co.")).toBe("a-b-co");
});
it("createAgency derives a unique slug from the name", async () => {
  const a = await createAgency(db, { name: "Popović Nekretnine" });
  expect(a.slug).toBe("popovic-nekretnine");
  const b = await createAgency(db, { name: "Popović Nekretnine" });
  expect(b.slug).toBe("popovic-nekretnine-2");
});
```

**Step 2:** Run → FAIL.

**Step 3 — implement** in `agencies.ts`:
```ts
export function slugify(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
```
In `createAgency`, when no slug is provided, derive from name and ensure uniqueness: query existing slugs matching `base` / `base-%`; pick `base`, else `base-2`, `base-3`…. Keep the existing signature working (if a slug is explicitly passed, still honor it for back-compat, but the console never passes one).

**Step 4:** Run → PASS. **Step 5:** commit `feat(core): slugify + name-derived unique agency slug`.

---

## Task 2: `GET /a/:slug` path-served agency site (TDD, web)

**Files:** `apps/web/src/app.ts` (add route BEFORE the host middleware `app.use("*", ...)`), `apps/web/src/__tests__/app.test.ts`.

**Step 1 — failing test:**
```ts
test("/a/:slug renders the agency site, 404 for unknown", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine" });
  const p = await createProperty(db, { agencyId: agency.id, name: "Flat", address: "x", city: "Kotor", priceMinor: 1000 });
  await publishProperty(db, p.id);
  const app = createApp(db);
  const ok = await app.request(new Request("http://kluche.me/a/popovic-nekretnine"));
  expect(ok.status).toBe(200);
  expect(await ok.text()).toContain("Popović Nekretnine");
  const miss = await app.request(new Request("http://kluche.me/a/nope"));
  expect(miss.status).toBe(404);
});
```

**Step 2:** Run → FAIL.

**Step 3 — implement** (reuse `getAgencyBySlug`, `searchProperties`, `renderAgencySite`, `parseSearchFilters`):
```ts
app.get("/a/:slug", async (c) => {
  const agency = await getAgencyBySlug(db, c.req.param("slug"));
  if (!agency) return c.text("Not found", 404);
  const filters = parseSearchFilters(c.req.query());
  const listings = await searchProperties(db, agency.id, filters);
  return c.html(renderAgencySite(agency, listings, filters));
});
```
(Import `getAgencyBySlug` if not already imported.)

**Step 4:** Run → PASS. **Step 5:** commit `feat(web): serve agency site at /a/:slug`.

---

## Task 3: auth-scope the config + logo endpoints (TDD, web)

**Files:** `apps/web/src/app.ts`, `apps/web/src/__tests__/api.test.ts`.

**Spec:** `POST /api/agency/:id/config` and `POST /api/agency/:id/logo` must require a partner token whose agency dashboard agencyId === `:id`; else 403. Use the existing `agencyScope(c)` (returns the caller's agencyId or null).

**Step 1 — failing tests** (api.test.ts): seed an agency + partner (reuse `seedPartner`); assert:
- config with the owner partner token + `{colorPrimary:"#101010",colorAccent:"#C9883C",tagline:"Hi"}` → 200 and persists.
- config with NO token → 403; config for a DIFFERENT agency id → 403.
(For logo, a unit assertion that no-token → 403 is enough; multipart upload uses FakeStorage via `createApp(db,{storage})`.)

**Step 2:** Run → FAIL (currently 200 without auth).

**Step 3 — implement:** at the top of both handlers, compute `const scope = agencyScope(c); if (!scope || scope !== id) return c.json({ error: "forbidden" }, 403);` (keep the `isUuid`/existence checks). Remove the `// TODO: auth` note.

**Step 4:** Run → PASS. **Step 5:** commit `fix(web): scope agency config/logo to the owning partner (403 otherwise)`.

---

## Task 4: console API client for site settings

**Files:** `apps/app/lib/api.ts`.

**Step 1:** Add (reuse `request`/`headers`/`BASE`):
```ts
export type AgencyConfig = { colorPrimary: string; colorAccent: string; tagline: string | null };
export function updateAgencyConfig(token: string, agencyId: string, cfg: AgencyConfig): Promise<Agency> {
  return request(`/api/agency/${agencyId}/config`, { method: "POST", headers: headers(token), body: JSON.stringify(cfg) });
}
export async function uploadAgencyLogo(token: string, agencyId: string, file: File): Promise<{ logoUrl: string }> {
  const form = new FormData();
  form.append("file", file); // endpoint reads form.file
  const res = await fetch(`${BASE}/api/agency/${agencyId}/logo`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}
/** Public URL of the agency's white-label site. */
export function agencySiteUrl(slug: string): string {
  const origin = /^https?:\/\/[^/]+/.exec(BASE)?.[0] ?? "";
  // prod: apex kluche.me; otherwise the API origin
  const host = /kluche\.me|azurecontainerapps\.io/.test(origin) ? "https://kluche.me" : origin;
  return `${host}/a/${slug}`;
}
```
Ensure `Agency` type includes `slug`, `colorPrimary`, `colorAccent`, `logoUrl`, `tagline` (extend if missing).

**Step 2:** commit `feat(app): agency config/logo API client + site URL`.

---

## Task 5: presets + `/website` editor screen (console)

**Files:** create `apps/app/app/website.tsx`; the auth context already exposes `token` + `agency`.

**Step 1:** Define presets inline:
```ts
const PRESETS = [
  { name: "Adriatic", primary: "#1F3A5C", accent: "#4E827A" },
  { name: "Gold & Black", primary: "#101010", accent: "#C9883C" },
  { name: "Sea", primary: "#0B5394", accent: "#76A5AF" },
  { name: "Olive", primary: "#3D4A2A", accent: "#8A9A5B" },
  { name: "Terracotta", primary: "#7A3B2E", accent: "#C9883C" },
  { name: "Mono", primary: "#222222", accent: "#666666" },
];
```

**Step 2:** Build the screen (RN primitives, navy theme):
- State seeded from `agency` (colorPrimary/accent/tagline/logoUrl/name/slug).
- Palette row: a swatch per preset (primary+accent), tap to select → updates state.
- Tagline `TextInput`.
- Logo: web `<input type="file">` (use `Platform.OS === "web"`); on change call `uploadAgencyLogo`, update preview logoUrl.
- **Live preview** block: a header View with `backgroundColor: primary`, bottom border `accent`, showing logo (if any) + agency name + tagline.
- **Save** button → `updateAgencyConfig(token, agency.id, {colorPrimary,colorAccent,tagline})`; show success/error.
- **View site** button → `Linking.openURL(agencySiteUrl(agency.slug))`.
- Back link → `router.replace("/agency")`.

**Step 3:** Verify `pnpm --filter @kluche/app typecheck` and `expo export --platform web --output-dir /tmp/v --clear` succeed (route `/website` emitted). **Step 4:** commit `feat(app): /website editor — presets, logo, tagline, live preview, view-site`.

---

## Task 6: "Website" entry on the agency dashboard

**Files:** `apps/app/app/agency.tsx`, `apps/app/app/_layout.tsx` (register `website` screen).

**Step 1:** Add a "Website" button in the agency dashboard header (next to "Listings"/add) that does `router.push("/website")`. Register the `website` screen in `_layout.tsx` Stack.

**Step 2:** typecheck + export succeed. **Step 3:** commit `feat(app): Website button on agency dashboard`.

---

## Task 7: deploy + slug backfill (ops)

1. Build backend image (`az acr build`, plain), `terraform apply -var backend_image=…`; confirm the new revision is **Healthy/Running** (it OOM-fixed already; resources 0.5cpu/1Gi).
2. One-off against the live DB (DATABASE_URL inline, not persisted; delete the script after): for each agency, `update slug = slugify(name)` ensuring uniqueness — or a small tsx script using `slugify` + drizzle update.
3. Rebuild the console: `EXPO_PUBLIC_API_URL=<backend_url> expo export --platform web --output-dir dist --clear` (the `--clear` is REQUIRED — a stale Metro cache previously baked `localhost:8080`), then SWA deploy.
4. Verify: `kluche.me/a/popovic-nekretnine` renders; in the console (`rent.kluche.me/login` as `admin@popovic.me`) the Website tab edits colours/logo/tagline, preview updates, Save persists, View-site opens the themed site.

## Notes
- DRY: reuse `renderAgencySite`, `agencyScope`, `slugify`, `updateAgencyConfig`. YAGNI: presets only, no custom colours, no subdomains, slug read-only.
- Logo multipart field is **`file`** (matches the endpoint), not `logo`.
