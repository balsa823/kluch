import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { agencies } from "@kluche/db";
import { eq } from "drizzle-orm";
import { createAgency } from "../agencies.js";
import { createProperty } from "../listings.js";
import { derivePrefix, allocateRefCode } from "../refcode.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("derivePrefix takes the first two A-Z letters of the name", () => {
  expect(derivePrefix("Stam")).toBe("ST");
  expect(derivePrefix("Popović Nekretnine")).toBe("PO");
  expect(derivePrefix("123 Estates")).toBe("ES");
});

test("derivePrefix falls back to the slug when the name has <2 A-Z letters", () => {
  expect(derivePrefix("Стан", "stan-mn")).toBe("ST");
});

test("derivePrefix falls back to AG when nothing usable", () => {
  expect(derivePrefix("")).toBe("AG");
  expect(derivePrefix("Стан")).toBe("AG");
  expect(derivePrefix("Стан", "—")).toBe("AG");
});

async function agencyWithPrefix(prefix: string, seq = 0) {
  const [a] = await db.insert(agencies)
    .values({ name: "X", slug: `x-${Math.random().toString(36).slice(2)}`, refPrefix: prefix, refSeq: seq })
    .returning();
  return a;
}

test("allocateRefCode increments the counter and formats a zero-padded code", async () => {
  const a = await agencyWithPrefix("ST", 0);
  expect(await allocateRefCode(db, a.id)).toBe("ST-0001");
  expect(await allocateRefCode(db, a.id)).toBe("ST-0002");
});

test("allocateRefCode pads to 4 digits and grows beyond", async () => {
  const a = await agencyWithPrefix("ST", 12344);
  expect(await allocateRefCode(db, a.id)).toBe("ST-12345");
});

test("allocateRefCode is independent per agency", async () => {
  const a = await agencyWithPrefix("ST", 0);
  const b = await agencyWithPrefix("PO", 0);
  expect(await allocateRefCode(db, a.id)).toBe("ST-0001");
  expect(await allocateRefCode(db, b.id)).toBe("PO-0001");
  expect(await allocateRefCode(db, a.id)).toBe("ST-0002");
});

test("allocateRefCode throws if the agency has no prefix", async () => {
  const [a] = await db.insert(agencies)
    .values({ name: "X", slug: `x-${Math.random().toString(36).slice(2)}` })
    .returning();
  await expect(allocateRefCode(db, a.id)).rejects.toThrow();
});

test("allocateRefCode throws if the agency does not exist", async () => {
  await expect(allocateRefCode(db, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
});

test("createAgency derives and stores a ref prefix", async () => {
  const a = await createAgency(db, { name: "Stam" });
  expect(a.refPrefix).toBe("ST");
  expect(a.refSeq).toBe(0);
  const cyr = await createAgency(db, { name: "Стан" });
  expect(cyr.refPrefix).toBe("AG"); // slug fell back to "agency" -> "AG"
});

test("createProperty assigns a sequential ref code under one agency", async () => {
  const a = await createAgency(db, { name: "Stam" });
  const p1 = await createProperty(db, { agencyId: a.id, name: "One", address: "A", city: "Budva", priceMinor: 100000 });
  const p2 = await createProperty(db, { agencyId: a.id, name: "Two", address: "B", city: "Budva", priceMinor: 200000 });
  expect(p1.refCode).toMatch(/^[A-Z]{2,}-\d{4,}$/);
  expect(p1.refCode).toBe("ST-0001");
  expect(p2.refCode).toBe("ST-0002");
  // counter persisted on the agency
  const [reread] = await db.select().from(agencies).where(eq(agencies.id, a.id));
  expect(reread.refSeq).toBe(2);
});
