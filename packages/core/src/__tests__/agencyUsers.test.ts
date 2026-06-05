import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency } from "../agencies.js";
import { createAgencyUser, listAgencyUsers } from "../agencyUsers.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("createAgencyUser defaults role to agent and lowercases email", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const u = await createAgencyUser(db, { agencyId: a.id, email: "Agent@Adriatic.ME", name: "Mila" });
  expect(u.role).toBe("agent");
  expect(u.email).toBe("agent@adriatic.me");
  expect(u.name).toBe("Mila");
});

test("createAgencyUser honours an explicit role", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const u = await createAgencyUser(db, { agencyId: a.id, email: "boss@adriatic.me", role: "admin" });
  expect(u.role).toBe("admin");
});

test("listAgencyUsers returns all users for the agency", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await createAgencyUser(db, { agencyId: a.id, email: "boss@adriatic.me", role: "admin" });
  await createAgencyUser(db, { agencyId: a.id, email: "agent@adriatic.me" });
  const users = await listAgencyUsers(db, a.id);
  expect(users).toHaveLength(2);
  expect(users.map((u) => u.email).sort()).toEqual(["agent@adriatic.me", "boss@adriatic.me"]);
});

test("duplicate email throws", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await createAgencyUser(db, { agencyId: a.id, email: "agent@adriatic.me" });
  await expect(
    createAgencyUser(db, { agencyId: a.id, email: "AGENT@adriatic.me" }),
  ).rejects.toThrow();
});
