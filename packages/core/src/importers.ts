import type { Database } from "@kluche/db";
import {
  addPropertyPhotos,
  createProperty,
  getProperty,
  getPropertyBySource,
  publishProperty,
  type Property,
  type PropertyType,
} from "./listings.js";
import type { Storage } from "./storage.js";

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
  dealType?: "rent" | "sale";
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

/** Maps a source `type` string to our PropertyType, defaulting to "residential". */
function mapPropertyType(raw: unknown): PropertyType {
  switch (typeof raw === "string" ? raw.toLowerCase() : "") {
    case "land":
      return "land";
    case "commercial":
      return "commercial";
    default:
      return "residential";
  }
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

  const dealType: "rent" | "sale" =
    typeof fields.listingType === "string" && fields.listingType.toUpperCase() === "FOR_SALE"
      ? "sale"
      : "rent";

  const amount = dealType === "rent"
    ? Number(fields.monthlyRent) || 0
    : Number(fields.price) || 0;

  const bedrooms = fields.bedrooms != null ? Number(fields.bedrooms) : undefined;
  const bathrooms = fields.bathrooms != null ? Number(fields.bathrooms) : undefined;
  const areaM2 = fields.area != null ? Number(fields.area) : undefined;

  const type = mapPropertyType(fields.type);

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
    dealType,
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

/** Maps an image content-type to a file extension, defaulting to jpg. */
export function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
  };
  return map[ct.split(";")[0].trim().toLowerCase()] ?? "jpg";
}

/** Largest image we'll download and store (15MB). */
const MAX_IMAGE_BYTES = 15_000_000;
/** Smallest plausible image; anything below is treated as a failed/empty fetch. */
const MIN_IMAGE_BYTES = 100;

/**
 * Imports a listing from a URL: picks a parser by host, fetches + maps the
 * listing, then creates and publishes it under the given agency.
 *
 * When `storage` is provided, each remote photo is downloaded and re-uploaded
 * into our own storage so listings don't hot-link the source site. Downloads
 * are best-effort per image — a single bad image won't fail the import, and if
 * every download fails we fall back to the remote URLs. Without `storage`, the
 * remote URLs are kept as-is.
 */
export async function importListing(
  db: Database,
  agencyId: string,
  url: string,
  storage?: Storage,
): Promise<Property> {
  const parser = pickParser(url);
  if (!parser) throw new Error("Unsupported listing site");
  const parsed = await parser.parse(url);
  // Create without the remote photos first — we need the id for storage paths.
  const property = await createProperty(db, { agencyId, ...parsed, photos: [] });

  let finalPhotos: string[] = parsed.photos;
  if (storage && parsed.photos.length) {
    const localUrls: string[] = [];
    for (let i = 0; i < parsed.photos.length; i++) {
      const remoteUrl = parsed.photos[i];
      try {
        const res = await fetch(remoteUrl);
        if (!res.ok) continue;
        const ct = res.headers.get("content-type") || "image/jpeg";
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length > MAX_IMAGE_BYTES || bytes.length < MIN_IMAGE_BYTES) continue;
        const storedUrl = await storage.upload(
          `properties/${property.id}/photo-${i}.${extFromContentType(ct)}`,
          bytes,
          ct,
        );
        localUrls.push(storedUrl);
      } catch {
        // Best-effort: skip this image, keep importing the rest.
      }
    }
    finalPhotos = localUrls.length ? localUrls : parsed.photos;
  }

  await addPropertyPhotos(db, property.id, finalPhotos);
  const published = await publishProperty(db, property.id);
  return published.photos?.length ? published : (await getProperty(db, property.id))!;
}

/** A raw Firestore listing document scoped to one agent. */
export interface AgentDoc {
  id: string;
  fields: Record<string, any>;
}

/**
 * Fetches all bestate4 Firestore listing documents belonging to a given agent,
 * paging through the collection until there are no more pages.
 */
export async function fetchAgentListings(
  agentId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AgentDoc[]> {
  const out: AgentDoc[] = [];
  let pageToken: string | undefined;
  do {
    let url = `${FIRESTORE_BASE}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`bestate4: failed to list listings (${res.status})`);
    const body = (await res.json()) as {
      documents?: Array<{ name?: string; fields?: Record<string, FirestoreValue> }>;
      nextPageToken?: string;
    };
    for (const doc of body.documents ?? []) {
      const fields = doc.fields ?? {};
      if (fields.agentId?.stringValue !== agentId) continue;
      const id = lastPathSegment(`https://x/${doc.name ?? ""}`);
      out.push({ id, fields });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return out;
}

/** The tally returned by a bulk import run. */
export interface BulkImportResult {
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Bulk-imports every bestate4 listing for an agent into the given agency.
 * Idempotent: docs already imported (matched by their Firestore id as sourceId)
 * are skipped. Each doc is mapped, created, photo-imported (best-effort when a
 * `storage` is given), and published. A doc that fails to map/create is counted
 * as `failed` without aborting the rest of the run.
 */
export async function importAgentListings(
  db: Database,
  agencyId: string,
  agentId: string,
  storage?: Storage,
  opts: { fetchImpl?: typeof fetch; onProgress?: (n: number) => void } = {},
): Promise<BulkImportResult> {
  const docs = await fetchAgentListings(agentId, opts.fetchImpl ?? fetch);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const { id, fields } = docs[i];
    try {
      if (await getPropertyBySource(db, agencyId, id)) {
        skipped++;
      } else {
        const parsed = mapBestate4(unwrapFirestore(fields));
        const property = await createProperty(db, {
          agencyId,
          sourceId: id,
          name: parsed.name,
          address: parsed.address,
          city: parsed.city,
          priceMinor: parsed.priceMinor,
          currency: parsed.currency,
          bedrooms: parsed.bedrooms,
          bathrooms: parsed.bathrooms,
          areaM2: parsed.areaM2,
          type: parsed.type,
          dealType: parsed.dealType,
          photos: [],
        });

        if (storage && parsed.photos.length) {
          const localUrls: string[] = [];
          for (let p = 0; p < parsed.photos.length; p++) {
            const remoteUrl = parsed.photos[p];
            try {
              const res = await fetch(remoteUrl);
              if (!res.ok) continue;
              const ct = res.headers.get("content-type") || "image/jpeg";
              const bytes = new Uint8Array(await res.arrayBuffer());
              if (bytes.length > MAX_IMAGE_BYTES || bytes.length < MIN_IMAGE_BYTES) continue;
              const storedUrl = await storage.upload(
                `properties/${property.id}/photo-${p}.${extFromContentType(ct)}`,
                bytes,
                ct,
              );
              localUrls.push(storedUrl);
            } catch {
              // Best-effort: skip this image, keep importing the rest.
            }
          }
          const finalPhotos = localUrls.length ? localUrls : parsed.photos;
          if (finalPhotos.length) await addPropertyPhotos(db, property.id, finalPhotos);
        }

        await publishProperty(db, property.id);
        created++;
      }
    } catch {
      failed++;
    }
    opts.onProgress?.(i + 1);
  }

  return { created, skipped, failed };
}
