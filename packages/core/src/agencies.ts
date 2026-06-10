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

/**
 * Accepts only http(s) URLs or same-origin root-relative paths (e.g. "/uploads/…").
 * Rejects javascript:/data: and protocol-relative ("//host") URLs. An empty string
 * (after trim) is allowed so a field can be cleared.
 */
function safeUrl(value: string): boolean {
  if (value === "") return true;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  return false;
}

const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SOCIAL_KEYS = ["facebook", "instagram", "linkedin", "youtube", "tiktok"];
const SUPPORTED_LANGS = ["en", "sr", "ru", "tr"];

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null;
}
export interface CustomClosure {
  from: string;
  to?: string;
  label?: string;
}
export interface Socials {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
}

export interface AgencyConfigPatch {
  logoUrl?: string;
  colorPrimary?: string;
  colorAccent?: string;
  tagline?: string;
  phone?: string;
  heroHeadline?: string;
  heroImageUrl?: string;
  faviconUrl?: string;
  email?: string;
  whatsapp?: string;
  viber?: string;
  address?: string;
  mapUrl?: string;
  aboutBlurb?: string;
  footerName?: string;
  notifyEmail?: string;
  defaultLang?: string;
  observeHolidays?: boolean;
  businessHours?: BusinessHours | null;
  customClosures?: CustomClosure[] | null;
  socials?: Socials | null;
}

/** Trim and cap a free-text field; throws if not a string. */
function text_(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("Invalid text");
  return value.trim().slice(0, max);
}

export async function updateAgencyConfig(
  db: Database,
  agencyId: string,
  patch: AgencyConfigPatch,
): Promise<Agency> {
  const safe: Partial<typeof agencies.$inferInsert> = {};

  for (const key of ["colorPrimary", "colorAccent"] as const) {
    const value = patch[key];
    if (value !== undefined) {
      if (!SAFE_COLOR.test(value)) throw new Error("Invalid color");
      safe[key] = value;
    }
  }

  if (patch.logoUrl !== undefined) safe.logoUrl = patch.logoUrl;

  // Capped free-text fields.
  const textFields: Array<[keyof AgencyConfigPatch & keyof typeof safe, number]> = [
    ["tagline", 500], ["phone", 500], ["heroHeadline", 200], ["email", 500],
    ["whatsapp", 500], ["viber", 500], ["address", 500], ["aboutBlurb", 2000],
    ["footerName", 500], ["notifyEmail", 500],
  ];
  for (const [key, max] of textFields) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) (safe as Record<string, unknown>)[key] = text_(value, max);
  }

  // URL-ish fields.
  for (const key of ["heroImageUrl", "faviconUrl", "mapUrl"] as const) {
    const value = patch[key];
    if (value !== undefined) {
      const trimmed = text_(value, 1000);
      if (!safeUrl(trimmed)) throw new Error("Invalid URL");
      safe[key] = trimmed;
    }
  }

  if (patch.defaultLang !== undefined) {
    if (!SUPPORTED_LANGS.includes(patch.defaultLang)) throw new Error("Invalid language");
    safe.defaultLang = patch.defaultLang;
  }

  if (patch.observeHolidays !== undefined) {
    if (typeof patch.observeHolidays !== "boolean") throw new Error("Invalid observeHolidays");
    safe.observeHolidays = patch.observeHolidays;
  }

  if (patch.businessHours !== undefined) {
    safe.businessHours = validateBusinessHours(patch.businessHours);
  }
  if (patch.customClosures !== undefined) {
    safe.customClosures = validateClosures(patch.customClosures);
  }
  if (patch.socials !== undefined) {
    safe.socials = validateSocials(patch.socials);
  }

  const [agency] = await db.update(agencies).set(safe).where(eq(agencies.id, agencyId)).returning();
  return agency;
}

function validateBusinessHours(value: BusinessHours | null): BusinessHours | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid hours");
  for (const [key, day] of Object.entries(value)) {
    if (!DAY_KEYS.includes(key)) throw new Error("Invalid hours");
    if (day === null) continue;
    if (typeof day !== "object" || Array.isArray(day)) throw new Error("Invalid hours");
    const { open, close } = day as { open?: unknown; close?: unknown };
    if (typeof open !== "string" || typeof close !== "string" || !HHMM.test(open) || !HHMM.test(close)) {
      throw new Error("Invalid hours");
    }
  }
  return value;
}

function validateClosures(value: CustomClosure[] | null): CustomClosure[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw new Error("Invalid closures");
  return value.map((c) => {
    if (!c || typeof c !== "object") throw new Error("Invalid closures");
    const { from, to, label } = c as { from?: unknown; to?: unknown; label?: unknown };
    if (typeof from !== "string" || !YMD.test(from)) throw new Error("Invalid closures");
    if (to !== undefined && (typeof to !== "string" || !YMD.test(to))) throw new Error("Invalid closures");
    if (label !== undefined && typeof label !== "string") throw new Error("Invalid closures");
    const out: CustomClosure = { from };
    if (to !== undefined) out.to = to;
    if (label !== undefined) out.label = label.slice(0, 200);
    return out;
  });
}

function validateSocials(value: Socials | null): Socials | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid socials");
  const out: Socials = {};
  for (const [key, url] of Object.entries(value)) {
    if (!SOCIAL_KEYS.includes(key)) throw new Error("Invalid socials");
    if (url === undefined || url === null || url === "") continue;
    if (typeof url !== "string") throw new Error("Invalid socials");
    const trimmed = url.trim();
    if (!safeUrl(trimmed)) throw new Error("Invalid socials");
    (out as Record<string, string>)[key] = trimmed;
  }
  return out;
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
