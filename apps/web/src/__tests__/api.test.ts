import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { createAgency, createAgencyUser, createPartnerUser, createProperty, publishProperty, listInquiries, createInquiry, updateAgencyConfig } from "@kluche/core";
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
      name: "Lake House", address: "Jezero 1", city: "Podgorica", priceMinor: 150000, bedrooms: 3, type: "residential",
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

async function platformLogin(app: ReturnType<typeof createApp>, email: string, password: string): Promise<Response> {
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

// --- public inquiry endpoint ---

test("POST /a/:slug/inquiry with a valid form stores an inquiry and redirects", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  const body = new URLSearchParams({
    name: "Jane Doe", contact: "jane@example.com", message: "I'd love a viewing.",
  });
  const res = await app.request(new Request(`http://localhost/a/${agency.slug}/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }));
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(`/a/${agency.slug}?sent=1`);
  const stored = await listInquiries(db, agency.id);
  expect(stored).toHaveLength(1);
  expect(stored[0].name).toBe("Jane Doe");
  expect(stored[0].contact).toBe("jane@example.com");
});

test("POST /a/:slug/inquiry ignores a forged propertyId (no 500, stored with null)", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  for (const bad of ["not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
    const body = new URLSearchParams({ name: "Jane", contact: "j@x.me", propertyId: bad });
    const res = await app.request(new Request(`http://localhost/a/${agency.slug}/inquiry`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }));
    expect(res.status).toBe(303); // not 500
  }
  const stored = await listInquiries(db, agency.id);
  expect(stored).toHaveLength(2);
  expect(stored.every((i) => i.propertyId === null)).toBe(true);
});

test("POST /a/:slug/inquiry with the honeypot filled redirects but stores nothing", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  const body = new URLSearchParams({
    company: "spam-bot", name: "Bot", contact: "bot@x.me", message: "buy now",
  });
  const res = await app.request(new Request(`http://localhost/a/${agency.slug}/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }));
  expect(res.status).toBe(303);
  expect(await listInquiries(db, agency.id)).toHaveLength(0);
});

test("POST /a/:slug/inquiry missing name returns 400 and stores nothing", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  const body = new URLSearchParams({ contact: "jane@example.com", message: "hi" });
  const res = await app.request(new Request(`http://localhost/a/${agency.slug}/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }));
  expect(res.status).toBe(400);
  expect(await listInquiries(db, agency.id)).toHaveLength(0);
});

test("POST /a/:slug/inquiry for an unknown agency returns 404", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const body = new URLSearchParams({ name: "X", contact: "x@x.me" });
  const res = await app.request(new Request("http://localhost/a/nope/inquiry", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }));
  expect(res.status).toBe(404);
});

// --- phone-click endpoint + leads list ---

test("POST /a/:slug/phone-click returns the agency phone and stores a phone_click lead", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  await updateAgencyConfig(db, agency.id, { phone: "+382 67 111 222" });
  const prop = await createProperty(db, {
    agencyId: agency.id, name: "Studio", address: "A", city: "Budva", priceMinor: 100000,
  });
  await publishProperty(db, prop.id);
  const app = createApp(db, { sessionSecret: SECRET });

  const res = await app.request(new Request(`http://localhost/a/${agency.slug}/phone-click`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ propertyId: prop.id }),
  }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { phone: string | null };
  expect(body.phone).toBe("+382 67 111 222");

  const clicks = await listInquiries(db, agency.id, { kind: "phone_click" });
  expect(clicks).toHaveLength(1);
  expect(clicks[0].propertyId).toBe(prop.id);
  expect(clicks[0].name).toBeNull();
});

test("POST /a/:slug/phone-click for an unknown agency returns 404", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/a/nope/phone-click", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }));
  expect(res.status).toBe(404);
});

test("POST /a/:slug/phone-click drops a forged propertyId (no 500, stored null)", async () => {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  const app = createApp(db, { sessionSecret: SECRET });
  for (const bad of ["not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
    const res = await app.request(new Request(`http://localhost/a/${agency.slug}/phone-click`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId: bad }),
    }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { phone: string | null }).phone).toBeNull();
  }
  const clicks = await listInquiries(db, agency.id, { kind: "phone_click" });
  expect(clicks).toHaveLength(2);
  expect(clicks.every((c) => c.propertyId === null)).toBe(true);
});

test("GET /api/agency/leads?kind=phone_click returns only phone_click leads with propertyName", async () => {
  const agency = await seedPartner();
  const prop = await createProperty(db, {
    agencyId: agency.id, name: "Seaside Studio", address: "A", city: "Budva", priceMinor: 100000,
  });
  await publishProperty(db, prop.id);
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  // one inquiry + one phone_click
  await app.request(new Request(`http://localhost/a/${agency.slug}/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "Jane", contact: "j@x.me" }).toString(),
  }));
  await app.request(new Request(`http://localhost/a/${agency.slug}/phone-click`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ propertyId: prop.id }),
  }));

  const res = await app.request(new Request("http://localhost/api/agency/leads?kind=phone_click", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(res.status).toBe(200);
  const { leads } = (await res.json()) as { leads: { kind: string; propertyId: string | null; propertyName: string | null }[] };
  expect(leads).toHaveLength(1);
  expect(leads[0].kind).toBe("phone_click");
  expect(leads[0].propertyName).toBe("Seaside Studio");
});

test("GET /api/agency/leads without a token returns 403", async () => {
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request("http://localhost/api/agency/leads"));
  expect(res.status).toBe(403);
});

test("GET /api/agency/leads is scoped: a partner sees only its own agency's leads", async () => {
  const agency = await seedPartner();
  const other = await createAgency(db, { name: "Other Agency", slug: "other" });
  await createInquiry(db, { agencyId: other.id, kind: "phone_click" });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  const res = await app.request(new Request("http://localhost/api/agency/leads", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(res.status).toBe(200);
  const { leads } = (await res.json()) as { leads: { agencyId: string }[] };
  expect(leads).toHaveLength(0);
  void agency;
});

// --- Task 3: scoped config/logo endpoints ---

test("owner partner token can POST /api/agency/:id/config and it persists", async () => {
  const agency = await seedPartner();
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  const res = await app.request(new Request(`http://localhost/api/agency/${agency.id}/config`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ colorPrimary: "#101010", colorAccent: "#C9883C", tagline: "Hi" }),
  }));
  expect(res.status).toBe(200);

  const me = await app.request(new Request("http://localhost/api/platform/me", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const body = (await me.json()) as { agency: { colorPrimary: string; colorAccent: string; tagline: string } };
  expect(body.agency.colorPrimary).toBe("#101010");
  expect(body.agency.colorAccent).toBe("#C9883C");
  expect(body.agency.tagline).toBe("Hi");
});

test("POST /api/agency/:id/config cannot mass-assign slug or name", async () => {
  const agency = await seedPartner();
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  const res = await app.request(new Request(`http://localhost/api/agency/${agency.id}/config`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ slug: "hijacked", name: "Hijacked", tagline: "ok" }),
  }));
  expect(res.status).toBe(200);
  const after = (await res.json()) as { slug: string; name: string; tagline: string };
  expect(after.slug).toBe(agency.slug); // unchanged
  expect(after.name).toBe(agency.name); // unchanged
  expect(after.tagline).toBe("ok"); // whitelisted field still applied
});

test("POST /api/agency/:id/config without an Authorization header returns 403", async () => {
  const agency = await seedPartner();
  const app = createApp(db, { sessionSecret: SECRET });
  const res = await app.request(new Request(`http://localhost/api/agency/${agency.id}/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tagline: "Hi" }),
  }));
  expect(res.status).toBe(403);
});

test("a partner token scoped to another agency is forbidden from configuring this one", async () => {
  await seedPartner(); // partner is scoped to this first agency
  const other = await createAgency(db, { name: "Other Agency", slug: "other" });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "partner@popovic.me", "pw123")).json()) as { token: string }).token;

  const res = await app.request(new Request(`http://localhost/api/agency/${other.id}/config`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ tagline: "Hi" }),
  }));
  expect(res.status).toBe(403);
});

test("partner without an agency dashboard is denied agency listings", async () => {
  await createPartnerUser(db, {
    email: "lawyer@firm.me", name: "Lex", password: "pw123",
    dashboards: { law: { lawFirmId: "00000000-0000-0000-0000-000000000009" } },
  });
  const app = createApp(db, { sessionSecret: SECRET });
  const token = ((await (await platformLogin(app, "lawyer@firm.me", "pw123")).json()) as { token: string }).token;

  const listings = await app.request(new Request("http://localhost/api/listings", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(listings.status).toBe(401);

  const me = await app.request(new Request("http://localhost/api/platform/me", {
    headers: { Authorization: `Bearer ${token}` },
  }));
  expect(me.status).toBe(200);
  const meBody = (await me.json()) as { dashboards: string[]; agency: unknown };
  expect(meBody.dashboards).toEqual(["law"]);
  expect(meBody.agency).toBeNull();
});
