import type { Lead } from "./api";

export type ClickGroup = {
  /** Stable key: the listing's propertyId, or "" for clicks not tied to a listing. */
  key: string;
  propertyName: string | null;
  refCode: string | null;
  count: number;
  /** ISO timestamp of the most recent click in this group. */
  lastCreatedAt: string;
};

/**
 * Groups phone-click leads by their listing and counts them, so the Clicks tab shows
 * one row per listing ("ST-0042 — 5 clicks") instead of one row per click.
 *
 * Sorted most-clicked first; ties broken by most-recent click. Clicks with no property
 * fall into a single "" group. Pure function (no React/RN deps) so it's easy to reason about.
 */
export function groupPhoneClicks(leads: Lead[]): ClickGroup[] {
  const groups = new Map<string, ClickGroup>();
  for (const lead of leads) {
    const key = lead.propertyId ?? "";
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (lead.createdAt > existing.lastCreatedAt) existing.lastCreatedAt = lead.createdAt;
      // Backfill name/code from whichever row in the group has them.
      if (!existing.propertyName && lead.propertyName) existing.propertyName = lead.propertyName;
      if (!existing.refCode && lead.refCode) existing.refCode = lead.refCode;
    } else {
      groups.set(key, {
        key,
        propertyName: lead.propertyName,
        refCode: lead.refCode,
        count: 1,
        lastCreatedAt: lead.createdAt,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || b.lastCreatedAt.localeCompare(a.lastCreatedAt),
  );
}
