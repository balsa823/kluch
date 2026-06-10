import { and, asc, eq, isNull } from "drizzle-orm";
import { agencies, properties, type Database } from "@kluche/db";
import { derivePrefix } from "./refcode.js";

/**
 * One-shot, idempotent ref-code backfill. For each agency: ensures `refPrefix` is set
 * (derived from name/slug if empty), then assigns sequential codes to that agency's
 * codeless listings ordered by `createdAt asc, id asc`, continuing from the agency's
 * current `refSeq`. Each agency is processed in its own transaction. Listings that
 * already have a code are skipped and numbers are never reused, so re-running is safe.
 *
 * Returns the number of agencies processed and the total codes assigned.
 */
export async function backfillRefCodes(
  db: Database,
): Promise<{ agencies: number; assigned: number }> {
  const allAgencies = await db.select().from(agencies);
  let assigned = 0;

  for (const agency of allAgencies) {
    const assignedHere = await db.transaction(async (tx) => {
      const prefix = agency.refPrefix || derivePrefix(agency.name, agency.slug);

      const codeless = await tx.select().from(properties)
        .where(and(eq(properties.agencyId, agency.id), isNull(properties.refCode)))
        .orderBy(asc(properties.createdAt), asc(properties.id));

      let seq = agency.refSeq;
      for (const property of codeless) {
        seq += 1;
        const refCode = `${prefix}-${String(seq).padStart(4, "0")}`;
        await tx.update(properties).set({ refCode }).where(eq(properties.id, property.id));
      }

      // Persist the (possibly derived) prefix and the advanced counter.
      if (prefix !== agency.refPrefix || seq !== agency.refSeq) {
        await tx.update(agencies)
          .set({ refPrefix: prefix, refSeq: seq })
          .where(eq(agencies.id, agency.id));
      }

      return codeless.length;
    });
    assigned += assignedHere;
  }

  return { agencies: allAgencies.length, assigned };
}
