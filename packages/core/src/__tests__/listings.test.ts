import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { createAgency } from "../agencies.js";
import { addPropertyPhotos, countProperties, createProperty, getProperty, getPropertyBySource, listAgencyProperties, publishProperty, searchProperties } from "../listings.js";

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

test("addPropertyPhotos appends to existing photos", async () => {
  const a = await agency();
  const p = await createProperty(db, {
    agencyId: a.id, name: "Studio", address: "A", city: "Budva", priceMinor: 100000,
    photos: ["https://cdn/one.jpg"],
  });
  const updated = await addPropertyPhotos(db, p.id, ["https://cdn/two.jpg", "https://cdn/three.jpg"]);
  expect(updated.photos).toEqual(["https://cdn/one.jpg", "https://cdn/two.jpg", "https://cdn/three.jpg"]);
  const reread = await getProperty(db, p.id);
  expect(reread?.photos).toEqual(updated.photos);
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
  expect((await searchProperties(db, a.id, { minPrice: 120000, type: "land" }))).toEqual([]);
});

test("listAgencyProperties returns all properties incl. drafts, newest first, scoped to agency", async () => {
  const a = await agency("Agency A");
  const b = await agency("Agency B");
  const first = await createProperty(db, { agencyId: a.id, name: "First", address: "A", city: "Budva", priceMinor: 100000 });
  await new Promise((r) => setTimeout(r, 5));
  const second = await createProperty(db, { agencyId: a.id, name: "Second", address: "B", city: "Budva", priceMinor: 200000 });
  await publishProperty(db, second.id); // second is published, first is a draft
  await createProperty(db, { agencyId: b.id, name: "Other", address: "C", city: "Budva", priceMinor: 100000 });

  const results = await listAgencyProperties(db, a.id);
  expect(results).toHaveLength(2);
  expect(results.map((r) => r.name)).toEqual([second.name, first.name]);
});

test("createProperty defaults dealType to rent", async () => {
  const a = await agency();
  const p = await createProperty(db, {
    agencyId: a.id, name: "Seaside Studio", address: "Obala 1", city: "Budva", priceMinor: 120000,
  });
  expect(p.dealType).toBe("rent");
});

test("searchProperties filters by dealType", async () => {
  const a = await agency();
  const sale = await createProperty(db, { agencyId: a.id, name: "For Sale", address: "A", city: "Budva", priceMinor: 500000, dealType: "sale" });
  const rent = await createProperty(db, { agencyId: a.id, name: "For Rent", address: "B", city: "Budva", priceMinor: 100000 });
  await publishProperty(db, sale.id);
  await publishProperty(db, rent.id);
  const results = await searchProperties(db, a.id, { dealType: "sale" });
  expect(results.map((r) => r.name)).toEqual(["For Sale"]);
});

test("getPropertyBySource finds a property created with a sourceId", async () => {
  const a = await agency();
  const created = await createProperty(db, {
    agencyId: a.id, name: "Sourced", address: "A", city: "Budva", priceMinor: 100000,
    sourceId: "ext-123",
  });
  const found = await getPropertyBySource(db, a.id, "ext-123");
  expect(found?.id).toBe(created.id);
  expect(await getPropertyBySource(db, a.id, "nope")).toBeNull();
});

test("multiple properties with null sourceId in the same agency are allowed", async () => {
  const a = await agency();
  await createProperty(db, { agencyId: a.id, name: "One", address: "A", city: "Budva", priceMinor: 100000 });
  // A second null-sourceId property must not trip the unique index.
  await expect(
    createProperty(db, { agencyId: a.id, name: "Two", address: "B", city: "Budva", priceMinor: 200000 }),
  ).resolves.toBeDefined();
});

test("searchProperties paginates and countProperties counts the full match set", async () => {
  const a = await agency();
  for (let i = 0; i < 30; i++) {
    const p = await createProperty(db, {
      agencyId: a.id, name: `L${i}`, address: "A", city: "Budva", priceMinor: 100000,
      dealType: i < 10 ? "sale" : "rent",
    });
    await publishProperty(db, p.id);
  }

  expect((await searchProperties(db, a.id, {}, { limit: 24, offset: 0 }))).toHaveLength(24);
  expect((await searchProperties(db, a.id, {}, { limit: 24, offset: 24 }))).toHaveLength(6);
  expect(await countProperties(db, a.id, {})).toBe(30);

  // A filter narrows both the page and the count.
  expect((await searchProperties(db, a.id, { dealType: "sale" }, { limit: 24, offset: 0 }))).toHaveLength(10);
  expect(await countProperties(db, a.id, { dealType: "sale" })).toBe(10);
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
