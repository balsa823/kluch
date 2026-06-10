import { and, count, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { inquiries, properties, type Database } from "@kluche/db";

export type Property = typeof properties.$inferSelect;
export type PropertyType = NonNullable<Property["type"]>;
export type PropertyStatus = NonNullable<Property["status"]>;

const PROPERTY_STATUSES = ["draft", "published", "rented", "sold"] as const;

export interface CreatePropertyInput {
  agencyId: string;
  name: string;
  address: string;
  city: string;
  priceMinor: number;
  currency?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaM2?: number;
  type?: PropertyType;
  dealType?: "rent" | "sale";
  photos?: string[];
  sourceId?: string;
}

export async function createProperty(db: Database, input: CreatePropertyInput): Promise<Property> {
  const [property] = await db.insert(properties)
    .values({
      agencyId: input.agencyId,
      name: input.name,
      address: input.address,
      city: input.city,
      priceMinor: input.priceMinor,
      currency: input.currency ?? "EUR",
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      areaM2: input.areaM2,
      type: input.type,
      dealType: input.dealType,
      photos: input.photos,
      sourceId: input.sourceId,
      status: "draft",
    })
    .returning();
  return property;
}

export async function publishProperty(db: Database, id: string): Promise<Property> {
  const [property] = await db.update(properties)
    .set({ status: "published" })
    .where(eq(properties.id, id))
    .returning();
  return property;
}

/** Fields a listing owner may patch. Excludes agencyId/slug/status/sourceId/photos/id. */
export interface UpdatePropertyPatch {
  name?: string;
  address?: string;
  city?: string;
  priceMinor?: number;
  currency?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | null;
  type?: PropertyType;
  dealType?: "rent" | "sale";
}

/** Updates only the whitelisted, defined keys of a property; returns the updated row. */
export async function updateProperty(
  db: Database,
  id: string,
  patch: UpdatePropertyPatch,
): Promise<Property> {
  const keys = ["name", "address", "city", "priceMinor", "currency", "bedrooms", "bathrooms", "areaM2", "type", "dealType"] as const;
  const safe: Record<string, unknown> = {};
  for (const key of keys) {
    if (patch[key] !== undefined) safe[key] = patch[key];
  }
  const [property] = await db.update(properties)
    .set(safe)
    .where(eq(properties.id, id))
    .returning();
  return property;
}

/** Sets a property's lifecycle status; throws on an unknown status value. */
export async function setPropertyStatus(
  db: Database,
  id: string,
  status: PropertyStatus,
): Promise<Property> {
  if (!(PROPERTY_STATUSES as readonly string[]).includes(status)) throw new Error("invalid status");
  const [property] = await db.update(properties)
    .set({ status })
    .where(eq(properties.id, id))
    .returning();
  return property;
}

/** Deletes a property, first detaching any inquiries that reference it (set to null). */
export async function deleteProperty(db: Database, id: string): Promise<void> {
  await db.update(inquiries).set({ propertyId: null }).where(eq(inquiries.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id));
}

export async function getProperty(db: Database, id: string): Promise<Property | null> {
  const [property] = await db.select().from(properties).where(eq(properties.id, id));
  return property ?? null;
}

/** Looks up a property by its (agencyId, sourceId) pair for import idempotency. */
export async function getPropertyBySource(
  db: Database,
  agencyId: string,
  sourceId: string,
): Promise<Property | null> {
  const [property] = await db.select().from(properties)
    .where(and(eq(properties.agencyId, agencyId), eq(properties.sourceId, sourceId)));
  return property ?? null;
}

/** Appends the given photo URLs to the property's existing photos. */
export async function addPropertyPhotos(
  db: Database,
  id: string,
  urls: string[],
): Promise<Property> {
  const existing = await getProperty(db, id);
  if (!existing) throw new Error("Property not found");
  const [property] = await db.update(properties)
    .set({ photos: [...existing.photos, ...urls] })
    .where(eq(properties.id, id))
    .returning();
  return property;
}

/** All properties for an agency (drafts included), newest first. For the agency console. */
export async function listAgencyProperties(db: Database, agencyId: string): Promise<Property[]> {
  return db.select().from(properties)
    .where(eq(properties.agencyId, agencyId))
    .orderBy(desc(properties.createdAt));
}

export interface SearchFilters {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  type?: PropertyType;
  dealType?: "rent" | "sale";
  page?: number;
}

/** Builds the WHERE conditions shared by searchProperties and countProperties. */
function searchConditions(agencyId: string, filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [
    eq(properties.agencyId, agencyId),
    eq(properties.status, "published"),
  ];
  if (filters.city !== undefined) conditions.push(ilike(properties.city, `%${filters.city}%`));
  if (filters.minPrice !== undefined) conditions.push(gte(properties.priceMinor, filters.minPrice));
  if (filters.maxPrice !== undefined) conditions.push(lte(properties.priceMinor, filters.maxPrice));
  if (filters.bedrooms !== undefined) conditions.push(gte(properties.bedrooms, filters.bedrooms));
  if (filters.type !== undefined) conditions.push(eq(properties.type, filters.type));
  if (filters.dealType !== undefined) conditions.push(eq(properties.dealType, filters.dealType));
  return conditions;
}

export async function searchProperties(
  db: Database,
  agencyId: string,
  filters: SearchFilters = {},
  opts: { limit?: number; offset?: number } = {},
): Promise<Property[]> {
  const conditions = searchConditions(agencyId, filters);
  let query = db.select().from(properties)
    .where(and(...conditions))
    .orderBy(desc(properties.createdAt))
    .$dynamic();
  if (opts.limit !== undefined) query = query.limit(opts.limit);
  if (opts.offset !== undefined) query = query.offset(opts.offset);
  return query;
}

/** Counts published properties matching the same filters as searchProperties. */
export async function countProperties(
  db: Database,
  agencyId: string,
  filters: SearchFilters = {},
): Promise<number> {
  const conditions = searchConditions(agencyId, filters);
  const [row] = await db.select({ value: count() }).from(properties).where(and(...conditions));
  return row?.value ?? 0;
}
