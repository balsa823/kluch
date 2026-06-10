import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import {
  addPropertyPhotos,
  createInquiry,
  createProperty,
  createVisitor,
  dashboardKeys,
  deleteProperty,
  ListingHasLeasesError,
  setPropertyStatus,
  updateProperty,
  getAgency,
  getAgencyBySlug,
  getAgencyUserById,
  getPartnerUserById,
  getProperty,
  getVisitorById,
  importListing,
  listAgencyProperties,
  listInquiries,
  publishProperty,
  searchProperties,
  signToken,
  updateAgencyConfig,
  verifyAgencyUser,
  verifyPartnerUser,
  verifyToken,
  verifyVisitor,
  type AgencyUser,
  type PartnerUser,
  type Visitor,
  type Property,
  type PropertyType,
  countProperties,
  type SearchFilters,
  type Storage,
} from "@kluche/core";
import type { Database } from "@kluche/db";
import { resolveSite, type Site } from "./site.js";
import { renderAgencySite } from "./render.js";

type Vars = { site: Site };

const PROPERTY_TYPES: PropertyType[] = ["residential", "land", "commercial"];

/** Number of listings shown per page on the agency white-label site. */
const AGENCY_PAGE_SIZE = 24;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if the string is a canonical UUID. Guards against path traversal in storage keys. */
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;

/** Bearer-token lifetime: 7 days. */
const TOKEN_TTL = 60 * 60 * 24 * 7;

/** Parses raw query params into the core SearchFilters shape, ignoring blanks. */
export function parseSearchFilters(query: Record<string, string | undefined>): SearchFilters {
  const filters: SearchFilters = {};

  const city = query.city?.trim();
  if (city) filters.city = city;

  // The search form takes euros; prices are stored in cents (priceMinor) — convert.
  const minPrice = toInt(query.minPrice);
  if (minPrice !== undefined) filters.minPrice = minPrice * 100;

  const maxPrice = toInt(query.maxPrice);
  if (maxPrice !== undefined) filters.maxPrice = maxPrice * 100;

  const bedrooms = toInt(query.bedrooms);
  if (bedrooms !== undefined) filters.bedrooms = bedrooms;

  const type = query.type?.trim();
  if (type && (PROPERTY_TYPES as string[]).includes(type)) filters.type = type as PropertyType;

  if (query.dealType === "rent" || query.dealType === "sale") filters.dealType = query.dealType;

  const page = toInt(query.page);
  if (page !== undefined && page > 0) filters.page = page;

  // Ref-code look-up: normalize (trim + uppercase) and accept only well-formed
  // codes (XX-NNNN). Junk is ignored silently so it doesn't filter to nothing.
  if (query.code !== undefined) {
    const code = query.code.trim().toUpperCase();
    if (/^[A-Z]{2,6}-\d+$/.test(code)) filters.refCode = code;
  }

  return filters;
}

function toInt(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number.parseInt(trimmed, 10);
  return Number.isNaN(n) ? undefined : n;
}

// Static landing-page assets shipped with the app (apps/web/static).
const STATIC_DIR = fileURLToPath(new URL("../static", import.meta.url));

/** The marketing landing page, loaded once and cached. Falls back to a stub if missing. */
let landingHtmlCache: string | null = null;
async function landingHtml(): Promise<string> {
  if (landingHtmlCache === null) {
    try {
      landingHtmlCache = await readFile(join(STATIC_DIR, "landing.html"), "utf8");
    } catch {
      landingHtmlCache = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kluch</title></head><body><h1>Kluch — Your keys to Montenegro</h1></body></html>`;
    }
  }
  return landingHtmlCache;
}
const CONSOLE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kluch</title></head><body><h1>Kluch agency console</h1></body></html>`;

/** File extension for a given content type, defaulting to bin. */
function extForType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[contentType] ?? "bin";
}

/** Content-type for a filename, guessed from its extension. */
function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

export interface CreateAppOptions {
  baseDomain?: string;
  storage?: Storage;
  sessionSecret?: string;
  uploadDir?: string;
}

/** Builds the multi-tenant web app: marketplace, agency console and white-label sites. */
export function createApp(db: Database, opts: CreateAppOptions = {}) {
  const {
    baseDomain = "kluche.me",
    storage,
    sessionSecret = "dev-secret-change-me",
    uploadDir = "./data/uploads",
  } = opts;
  const app = new Hono<{ Variables: Vars }>();

  /** Resolves the agency user from a `Authorization: Bearer <token>` header, or null. */
  async function bearerUser(c: Context): Promise<AgencyUser | null> {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const payload = verifyToken<{ sub?: string }>(header.slice("Bearer ".length), sessionSecret);
    if (!payload?.sub) return null;
    return getAgencyUserById(db, payload.sub);
  }

  /** Resolves the partner user from a `Authorization: Bearer <token>` header, or null. */
  async function bearerPartner(c: Context): Promise<PartnerUser | null> {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const payload = verifyToken<{ sub?: string }>(header.slice("Bearer ".length), sessionSecret);
    if (!payload?.sub) return null;
    return getPartnerUserById(db, payload.sub);
  }

  /**
   * Resolves the visitor from a `Authorization: Bearer <token>` header, or null.
   * Requires the token to carry the `t: "visitor"` claim so a visitor token can
   * never be mistaken for an agency/partner token (and vice versa).
   */
  async function bearerVisitor(c: Context): Promise<Visitor | null> {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const payload = verifyToken<{ sub?: string; t?: string }>(header.slice("Bearer ".length), sessionSecret);
    if (payload?.t !== "visitor" || !payload.sub) return null;
    return getVisitorById(db, payload.sub);
  }

  /**
   * Resolves the agency id from whichever token is present: an agency-user token
   * takes precedence, falling back to a partner token's `agency` dashboard.
   */
  async function agencyScope(c: Context): Promise<string | null> {
    const user = await bearerUser(c);
    if (user) return user.agencyId;
    const partner = await bearerPartner(c);
    return partner?.dashboards?.agency?.agencyId ?? null;
  }

  /**
   * Returns the property if `id` is a valid UUID owned by the caller's agency,
   * else null (caller maps null to 403). Foreign or missing listings are indistinguishable.
   */
  async function ownedListing(c: Context, id: string): Promise<Property | null> {
    if (!isUuid(id)) return null;
    const scope = await agencyScope(c);
    if (!scope) return null;
    const p = await getProperty(db, id);
    return p && p.agencyId === scope ? p : null;
  }

  app.get("/health", (c) => c.text("ok"));

  app.use("/api/*", cors());

  app.post("/api/auth/login", async (c) => {
    const { email, password } = await c.req.json();
    const user = await verifyAgencyUser(db, String(email ?? ""), String(password ?? ""));
    if (!user) return c.json({ error: "invalid credentials" }, 401);
    return c.json({
      token: signToken({ sub: user.id }, sessionSecret, TOKEN_TTL),
      user: { id: user.id, email: user.email, role: user.role, agencyId: user.agencyId },
    });
  });

  app.post("/api/platform/login", async (c) => {
    const { email, password } = await c.req.json();
    const u = await verifyPartnerUser(db, String(email ?? ""), String(password ?? ""));
    if (!u) return c.json({ error: "invalid credentials" }, 401);
    const dashboards = dashboardKeys(u.dashboards);
    // `dashboards` in the token is informational for clients only; the server always
    // re-derives access from the DB row (bearerPartner), never trusting this claim for authz.
    return c.json({
      token: signToken({ sub: u.id, dashboards }, sessionSecret, TOKEN_TTL),
      dashboards,
      user: { id: u.id, email: u.email, name: u.name },
    });
  });

  app.get("/api/platform/me", async (c) => {
    const u = await bearerPartner(c);
    if (!u) return c.json({ error: "unauthorized" }, 401);
    const agencyId = u.dashboards?.agency?.agencyId;
    return c.json({
      user: { id: u.id, email: u.email, name: u.name },
      dashboards: dashboardKeys(u.dashboards),
      agency: agencyId ? await getAgency(db, agencyId) : null,
    });
  });

  app.get("/api/me", async (c) => {
    const user = await bearerUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    return c.json({ user, agency: await getAgency(db, user.agencyId) });
  });

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  app.post("/api/visitor/signup", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
    const body = await c.req.json().catch(() => ({})) as { email?: unknown; password?: unknown; name?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!EMAIL_RE.test(email)) return c.json({ error: "invalid email" }, 400);
    if (password.length < 8 || password.length > 200) return c.json({ error: "invalid password" }, 400);
    if (name.length > 120) return c.json({ error: "invalid name" }, 400);
    let v: Visitor;
    try {
      v = await createVisitor(db, { email, name: name || undefined, password });
    } catch (e) {
      // 409 only for a duplicate email (unique violation); anything else surfaces as 500.
      if ((e as { code?: string })?.code === "23505") return c.json({ error: "email already registered" }, 409);
      throw e;
    }
    return c.json({
      token: signToken({ sub: v.id, t: "visitor" }, sessionSecret, TOKEN_TTL),
      visitor: { id: v.id, email: v.email, name: v.name },
    });
  });

  app.post("/api/visitor/login", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
    const body = await c.req.json().catch(() => ({})) as { email?: unknown; password?: unknown };
    const v = await verifyVisitor(db, String(body.email ?? ""), String(body.password ?? ""));
    if (!v) return c.json({ error: "invalid credentials" }, 401);
    return c.json({
      token: signToken({ sub: v.id, t: "visitor" }, sessionSecret, TOKEN_TTL),
      visitor: { id: v.id, email: v.email, name: v.name },
    });
  });

  app.get("/api/visitor/me", async (c) => {
    const v = await bearerVisitor(c);
    if (!v) return c.json({ error: "unauthorized" }, 401);
    return c.json({ visitor: { id: v.id, email: v.email, name: v.name } });
  });

  app.get("/api/listings", async (c) => {
    const agencyId = await agencyScope(c);
    if (!agencyId) return c.json({ error: "unauthorized" }, 401);
    const listings = await listAgencyProperties(db, agencyId);
    return c.json({ listings });
  });

  app.post("/api/listings", async (c) => {
    const agencyId = await agencyScope(c);
    if (!agencyId) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json();
    // Always scope to the token's agency; ignore any agencyId in the body.
    const property = await createProperty(db, { ...body, agencyId });
    const published = await publishProperty(db, property.id);
    return c.json(published, 201);
  });

  app.post("/api/listings/import", async (c) => {
    const user = await bearerUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return c.json({ error: "url is required" }, 400);
    try {
      const property = await importListing(db, user.agencyId, url, storage);
      return c.json(property, 201);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  const PROPERTY_TYPE_VALUES: PropertyType[] = ["residential", "land", "commercial"];
  const DEAL_TYPE_VALUES = ["rent", "sale"] as const;

  app.post("/api/listings/:id", bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const p = await ownedListing(c, id);
    if (!p) return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const patch: Parameters<typeof updateProperty>[2] = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.address === "string") patch.address = body.address.trim();
    if (typeof body.city === "string") patch.city = body.city.trim();
    if (typeof body.priceMinor === "number") patch.priceMinor = body.priceMinor; // cents
    if (typeof body.currency === "string") patch.currency = body.currency.trim().toUpperCase().slice(0, 3);
    if (typeof body.bedrooms === "number") patch.bedrooms = body.bedrooms;
    if (typeof body.bathrooms === "number") patch.bathrooms = body.bathrooms;
    if (typeof body.areaM2 === "number") patch.areaM2 = body.areaM2;
    if (typeof body.type === "string" && PROPERTY_TYPE_VALUES.includes(body.type as PropertyType)) {
      patch.type = body.type as PropertyType;
    }
    if (typeof body.dealType === "string" && (DEAL_TYPE_VALUES as readonly string[]).includes(body.dealType)) {
      patch.dealType = body.dealType as "rent" | "sale";
    }
    const updated = await updateProperty(db, id, patch);
    return c.json(updated);
  });

  app.post("/api/listings/:id/status", bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const p = await ownedListing(c, id);
    if (!p) return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json().catch(() => ({})) as { status?: unknown };
    try {
      const updated = await setPropertyStatus(db, id, body.status as never);
      return c.json(updated);
    } catch {
      return c.json({ error: "invalid status" }, 400);
    }
  });

  app.delete("/api/listings/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const p = await ownedListing(c, id);
    if (!p) return c.json({ error: "forbidden" }, 403);
    try {
      await deleteProperty(db, id);
    } catch (e) {
      if (e instanceof ListingHasLeasesError) return c.json({ error: "listing has active leases" }, 409);
      throw e;
    }
    return c.json({ ok: true });
  });

  app.get("/uploads/*", async (c) => {
    const rest = c.req.path.slice("/uploads/".length);
    // Reject path traversal before touching the filesystem.
    if (rest.includes("..")) return c.text("Not found", 404);
    try {
      const bytes = await readFile(join(uploadDir, rest));
      return c.body(bytes, 200, { "content-type": contentTypeFor(rest) });
    } catch {
      return c.text("Not found", 404);
    }
  });

  // Static assets for the marketing landing page (logo + photos), shipped in apps/web/static.
  app.get("/brand/*", async (c) => {
    const rest = c.req.path.slice("/brand/".length);
    if (rest.includes("..")) return c.text("Not found", 404);
    try {
      const bytes = await readFile(join(STATIC_DIR, "brand", rest));
      return c.body(bytes, 200, { "content-type": contentTypeFor(rest) });
    } catch {
      return c.text("Not found", 404);
    }
  });

  // Standalone static files served at the apex (business plan + its logo).
  for (const file of ["bussines_plan.html", "logo.png"] as const) {
    app.get(`/${file}`, async (c) => {
      try {
        const bytes = await readFile(join(STATIC_DIR, file));
        const type = file.endsWith(".html") ? "text/html; charset=utf-8" : contentTypeFor(file);
        return c.body(bytes, 200, { "content-type": type });
      } catch {
        return c.text("Not found", 404);
      }
    });
  }

  app.get("/a/:slug", async (c) => {
    const agency = await getAgencyBySlug(db, c.req.param("slug"));
    if (!agency) return c.text("Not found", 404);
    const filters = parseSearchFilters(c.req.query());
    const pageSize = AGENCY_PAGE_SIZE;
    const page = Math.max(1, filters.page ?? 1);
    const offset = (page - 1) * pageSize;
    const listings = await searchProperties(db, agency.id, filters, { limit: pageSize, offset });
    const total = await countProperties(db, agency.id, filters);
    return c.html(
      renderAgencySite(agency, listings, filters, {
        sent: c.req.query("sent") === "1",
        page,
        pageSize,
        total,
      }),
    );
  });

  app.post("/a/:slug/inquiry", bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
    const agency = await getAgencyBySlug(db, c.req.param("slug"));
    if (!agency) return c.text("Not found", 404);
    const form = await c.req.parseBody();
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    if (s(form.company)) return c.redirect(`/a/${agency.slug}?sent=1`, 303); // honeypot — drop silently
    const name = s(form.name), contact = s(form.contact), message = s(form.message);
    if (!name || !contact || name.length > 120 || contact.length > 200 || message.length > 2000)
      return c.json({ error: "invalid" }, 400);
    // Only attach propertyId if it's a real property belonging to THIS agency; else ignore it
    // (avoids FK-violation 500s and cross-agency links from a forged field).
    let propertyId: string | undefined = s(form.propertyId) || undefined;
    if (propertyId) {
      const prop = isUuid(propertyId) ? await getProperty(db, propertyId) : null;
      if (!prop || prop.agencyId !== agency.id) propertyId = undefined;
    }
    await createInquiry(db, { agencyId: agency.id, propertyId, name, contact, message: message || undefined });
    return c.redirect(`/a/${agency.slug}?sent=1`, 303);
  });

  // Public: logs a "show number" click and returns the agency phone to reveal.
  app.post("/a/:slug/phone-click", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
    const agency = await getAgencyBySlug(db, c.req.param("slug"));
    if (!agency) return c.text("Not found", 404);
    // The client posts JSON; tolerate a missing/garbled body.
    const body = await c.req.json().catch(() => ({})) as { propertyId?: unknown };
    // Only attach a real property belonging to THIS agency; else drop it
    // (mirrors the inquiry endpoint's forged-propertyId guard).
    let propertyId: string | undefined =
      (typeof body.propertyId === "string" ? body.propertyId.trim() : "") || undefined;
    if (propertyId) {
      const prop = isUuid(propertyId) ? await getProperty(db, propertyId) : null;
      if (!prop || prop.agencyId !== agency.id) propertyId = undefined;
    }
    await createInquiry(db, { agencyId: agency.id, propertyId, kind: "phone_click" });
    return c.json({ phone: agency.phone ?? null });
  });

  // Authenticated visitor requests a tour of a listing belonging to this agency.
  app.post("/a/:slug/tour", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
    const agency = await getAgencyBySlug(db, c.req.param("slug"));
    if (!agency) return c.text("Not found", 404);
    const visitor = await bearerVisitor(c);
    if (!visitor) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => ({})) as {
      propertyId?: unknown; tourDate?: unknown; note?: unknown;
    };
    const tourDate = typeof body.tourDate === "string" ? body.tourDate.trim() : "";
    if (!tourDate || tourDate.length > 40) return c.json({ error: "invalid tourDate" }, 400);
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 2000) return c.json({ error: "invalid note" }, 400);
    // A tour must target a real listing of THIS agency, if a propertyId is given.
    let propertyId: string | undefined =
      (typeof body.propertyId === "string" ? body.propertyId.trim() : "") || undefined;
    if (propertyId) {
      const prop = isUuid(propertyId) ? await getProperty(db, propertyId) : null;
      if (!prop || prop.agencyId !== agency.id) return c.json({ error: "invalid propertyId" }, 400);
    }
    await createInquiry(db, {
      agencyId: agency.id,
      propertyId,
      kind: "tour",
      visitorId: visitor.id,
      tourDate,
      message: note || undefined,
      name: visitor.name ?? null,
      contact: visitor.email,
    });
    return c.json({ ok: true }, 201);
  });

  app.use("*", async (c, next) => {
    // Prefer the Host header; fall back to the request URL's host (e.g. in unit
    // tests where `app.request(new Request(url))` doesn't set a Host header).
    const host = c.req.header("host") ?? new URL(c.req.url).host;
    c.set("site", await resolveSite(host, db, baseDomain));
    await next();
  });

  app.get("/", async (c) => {
    const site = c.get("site");
    switch (site.kind) {
      case "marketplace":
        return c.html(await landingHtml());
      case "console":
        return c.html(CONSOLE);
      case "agency": {
        const filters = parseSearchFilters(c.req.query());
        const pageSize = AGENCY_PAGE_SIZE;
        const page = Math.max(1, filters.page ?? 1);
        const offset = (page - 1) * pageSize;
        const listings = await searchProperties(db, site.agency.id, filters, {
          limit: pageSize,
          offset,
        });
        const total = await countProperties(db, site.agency.id, filters);
        return c.html(
          renderAgencySite(site.agency, listings, filters, {
            sent: c.req.query("sent") === "1",
            page,
            pageSize,
            total,
          }),
        );
      }
      default:
        return c.text("Not found", 404);
    }
  });

  app.get("/api/agency/leads", async (c) => {
    const scope = await agencyScope(c);
    if (!scope) return c.json({ error: "forbidden" }, 403);
    const raw = c.req.query("kind");
    const kind = raw === "inquiry" || raw === "tour" || raw === "phone_click" ? raw : undefined;
    const leads = await listInquiries(db, scope, { kind });
    // Enrich each lead with its property name (one lookup per distinct property).
    const ids = [...new Set(leads.map((l) => l.propertyId).filter((id): id is string => !!id))];
    const names = new Map<string, string>();
    for (const id of ids) {
      const prop = await getProperty(db, id);
      if (prop) names.set(id, prop.name);
    }
    const enriched = leads.map((l) => ({
      ...l,
      propertyName: l.propertyId ? names.get(l.propertyId) ?? null : null,
    }));
    return c.json({ leads: enriched });
  });

  app.post("/api/agency/:id/config", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const scope = await agencyScope(c);
    if (!scope || scope !== id) return c.json({ error: "forbidden" }, 403);
    if (!(await getAgency(db, id))) return c.json({ error: "not found" }, 404);
    const body = await c.req.json();
    try {
      const agency = await updateAgencyConfig(db, id, body);
      return c.json(agency);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  // TODO: auth (admin only)
  app.post("/api/agency/:id/properties", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const body = await c.req.json();
    const property = await createProperty(db, { agencyId: id, ...body });
    return c.json(property, 201);
  });

  // TODO: auth (admin only)
  app.post("/api/properties/:id/publish", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const existing = await getProperty(db, id);
    if (!existing) return c.json({ error: "not found" }, 404);
    const property = await publishProperty(db, id);
    return c.json(property);
  });

  app.post("/api/agency/:id/logo", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    const scope = await agencyScope(c);
    if (!scope || scope !== id) return c.json({ error: "forbidden" }, 403);
    if (!storage) return c.json({ error: "storage not configured" }, 500);
    if (!(await getAgency(db, id))) return c.json({ error: "not found" }, 404);
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) return c.json({ error: "file too large" }, 400);
    const url = await storage.upload(
      `agencies/${id}/logo.${extForType(file.type)}`,
      bytes,
      file.type,
    );
    await updateAgencyConfig(db, id, { logoUrl: url });
    return c.json({ logoUrl: url });
  });

  // TODO: auth (admin only)
  app.post("/api/properties/:id/photos", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
    if (!storage) return c.json({ error: "storage not configured" }, 500);
    const existing = await getProperty(db, id);
    if (!existing) return c.json({ error: "not found" }, 404);
    const form = await c.req.parseBody({ all: true });
    const raw = form.file;
    const files = (Array.isArray(raw) ? raw : [raw]).filter(
      (f): f is File => f instanceof File,
    );
    if (files.length === 0) return c.json({ error: "file(s) required" }, 400);
    if (files.length > MAX_FILES) return c.json({ error: "too many files" }, 400);
    const base = existing.photos?.length ?? 0;
    const photos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > MAX_FILE_BYTES) return c.json({ error: "file too large" }, 400);
      const url = await storage.upload(
        `properties/${id}/photo-${base + i}.${extForType(file.type)}`,
        bytes,
        file.type,
      );
      photos.push(url);
    }
    await addPropertyPhotos(db, id, photos);
    return c.json({ photos });
  });

  return app;
}
