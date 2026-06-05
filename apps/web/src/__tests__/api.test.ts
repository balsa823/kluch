import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency, createAgencyUser } from "@kluch/core";
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
