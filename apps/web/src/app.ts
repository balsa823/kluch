import { Hono } from "hono";
import {
  addPropertyPhotos,
  createProperty,
  getProperty,
  publishProperty,
  searchProperties,
  updateAgencyConfig,
  type PropertyType,
  type SearchFilters,
  type Storage,
} from "@kluch/core";
import type { Database } from "@kluch/db";
import { resolveSite, type Site } from "./site.js";
import { renderAgencySite } from "./render.js";

type Vars = { site: Site };

const PROPERTY_TYPES: PropertyType[] = ["apartment", "studio", "house"];

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

const MARKETPLACE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kluch</title></head><body><h1>Kluch marketplace — coming soon</h1></body></html>`;
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

export interface CreateAppOptions {
  baseDomain?: string;
  storage?: Storage;
}

/** Builds the multi-tenant web app: marketplace, agency console and white-label sites. */
export function createApp(db: Database, opts: CreateAppOptions = {}) {
  const { baseDomain = "kluche.me", storage } = opts;
  const app = new Hono<{ Variables: Vars }>();

  app.get("/health", (c) => c.text("ok"));

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
        return c.html(MARKETPLACE);
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
    const body = await c.req.json();
    const property = await createProperty(db, { agencyId: id, ...body });
    return c.json(property, 201);
  });

  // TODO: auth (admin only)
  app.post("/api/properties/:id/publish", async (c) => {
    const id = c.req.param("id");
    const existing = await getProperty(db, id);
    if (!existing) return c.json({ error: "not found" }, 404);
    const property = await publishProperty(db, id);
    return c.json(property);
  });

  // TODO: auth (admin only)
  app.post("/api/agency/:id/logo", async (c) => {
    const id = c.req.param("id");
    if (!storage) return c.json({ error: "storage not configured" }, 500);
    const form = await c.req.parseBody();
    const file = form.file as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
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
    if (!storage) return c.json({ error: "storage not configured" }, 500);
    const form = await c.req.parseBody({ all: true });
    const raw = form.file;
    const files = (Array.isArray(raw) ? raw : [raw]) as File[];
    const photos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = await storage.upload(
        `properties/${id}/photo-${i}.${extForType(file.type)}`,
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
