import { and, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { properties, type Database } from "@kluch/db";

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
