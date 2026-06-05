import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency } from "../agencies.js";
import { createProperty, publishProperty, searchProperties } from "../listings.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

async function agency(name = "Adriatic Homes") {
  return createAgency(db, { name });
}

test("createProperty inserts a draft with defaults", async () => {
  const a = await agency();
  const p = await createProperty(db, {
    agencyId: a.id, name: "Seaside Studio", address: "Obala 1", city: "Budva", priceMinor: 120000,
  });
  expect(p.status).toBe("draft");
  expect(p.currency).toBe("EUR");
  expect(p.priceMinor).toBe(120000);
  expect(p.photos).toEqual([]);
});

test("publishProperty flips status to published", async () => {
  const a = await agency();
  const p = await createProperty(db, {
    agencyId: a.id, name: "Seaside Studio", address: "Obala 1", city: "Budva", priceMinor: 120000,
  });
  const pub = await publishProperty(db, p.id);
  expect(pub.status).toBe("published");
});

test("searchProperties excludes drafts, includes published", async () => {
  const a = await agency();
  await createProperty(db, { agencyId: a.id, name: "Draft", address: "A", city: "Budva", priceMinor: 100000 });
  const pub = await createProperty(db, { agencyId: a.id, name: "Pub", address: "B", city: "Budva", priceMinor: 200000 });
  await publishProperty(db, pub.id);
  const results = await searchProperties(db, a.id);
  expect(results.map((r) => r.name)).toEqual(["Pub"]);
});

test("searchProperties filters by city, maxPrice, bedrooms", async () => {
  const a = await agency();
  const budva = await createProperty(db, { agencyId: a.id, name: "Budva 2BR", address: "A", city: "Budva", priceMinor: 150000, bedrooms: 2 });
  const kotor = await createProperty(db, { agencyId: a.id, name: "Kotor 1BR", address: "B", city: "Kotor", priceMinor: 90000, bedrooms: 1 });
  const tivat = await createProperty(db, { agencyId: a.id, name: "Tivat 3BR", address: "C", city: "Tivat", priceMinor: 300000, bedrooms: 3 });
  for (const p of [budva, kotor, tivat]) await publishProperty(db, p.id);

  expect((await searchProperties(db, a.id, { city: "budv" })).map((r) => r.name)).toEqual(["Budva 2BR"]);
  expect((await searchProperties(db, a.id, { maxPrice: 100000 })).map((r) => r.name)).toEqual(["Kotor 1BR"]);
  expect((await searchProperties(db, a.id, { bedrooms: 2 })).map((r) => r.name).sort()).toEqual(["Budva 2BR", "Tivat 3BR"]);
  expect((await searchProperties(db, a.id, { minPrice: 120000, type: "apartment" }))).toEqual([]);
});

test("searchProperties is isolated per agency", async () => {
  const a = await agency("Agency A");
  const b = await agency("Agency B");
  const pa = await createProperty(db, { agencyId: a.id, name: "A-prop", address: "A", city: "Budva", priceMinor: 100000 });
  const pb = await createProperty(db, { agencyId: b.id, name: "B-prop", address: "B", city: "Budva", priceMinor: 100000 });
  await publishProperty(db, pa.id);
  await publishProperty(db, pb.id);
  const results = await searchProperties(db, a.id);
  expect(results.map((r) => r.name)).toEqual(["A-prop"]);
});
