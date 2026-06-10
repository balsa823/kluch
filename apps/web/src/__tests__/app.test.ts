import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { createAgency, createPartnerUser, createProperty, getProperty, publishProperty, FakeStorage, LocalDiskStorage } from "@kluche/core";
import { createApp } from "../app.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

const SECRET = "test";

/** Creates a partner scoped to `agencyId` and returns a Bearer token for it. */
async function ownerToken(app: ReturnType<typeof createApp>, agencyId: string): Promise<string> {
  await createPartnerUser(db, {
    email: `owner-${agencyId}@x.me`, name: "Owner", password: "pw123",
    dashboards: { agency: { agencyId } },
  });
  const res = await app.request(new Request("http://kluche.me/api/platform/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `owner-${agencyId}@x.me`, password: "pw123" }),
  }));
  return ((await res.json()) as { token: string }).token;
}

async function seed() {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });

  const a = await createProperty(db, {
    agencyId: agency.id, name: "Old Town Flat", address: "Trg 1",
    city: "Podgorica", priceMinor: 45000, bedrooms: 2, type: "residential",
    photos: ["https://cdn.example/a.jpg"],
  });
  const b = await createProperty(db, {
    agencyId: agency.id, name: "Kotor Villa", address: "Obala 2",
    city: "Kotor", priceMinor: 90000, bedrooms: 4, type: "residential",
  });
  const draft = await createProperty(db, {
    agencyId: agency.id, name: "Hidden Draft", address: "Secret 3",
    city: "Podgorica", priceMinor: 30000, type: "residential",
  });
  await publishProperty(db, a.id);
  await publishProperty(db, b.id);
  // draft left unpublished

  return { agency, draft };
}

test("GET /uploads/* serves a file written by LocalDiskStorage, 404 when missing", async () => {
  const uploadDir = join(tmpdir(), `kluch-uploads-${randomUUID()}`);
  const storage = new LocalDiskStorage(uploadDir, "/uploads");
  const url = await storage.upload("properties/x/photo-0.png", new Uint8Array([1, 2, 3, 4]), "image/png");
  expect(url).toBe("/uploads/properties/x/photo-0.png");

  const app = createApp(db, { storage, uploadDir });
  const res = await app.request(new Request(`http://localhost${url}`));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));

  const missing = await app.request(new Request("http://localhost/uploads/properties/x/nope.png"));
  expect(missing.status).toBe(404);
});

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

test("/a/:slug renders the agency site, 404 for unknown", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine" });
  const p = await createProperty(db, { agencyId: agency.id, name: "Flat", address: "x", city: "Kotor", priceMinor: 1000 });
  await publishProperty(db, p.id);
  const app = createApp(db);
  const ok = await app.request(new Request("http://kluche.me/a/popovic-nekretnine"));
  expect(ok.status).toBe(200);
  expect(await ok.text()).toContain("Popović Nekretnine");
  expect((await app.request(new Request("http://kluche.me/a/nope"))).status).toBe(404);
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

test("/a/:slug?code= returns just the matching listing, bogus code returns none", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const a = await createProperty(db, {
    agencyId: agency.id, name: "Old Town Flat", address: "Trg 1",
    city: "Podgorica", priceMinor: 45000, type: "residential",
  });
  const b = await createProperty(db, {
    agencyId: agency.id, name: "Kotor Villa", address: "Obala 2",
    city: "Kotor", priceMinor: 90000, type: "residential",
  });
  await publishProperty(db, a.id);
  await publishProperty(db, b.id);
  expect(a.refCode).toBeTruthy();
  const app = createApp(db);

  const hit = await app.request(new Request(`http://kluche.me/a/popovic?code=${a.refCode}`));
  expect(hit.status).toBe(200);
  const hitBody = await hit.text();
  expect(hitBody).toContain("Old Town Flat");
  expect(hitBody).not.toContain("Kotor Villa");

  // Bogus (but well-formed) code matches nothing.
  const miss = await app.request(new Request("http://kluche.me/a/popovic?code=PO-9999"));
  expect(miss.status).toBe(200);
  const missBody = await miss.text();
  expect(missBody).not.toContain("Old Town Flat");
  expect(missBody).not.toContain("Kotor Villa");
  // Empty result set renders the "no properties" placeholder (count == 0).
  expect(missBody).toContain(`data-i18n="properties.empty"`);
});

test("unknown agency host returns 404", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://nope.kluche.me/"));
  expect(res.status).toBe(404);
});

test("apex host renders the marketing landing page", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://kluche.me/"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Your keys to Montenegro");
});

test("agency console host renders the console placeholder", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://agency.kluche.me/"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Kluch agency console");
});

test("POST /api/agency/:id/config persists a valid color", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await ownerToken(app, agency.id);
  const res = await app.request(new Request(`http://kluche.me/api/agency/${agency.id}/config`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ colorPrimary: "#aa0000" }),
  }));
  expect(res.status).toBe(200);
  const body = await res.json() as any;
  expect(body.colorPrimary).toBe("#aa0000");
  const reloaded = await createApp(db).request(new Request("http://popovic.kluche.me/"));
  expect(await reloaded.text()).toContain("#aa0000");
});

test("POST /api/agency/:id/config rejects an invalid color with 400", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await ownerToken(app, agency.id);
  const res = await app.request(new Request(`http://kluche.me/api/agency/${agency.id}/config`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ colorPrimary: "red} x" }),
  }));
  expect(res.status).toBe(400);
  const body = await res.json() as any;
  expect(body.error).toBe("Invalid color");
});

test("create draft property is hidden until published, then appears on agency host", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db);

  const created = await app.request(new Request(`http://kluche.me/api/agency/${agency.id}/properties`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Brand New Flat", address: "Nova 1", city: "Bar",
      priceMinor: 55000, bedrooms: 2, type: "residential",
    }),
  }));
  expect(created.status).toBe(201);
  const property = await created.json() as any;

  const beforePublish = await createApp(db).request(new Request("http://popovic.kluche.me/"));
  expect(await beforePublish.text()).not.toContain("Brand New Flat");

  const published = await app.request(new Request(`http://kluche.me/api/properties/${property.id}/publish`, {
    method: "POST",
  }));
  expect(published.status).toBe(200);

  const afterPublish = await createApp(db).request(new Request("http://popovic.kluche.me/"));
  expect(await afterPublish.text()).toContain("Brand New Flat");
});

test("POST /api/properties/:id/publish on unknown id returns 404", async () => {
  const app = createApp(db);
  const res = await app.request(new Request(
    "http://kluche.me/api/properties/00000000-0000-0000-0000-000000000000/publish",
    { method: "POST" },
  ));
  expect(res.status).toBe(404);
});

test("POST /api/agency/:id/logo uploads and persists the logo", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const storage = new FakeStorage();
  const app = createApp(db, { storage, sessionSecret: SECRET });
  const token = await ownerToken(app, agency.id);

  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "l.jpg", { type: "image/jpeg" }));
  const res = await app.request(new Request(`http://kluche.me/api/agency/${agency.id}/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }));
  expect(res.status).toBe(200);
  const body = await res.json() as any;
  expect(body.logoUrl).toBe(`https://fake.storage/agencies/${agency.id}/logo.jpg`);
  expect(storage.calls).toHaveLength(1);

  const page = await createApp(db).request(new Request("http://popovic.kluche.me/"));
  expect(await page.text()).toContain(body.logoUrl);
});

test("POST /api/agency/:id/logo with a non-uuid id returns 400 and uploads nothing", async () => {
  const storage = new FakeStorage();
  const app = createApp(db, { storage });
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "l.jpg", { type: "image/jpeg" }));
  // ..%2f..%2fevil decodes to ../../evil — a path-traversal attempt.
  const res = await app.request(new Request("http://kluche.me/api/agency/..%2f..%2fevil/logo", {
    method: "POST",
    body: form,
  }));
  expect(res.status).toBe(400);
  expect((await res.json() as any).error).toBe("invalid id");
  expect(storage.calls).toHaveLength(0);
});

test("POST /api/agency/:id/config with a non-uuid id returns 400", async () => {
  const app = createApp(db);
  const res = await app.request(new Request("http://kluche.me/api/agency/..%2f..%2fevil/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ colorPrimary: "#aa0000" }),
  }));
  expect(res.status).toBe(400);
  expect((await res.json() as any).error).toBe("invalid id");
});

test("POST /api/agency/:id/logo for an unknown agency returns 403 and uploads nothing", async () => {
  const storage = new FakeStorage();
  const app = createApp(db, { storage, sessionSecret: SECRET });
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "l.jpg", { type: "image/jpeg" }));
  const res = await app.request(new Request(
    "http://kluche.me/api/agency/00000000-0000-0000-0000-000000000000/logo",
    { method: "POST", body: form },
  ));
  expect(res.status).toBe(403);
  expect((await res.json() as any).error).toBe("forbidden");
  expect(storage.calls).toHaveLength(0);
});

test("POST /api/agency/:id/logo with no file returns 400 (not 500)", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const storage = new FakeStorage();
  const app = createApp(db, { storage, sessionSecret: SECRET });
  const token = await ownerToken(app, agency.id);
  const res = await app.request(new Request(`http://kluche.me/api/agency/${agency.id}/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: new FormData(),
  }));
  expect(res.status).toBe(400);
  expect((await res.json() as any).error).toBe("file required");
  expect(storage.calls).toHaveLength(0);
});

test("POST /api/properties/:id/photos for an unknown property returns 404 and uploads nothing", async () => {
  const storage = new FakeStorage();
  const app = createApp(db, { storage });
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1])], "1.jpg", { type: "image/jpeg" }));
  const res = await app.request(new Request(
    "http://kluche.me/api/properties/00000000-0000-0000-0000-000000000000/photos",
    { method: "POST", body: form },
  ));
  expect(res.status).toBe(404);
  expect(storage.calls).toHaveLength(0);
});

test("POST /api/agency/:id/logo without storage returns 500", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await ownerToken(app, agency.id);
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1])], "l.jpg", { type: "image/jpeg" }));
  const res = await app.request(new Request(`http://kluche.me/api/agency/${agency.id}/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }));
  expect(res.status).toBe(500);
  expect((await res.json() as any).error).toBe("storage not configured");
});

test("POST /api/properties/:id/photos uploads multiple files and persists them", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const property = await createProperty(db, {
    agencyId: agency.id, name: "Photo Flat", address: "Slika 1",
    city: "Tivat", priceMinor: 40000, type: "residential",
  });
  const storage = new FakeStorage();
  const app = createApp(db, { storage });

  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2])], "1.jpg", { type: "image/jpeg" }));
  form.append("file", new File([new Uint8Array([3, 4])], "2.png", { type: "image/png" }));
  const res = await app.request(new Request(`http://kluche.me/api/properties/${property.id}/photos`, {
    method: "POST",
    body: form,
  }));
  expect(res.status).toBe(200);
  const body = await res.json() as any;
  expect(body.photos).toEqual([
    `https://fake.storage/properties/${property.id}/photo-0.jpg`,
    `https://fake.storage/properties/${property.id}/photo-1.png`,
  ]);
  expect(storage.calls).toHaveLength(2);

  const reloaded = await getProperty(db, property.id);
  expect(reloaded?.photos).toEqual(body.photos);
});
