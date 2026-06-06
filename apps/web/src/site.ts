import { getAgencyBySlug, getAgencyByDomain, type Agency } from "@kluche/core";
import type { Database } from "@kluche/db";

export type Site =
  | { kind: "marketplace" }
  | { kind: "console" }
  | { kind: "agency"; agency: Agency }
  | { kind: "notfound" };

/**
 * Resolves an incoming request host to the site it should serve.
 *
 * - `kluche.me` / `www.kluche.me`      -> marketplace
 * - `agency.kluche.me`                 -> agency console
 * - `<slug>.kluche.me`                 -> that agency (by slug)
 * - a registered custom domain         -> that agency (by domain)
 * - anything else / unknown lookup     -> notfound
 */
export async function resolveSite(
  host: string,
  db: Database,
  baseDomain = "kluche.me",
): Promise<Site> {
  const h = host.split(":")[0].toLowerCase();

  if (h === baseDomain || h === `www.${baseDomain}`) return { kind: "marketplace" };
  if (h === `agency.${baseDomain}`) return { kind: "console" };

  if (h.endsWith(`.${baseDomain}`)) {
    const slug = h.slice(0, h.length - baseDomain.length - 1).split(".")[0];
    const agency = await getAgencyBySlug(db, slug);
    return agency ? { kind: "agency", agency } : { kind: "notfound" };
  }

  const agency = await getAgencyByDomain(db, h);
  return agency ? { kind: "agency", agency } : { kind: "notfound" };
}
