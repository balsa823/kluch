import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency, createAgencyUser } from "@kluch/core";
import { createApp } from "../app.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

async function seedAgencyAdmin() {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  await createAgencyUser(db, {
    agencyId: agency.id, email: "admin@popovic.me", name: "Balša", role: "admin", password: "pw123",
  });
  return agency;
}

/** Extracts the value of the session cookie from a Set-Cookie header for reuse. */
function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("no set-cookie header");
  return setCookie.split(";")[0];
}

test("GET /dashboard without a cookie redirects to /login", async () => {
  const app = createApp(db, { sessionSecret: "test" });
  const res = await app.request(new Request("http://localhost/dashboard"));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});

test("POST /login with correct creds sets a cookie and redirects to /dashboard", async () => {
  await seedAgencyAdmin();
  const app = createApp(db, { sessionSecret: "test" });
  const form = new URLSearchParams({ email: "admin@popovic.me", password: "pw123" });
  const res = await app.request(new Request("http://localhost/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/dashboard");
  expect(res.headers.get("set-cookie")).toContain("session=");
});

test("POST /login with wrong creds redirects to /login?error=1", async () => {
  await seedAgencyAdmin();
  const app = createApp(db, { sessionSecret: "test" });
  const form = new URLSearchParams({ email: "admin@popovic.me", password: "wrong" });
  const res = await app.request(new Request("http://localhost/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login?error=1");
});

test("authenticated GET /dashboard shows the agency name and the add-listing form", async () => {
  await seedAgencyAdmin();
  const app = createApp(db, { sessionSecret: "test" });
  const login = await app.request(new Request("http://localhost/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "admin@popovic.me", password: "pw123" }).toString(),
  }));
  const cookie = cookieFrom(login);

  const res = await app.request(new Request("http://localhost/dashboard", {
    headers: { cookie },
  }));
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain("Popović Nekretnine");
  expect(body).toContain('action="/dashboard/listings"');
});

test("POST /dashboard/listings creates a property that then shows on the dashboard", async () => {
  await seedAgencyAdmin();
  const app = createApp(db, { sessionSecret: "test" });
  const login = await app.request(new Request("http://localhost/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "admin@popovic.me", password: "pw123" }).toString(),
  }));
  const cookie = cookieFrom(login);

  const created = await app.request(new Request("http://localhost/dashboard/listings", {
    method: "POST",
    headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "Lake House", address: "Jezero 1", city: "Podgorica",
      priceMinor: "150000", bedrooms: "3", type: "house",
    }).toString(),
  }));
  expect(created.status).toBe(302);
  expect(created.headers.get("location")).toBe("/dashboard");

  const dash = await app.request(new Request("http://localhost/dashboard", { headers: { cookie } }));
  expect(await dash.text()).toContain("Lake House");
});

test("POST /dashboard/listings without a cookie redirects to /login", async () => {
  const app = createApp(db, { sessionSecret: "test" });
  const res = await app.request(new Request("http://localhost/dashboard/listings", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "X", address: "Y", city: "Z", priceMinor: "1", bedrooms: "1", type: "house" }).toString(),
  }));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});

test("GET /logout clears the session and redirects to /login", async () => {
  await seedAgencyAdmin();
  const app = createApp(db, { sessionSecret: "test" });
  const res = await app.request(new Request("http://localhost/logout"));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});

test("GET /login renders a form with email and password fields", async () => {
  const app = createApp(db, { sessionSecret: "test" });
  const res = await app.request(new Request("http://localhost/login"));
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('name="email"');
  expect(body).toContain('name="password"');
});
