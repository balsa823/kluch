import { and, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { properties, type Database } from "@kluche/db";

export type Property = typeof properties.$inferSelect;
export type PropertyType = NonNullable<Property["type"]>;

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
  photos?: string[];
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
      photos: input.photos,
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

export async function getProperty(db: Database, id: string): Promise<Property | null> {
  const [property] = await db.select().from(properties).where(eq(properties.id, id));
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
}

export async function searchProperties(
  db: Database,
  agencyId: string,
  filters: SearchFilters = {},
): Promise<Property[]> {
  const conditions: SQL[] = [
    eq(properties.agencyId, agencyId),
    eq(properties.status, "published"),
  ];
  if (filters.city !== undefined) conditions.push(ilike(properties.city, `%${filters.city}%`));
  if (filters.minPrice !== undefined) conditions.push(gte(properties.priceMinor, filters.minPrice));
  if (filters.maxPrice !== undefined) conditions.push(lte(properties.priceMinor, filters.maxPrice));
  if (filters.bedrooms !== undefined) conditions.push(gte(properties.bedrooms, filters.bedrooms));
  if (filters.type !== undefined) conditions.push(eq(properties.type, filters.type));

  return db.select().from(properties).where(and(...conditions));
}
