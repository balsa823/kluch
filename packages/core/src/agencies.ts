import { eq } from "drizzle-orm";
import { agencies, agencyDomains, type Database } from "@kluche/db";
import { derivePrefix } from "./refcode.js";

export type Agency = typeof agencies.$inferSelect;
export type AgencyDomain = typeof agencyDomains.$inferSelect;

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(db: Database, rawBase: string): Promise<string> {
  // Names that are entirely non-Latin (e.g. Cyrillic "Стан") or punctuation slugify to "",
  // which would be an unreachable public URL — fall back to a usable base.
  const base = rawBase || "agency";
  let candidate = base;
  let n = 1;
  while (true) {
    const [clash] = await db.select().from(agencies).where(eq(agencies.slug, candidate));
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

export async function createAgency(
  db: Database,
  input: { name: string; slug?: string },
): Promise<Agency> {
  const slug = await uniqueSlug(db, input.slug || slugify(input.name));
  const [agency] = await db.insert(agencies)
    .values({ name: input.name, slug, refPrefix: derivePrefix(input.name, slug) })
    .returning();
  return agency;
}

export async function getAgency(db: Database, id: string): Promise<Agency | null> {
  const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
  return agency ?? null;
}

export async function getAgencyBySlug(db: Database, slug: string): Promise<Agency | null> {
  const [agency] = await db.select().from(agencies).where(eq(agencies.slug, slug));
  return agency ?? null;
}

export async function getAgencyByDomain(db: Database, domain: string): Promise<Agency | null> {
  const [domainRow] = await db.select().from(agencyDomains)
    .where(eq(agencyDomains.domain, domain.toLowerCase().trim()));
  if (!domainRow) return null;
  const [agency] = await db.select().from(agencies).where(eq(agencies.id, domainRow.agencyId));
  return agency ?? null;
}

/** A safe CSS color: a hex value or a plain CSS keyword. */
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/;

export async function updateAgencyConfig(
  db: Database,
  agencyId: string,
  patch: { logoUrl?: string; colorPrimary?: string; colorAccent?: string; tagline?: string; phone?: string },
): Promise<Agency> {
  for (const key of ["colorPrimary", "colorAccent"] as const) {
    const value = patch[key];
    if (value !== undefined && !SAFE_COLOR.test(value)) {
      throw new Error("Invalid color");
    }
  }
  // Whitelist updatable columns — never trust the raw patch to set slug/name/etc.
  const safe: Partial<typeof agencies.$inferInsert> = {};
  if (patch.logoUrl !== undefined) safe.logoUrl = patch.logoUrl;
  if (patch.colorPrimary !== undefined) safe.colorPrimary = patch.colorPrimary;
  if (patch.colorAccent !== undefined) safe.colorAccent = patch.colorAccent;
  if (patch.tagline !== undefined) safe.tagline = patch.tagline;
  if (patch.phone !== undefined) safe.phone = patch.phone;
  const [agency] = await db.update(agencies).set(safe).where(eq(agencies.id, agencyId)).returning();
  return agency;
}

export async function addAgencyDomain(
  db: Database,
  agencyId: string,
  domain: string,
): Promise<AgencyDomain> {
  const [row] = await db.insert(agencyDomains)
    .values({ agencyId, domain: domain.toLowerCase().trim() })
    .returning();
  return row;
}
