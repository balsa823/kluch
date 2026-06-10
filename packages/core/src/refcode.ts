import { eq, sql } from "drizzle-orm";
import { agencies, type Database } from "@kluche/db";

/** First two A–Z letters of a cleaned string (uppercased, non-A–Z stripped). */
function firstTwoLetters(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z]/g, "");
  return cleaned.length >= 2 ? cleaned.slice(0, 2) : "";
}

/**
 * Derives a 2-letter agency prefix: the first two A–Z letters of the name; if the
 * name yields fewer than two (e.g. Cyrillic), the first two A–Z of the slug; else "AG".
 */
export function derivePrefix(name: string, slug?: string): string {
  return firstTwoLetters(name) || firstTwoLetters(slug ?? "") || "AG";
}

/**
 * Atomically allocates the next sequential ref code for an agency:
 * `UPDATE agencies SET ref_seq = ref_seq + 1 ... RETURNING ref_seq, ref_prefix`.
 * Throws if the agency is missing or has no prefix. Concurrency-safe (single atomic UPDATE).
 * Accepts a transaction or the plain db handle.
 */
export async function allocateRefCode(tx: Database, agencyId: string): Promise<string> {
  const [row] = await tx.update(agencies)
    .set({ refSeq: sql`${agencies.refSeq} + 1` })
    .where(eq(agencies.id, agencyId))
    .returning({ seq: agencies.refSeq, prefix: agencies.refPrefix });
  if (!row) throw new Error(`allocateRefCode: agency ${agencyId} not found`);
  if (!row.prefix) throw new Error(`allocateRefCode: agency ${agencyId} has no ref prefix`);
  return `${row.prefix}-${String(row.seq).padStart(4, "0")}`;
}
