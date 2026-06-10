import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { agencies, properties } from "@kluche/db";
import { and, asc, eq } from "drizzle-orm";
import { backfillRefCodes } from "../backfillRefCodes.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

/** Inserts an agency directly (optionally with a null prefix to exercise derivation). */
async function rawAgency(name: string, slug: string, opts: { refPrefix?: string | null; refSeq?: number } = {}) {
  const [a] = await db.insert(agencies)
    .values({ name, slug, refPrefix: opts.refPrefix ?? null, refSeq: opts.refSeq ?? 0 })
    .returning();
  return a;
}

/** Inserts a property directly (bypassing createProperty) so refCode stays null. */
async function rawProperty(agencyId: string, name: string) {
  const [p] = await db.insert(properties)
    .values({ agencyId, name, address: "A", city: "Budva", priceMinor: 100000, status: "published" })
    .returning();
  // Tiny gap so createdAt ordering is deterministic.
  await new Promise((r) => setTimeout(r, 3));
  return p;
}

async function codesByCreatedAt(agencyId: string): Promise<string[]> {
  const rows = await db.select().from(properties)
    .where(eq(properties.agencyId, agencyId))
    .orderBy(asc(properties.createdAt), asc(properties.id));
  return rows.map((r) => r.refCode!);
}

test("backfill derives prefixes and assigns sequential codes per agency, ordered by createdAt", async () => {
  const stam = await rawAgency("Stam", "stam", { refPrefix: null });
  const popo = await rawAgency("Popović", "popovic", { refPrefix: null });
  for (const n of ["S1", "S2", "S3"]) await rawProperty(stam.id, n);
  for (const n of ["P1", "P2"]) await rawProperty(popo.id, n);

  const result = await backfillRefCodes(db);
  expect(result).toEqual({ agencies: 2, assigned: 5 });

  expect(await codesByCreatedAt(stam.id)).toEqual(["ST-0001", "ST-0002", "ST-0003"]);
  expect(await codesByCreatedAt(popo.id)).toEqual(["PO-0001", "PO-0002"]);

  const [stamRow] = await db.select().from(agencies).where(eq(agencies.id, stam.id));
  const [popoRow] = await db.select().from(agencies).where(eq(agencies.id, popo.id));
  expect(stamRow.refPrefix).toBe("ST");
  expect(stamRow.refSeq).toBe(3);
  expect(popoRow.refPrefix).toBe("PO");
  expect(popoRow.refSeq).toBe(2);
});

test("backfill is idempotent — second run assigns nothing and codes are unchanged", async () => {
  const stam = await rawAgency("Stam", "stam", { refPrefix: null });
  for (const n of ["S1", "S2"]) await rawProperty(stam.id, n);

  await backfillRefCodes(db);
  const before = await codesByCreatedAt(stam.id);

  const second = await backfillRefCodes(db);
  expect(second.assigned).toBe(0);
  expect(await codesByCreatedAt(stam.id)).toEqual(before);

  const [stamRow] = await db.select().from(agencies).where(eq(agencies.id, stam.id));
  expect(stamRow.refSeq).toBe(2);
});

test("backfill continues numbering from the agency's existing refSeq and skips coded listings", async () => {
  const stam = await rawAgency("Stam", "stam", { refPrefix: "ST", refSeq: 5 });
  // One already-coded listing must be left untouched.
  const coded = await rawProperty(stam.id, "Coded");
  await db.update(properties).set({ refCode: "ST-0003" }).where(eq(properties.id, coded.id));
  await rawProperty(stam.id, "New1");
  await rawProperty(stam.id, "New2");

  const result = await backfillRefCodes(db);
  expect(result.assigned).toBe(2);

  const codeless = await db.select().from(properties)
    .where(and(eq(properties.agencyId, stam.id)))
    .orderBy(asc(properties.createdAt), asc(properties.id));
  // coded one unchanged; the two new ones continue from seq 5 -> 6, 7.
  expect(codeless.find((r) => r.name === "Coded")!.refCode).toBe("ST-0003");
  expect(codeless.find((r) => r.name === "New1")!.refCode).toBe("ST-0006");
  expect(codeless.find((r) => r.name === "New2")!.refCode).toBe("ST-0007");

  const [stamRow] = await db.select().from(agencies).where(eq(agencies.id, stam.id));
  expect(stamRow.refSeq).toBe(7);
});
