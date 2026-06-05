import { Hono } from "hono";
import { searchProperties, type PropertyType, type SearchFilters } from "@kluch/core";
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

/** Builds the multi-tenant web app: marketplace, agency console and white-label sites. */
export function createApp(db: Database, baseDomain = "kluche.me") {
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

  return app;
}
