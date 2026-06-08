import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { createAgency, createAgencyUser, createPartnerUser, createProperty, publishProperty } from "@kluche/core";
import { createApp } from "../app.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

const SECRET = "test";

async function seedAdmin() {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  await createAgencyUser(db, {
    agencyId: agency.id, email: "admin@popovic.me", name: "Balša", role: "admin", password: "pw123",
  });
  return agency;
}

async function login(app: ReturnType<typeof createApp>, email: string, password: string): Promise<Response> {
  return app.request(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }));
}

async function tokenFor(app: ReturnType<typeof createApp>, email: string, password: string): Promise<string> {
  const body = (await (await login(app, email, password)).json()) as { token: string };
  return body.token;
}

// --- Task 1.2: auth endpoints ---

test("POST /api/auth/login with correct creds returns a token and user", async () => {
  const agency = await seedAdmin();
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await login(app, "admin@popovic.me", "pw123");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string; user: { email: string; role: string; agencyId: string } };
  expect(typeof body.token).toBe("string");
  expect(body.user.email).toBe("admin@popovic.me");
  expect(body.user.role).toBe("admin");
  expect(body.user.agencyId).toBe(agency.id);
});

test("POST /api/auth/login with wrong creds returns 401", async () => {
  await seedAdmin();
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await login(app, "admin@popovic.me", "wrong");
  expect(res.status).toBe(401);
  expect(((await res.json()) as { error: string }).error).toBe("invalid credentials");
});

test("GET /api/me with a valid Bearer token returns user and agency", async () => {
  const agency = await seedAdmin();
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await tokenFor(app, "admin@popovic.me", "pw123");

  const res = await app.request(new Request("http://localhost/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { user: { email: string }; agency: { id: string } };
  expect(body.user.email).toBe("admin@popovic.me");
  expect(body.agency.id).toBe(agency.id);
});

test("GET /api/me without a token returns 401", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/me"));
  expect(res.status).toBe(401);
});

test("GET /api/me with an invalid token returns 401", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/me", {
    headers: { Authorization: "Bearer garbage" },
  }));
  expect(res.status).toBe(401);
});

// --- Task 1.3: JSON listings API ---

test("GET /api/listings returns only the token holder's agency listings", async () => {
  const agencyA = await seedAdmin();
  const agencyB = await createAgency(db, { name: "Other Agency", slug: "other" });
  const bListing = await createProperty(db, {
    agencyId: agencyB.id, name: "B Villa", address: "B St", city: "Bar", priceMinor: 1000, bedrooms: 2,
  });
  await publishProperty(db, bListing.id);
  const aListing = await createProperty(db, {
    agencyId: agencyA.id, name: "A Flat", address: "A St", city: "Podgorica", priceMinor: 2000, bedrooms: 1,
  });
  await publishProperty(db, aListing.id);

  const app = createApp(db, { sessionSecret: SECRET });
  const token = await tokenFor(app, "admin@popovic.me", "pw123");

  const res = await app.request(new Request("http://localhost/api/listings", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(res.status).toBe(200);
  const { listings } = (await res.json()) as { listings: { id: string }[] };
  expect(listings).toHaveLength(1);
  expect(listings[0].id).toBe(aListing.id);
  expect(listings.some((l) => l.id === bListing.id)).toBe(false);
});

test("POST /api/listings creates a listing scoped to the token's agency and it appears in the list", async () => {
  const agencyA = await seedAdmin();
  const agencyB = await createAgency(db, { name: "Other Agency", slug: "other" });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await tokenFor(app, "admin@popovic.me", "pw123");

  const created = await app.request(new Request("http://localhost/api/listings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    // Attempt to spoof another agency — must be ignored.
    body: JSON.stringify({
      agencyId: agencyB.id,
      name: "Lake House", address: "Jezero 1", city: "Podgorica", priceMinor: 150000, bedrooms: 3, type: "house",
    }),
  }));
  expect(created.status).toBe(201);
  const property = (await created.json()) as { id: string; agencyId: string; status: string };
  expect(property.agencyId).toBe(agencyA.id);
  expect(property.status).toBe("published");

  const list = await app.request(new Request("http://localhost/api/listings", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const { listings } = (await list.json()) as { listings: { id: string }[] };
  expect(listings.some((l) => l.id === property.id)).toBe(true);
});

test("GET /api/listings without a token returns 401", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/listings"));
  expect(res.status).toBe(401);
});

test("POST /api/listings without a token returns 401", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/listings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "X", address: "Y", city: "Z", priceMinor: 1, bedrooms: 1 }),
  }));
  expect(res.status).toBe(401);
});

// --- import from URL ---

test("POST /api/listings/import without a token returns 401", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/listings/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://www.bestate4.me/listing/abc" }),
  }));
  expect(res.status).toBe(401);
});

test("POST /api/listings/import with a token but no url returns 400", async () => {
  await seedAdmin();
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await tokenFor(app, "admin@popovic.me", "pw123");
  const res = await app.request(new Request("http://localhost/api/listings/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({}),
  }));
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBeTruthy();
});

test("POST /api/listings/import with an unsupported host returns 400 with an error", async () => {
  await seedAdmin();
  const app = createApp(db, { sessionSecret: SECRET });
  const token = await tokenFor(app, "admin@popovic.me", "pw123");
  const res = await app.request(new Request("http://localhost/api/listings/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/x" }),
  }));
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("Unsupported listing site");
});

// --- partner platform login + me ---

async function seedPartner() {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  await createPartnerUser(db, {
    email: "partner@popovic.me", name: "Balša", password: "pw123",
    dashboards: { agency: { agencyId: agency.id } },
  });
  return agency;
}

function platformLogin(app: ReturnType<typeof createApp>, email: string, password: string): Promise<Response> {
  return app.request(new Request("http://localhost/api/platform/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }));
}

test("POST /api/platform/login returns a token, dashboards and user", async () => {
  await seedPartner();
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await platformLogin(app, "partner@popovic.me", "pw123");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string; dashboards: string[]; user: { email: string; name: string } };
  expect(typeof body.token).toBe("string");
  expect(body.dashboards).toEqual(["agency"]);
  expect(body.user.email).toBe("partner@popovic.me");
  expect(body.user.name).toBe("Balša");
});

test("POST /api/platform/login with wrong creds returns 401", async () => {
  await seedPartner();
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await platformLogin(app, "partner@popovic.me", "wrong");
  expect(res.status).toBe(401);
});

test("GET /api/platform/me returns the user, dashboards and agency", async () => {
  const agency = await seedPartner();
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  const res = await app.request(new Request("http://localhost/api/platform/me", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { user: { email: string }; dashboards: string[]; agency: { id: string } };
  expect(body.user.email).toBe("partner@popovic.me");
  expect(body.dashboards).toEqual(["agency"]);
  expect(body.agency.id).toBe(agency.id);
});

test("GET /api/platform/me without a token returns 401", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/platform/me"));
  expect(res.status).toBe(401);
});

test("GET /api/listings works with a partner token scoped to its agency", async () => {
  const agency = await seedPartner();
  const listing = await createProperty(db, {
    agencyId: agency.id, name: "P Flat", address: "P St", city: "Podgorica", priceMinor: 2000, bedrooms: 1,
  });
  await publishProperty(db, listing.id);
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  const res = await app.request(new Request("http://localhost/api/listings", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(res.status).toBe(200);
  const { listings } = (await res.json()) as { listings: { id: string }[] };
  expect(listings).toHaveLength(1);
  expect(listings[0].id).toBe(listing.id);
});
