import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import {
  addPropertyPhotos,
  createProperty,
  dashboardKeys,
  getAgency,
  getAgencyUserById,
  getPartnerUserById,
  getProperty,
  importListing,
  listAgencyProperties,
  publishProperty,
  searchProperties,
  signToken,
  updateAgencyConfig,
  verifyAgencyUser,
  verifyPartnerUser,
  verifyToken,
  type AgencyUser,
  type PartnerUser,
  type PropertyType,
  type SearchFilters,
  type Storage,
} from "@kluche/core";
import type { Database } from "@kluche/db";
import { resolveSite, type Site } from "./site.js";
import { renderAgencySite } from "./render.js";

type Vars = { site: Site };

const PROPERTY_TYPES: PropertyType[] = ["apartment", "studio", "house"];

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

  const minPrice = toInt(query.minPrice);
  if (minPrice !== undefined) filters.minPrice = minPrice;

  const maxPrice = toInt(query.maxPrice);
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;

  const bedrooms = toInt(query.bedrooms);
  if (bedrooms !== undefined) filters.bedrooms = bedrooms;

  const type = query.type?.trim();
  if (type && (PROPERTY_TYPES as string[]).includes(type)) filters.type = type as PropertyType;

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
   * Resolves the agency id from whichever token is present: an agency-user token
   * takes precedence, falling back to a partner token's `agency` dashboard.
   */
  async function agencyScope(c: Context): Promise<string | null> {
    const user = await bearerUser(c);
    if (user) return user.agencyId;
    const partner = await bearerPartner(c);
    return partner?.dashboards?.agency?.agencyId ?? null;
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
        const listings = await searchProperties(db, site.agency.id, filters);
        return c.html(renderAgencySite(site.agency, listings, filters));
      }
      default:
        return c.text("Not found", 404);
    }
  });

  // TODO: auth (admin only)
  app.post("/api/agency/:id/config", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
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

  // TODO: auth (admin only)
  app.post("/api/agency/:id/logo", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "invalid id" }, 400);
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
