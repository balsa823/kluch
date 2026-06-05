import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency, createProperty, publishProperty } from "@kluch/core";
import { createApp } from "../app.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

async function seed() {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });

  const a = await createProperty(db, {
    agencyId: agency.id, name: "Old Town Flat", address: "Trg 1",
    city: "Podgorica", priceMinor: 45000, bedrooms: 2, type: "apartment",
    photos: ["https://cdn.example/a.jpg"],
  });
  const b = await createProperty(db, {
    agencyId: agency.id, name: "Kotor Villa", address: "Obala 2",
    city: "Kotor", priceMinor: 90000, bedrooms: 4, type: "house",
  });
  const draft = await createProperty(db, {
    agencyId: agency.id, name: "Hidden Draft", address: "Secret 3",
    city: "Podgorica", priceMinor: 30000, type: "apartment",
  });
  await publishProperty(db, a.id);
  await publishProperty(db, b.id);
  // draft left unpublished

  return { agency, draft };
}

test("GET /health returns ok on any host", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://anything.example/health"));
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
});

test("agency host renders published listings, not drafts", async () => {
  await seed();
  const app = createApp(db);
  const res = await app.request(new Request("http://popovic.kluche.me/"));
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain("Old Town Flat");
  expect(body).toContain("Kotor Villa");
  expect(body).not.toContain("Hidden Draft");
});

test("query filters narrow the rendered listings", async () => {
  await seed();
  const app = createApp(db);
  const res = await app.request(new Request("http://popovic.kluche.me/?city=Podgorica&maxPrice=50000"));
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain("Old Town Flat");
  expect(body).not.toContain("Kotor Villa");
});

test("unknown agency host returns 404", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://nope.kluche.me/"));
  expect(res.status).toBe(404);
});

test("apex host renders the marketplace placeholder", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://kluche.me/"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Kluch marketplace");
});

test("agency console host renders the console placeholder", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://agency.kluche.me/"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Kluch agency console");
});
