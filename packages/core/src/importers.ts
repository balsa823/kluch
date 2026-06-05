import type { Database } from "@kluch/db";
import { createProperty, publishProperty, type Property, type PropertyType } from "./listings.js";

/** A single Firestore typed value, e.g. `{ "stringValue": "x" }`. */
type FirestoreValue = Record<string, unknown>;

/** Unwraps one Firestore typed value into a plain JS value (best-effort). */
function unwrapValue(v: FirestoreValue): unknown {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue as string;
  if ("integerValue" in v) return Number(v.integerValue as string | number);
  if ("doubleValue" in v) return Number(v.doubleValue as string | number);
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue as string;
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("arrayValue" in v) {
    const arr = (v.arrayValue as { values?: FirestoreValue[] })?.values ?? [];
    return arr.map((x) => unwrapValue(x));
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, FirestoreValue> })?.fields ?? {};
    return unwrapFirestore(fields);
  }
  return null;
}

/**
 * Unwraps Firestore's typed-value `fields` object into a plain JS object.
 * Handles string/integer/double/boolean/null/timestamp/geoPoint/array/map values.
 */
export function unwrapFirestore(fields: Record<string, FirestoreValue>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = unwrapValue(value);
  }
  return out;
}

/** A listing mapped into the shape `createProperty` accepts. */
export interface ParsedListing {
  name: string;
  address: string;
  city: string;
  priceMinor: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  areaM2?: number;
  type?: PropertyType;
  photos: string[];
}

/** A per-domain listing parser. */
export interface ListingParser {
  id: string;
  matches(host: string): boolean;
  parse(url: string): Promise<ParsedListing>;
}

/** Capitalizes the first letter of a string. */
function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Pure mapping from an unwrapped bestate4 listing document to a ParsedListing. */
export function mapBestate4(fields: Record<string, any>): ParsedListing {
  const title = fields.title;
  if (!title || typeof title !== "string") {
    throw new Error("bestate4: listing is missing a title");
  }

  const locationDisplay: string | undefined = fields.locationDisplay ?? fields.location;
  const address = locationDisplay ?? "";

  let city: string | undefined = fields.montenegroLocation?.city;
  if (!city && locationDisplay) city = locationDisplay.split(",")[0]?.trim();
  city = city ? capitalize(city) : "";

  const monthlyRent = Number(fields.monthlyRent) || 0;
  const salePrice = Number(fields.price) || 0;
  const amount = monthlyRent || salePrice || 0;

  const bedrooms = fields.bedrooms != null ? Number(fields.bedrooms) : undefined;
  const bathrooms = fields.bathrooms != null ? Number(fields.bathrooms) : undefined;
  const areaM2 = fields.area != null ? Number(fields.area) : undefined;

  const type: PropertyType = bedrooms === 0 ? "studio" : "apartment";

  const images = Array.isArray(fields.images) ? fields.images : [];
  const photos = images.filter((u: unknown): u is string => typeof u === "string");

  return {
    name: title,
    address,
    city,
    priceMinor: amount * 100,
    currency: "EUR",
    bedrooms,
    bathrooms,
    areaM2,
    type,
    photos,
  };
}

/** Extracts the trailing non-empty path segment from a URL (the Firestore doc id). */
function lastPathSegment(url: string): string {
  const { pathname } = new URL(url);
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

const FIRESTORE_BASE =
  "https://firestore.googleapis.com/v1/projects/propertyhub-d94aa/databases/(default)/documents/listings";

/** Parser for bestate4.me, backed by public Firebase Firestore. */
export const bestate4Parser: ListingParser = {
  id: "bestate4",
  matches(host: string): boolean {
    return host.endsWith("bestate4.me");
  },
  async parse(url: string): Promise<ParsedListing> {
    const id = lastPathSegment(url);
    if (!id) throw new Error("bestate4: could not extract listing id from URL");
    const res = await fetch(`${FIRESTORE_BASE}/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`bestate4: failed to fetch listing (${res.status})`);
    }
    const doc = (await res.json()) as { fields?: Record<string, FirestoreValue> };
    if (!doc.fields) throw new Error("bestate4: listing not found");
    return mapBestate4(unwrapFirestore(doc.fields));
  },
};

/** The registry of available per-domain parsers. */
export const PARSERS: ListingParser[] = [bestate4Parser];

/** Picks the parser whose host matcher accepts the URL's host, or null. */
export function pickParser(url: string): ListingParser | null {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  return PARSERS.find((p) => p.matches(host)) ?? null;
}

/**
 * Imports a listing from a URL: picks a parser by host, fetches + maps the
 * listing, then creates and publishes it under the given agency.
 */
export async function importListing(
  db: Database,
  agencyId: string,
  url: string,
): Promise<Property> {
  const parser = pickParser(url);
  if (!parser) throw new Error("Unsupported listing site");
  const parsed = await parser.parse(url);
  const property = await createProperty(db, { agencyId, ...parsed });
  return publishProperty(db, property.id);
}
