import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency } from "../agencies.js";
import { createAgencyUser } from "../agencyUsers.js";
import { hashPassword, verifyPassword, verifyAgencyUser, getAgencyUserById } from "../auth.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("hashPassword + verifyPassword round-trip", () => {
  const stored = hashPassword("hunter2");
  expect(stored).toContain(":");
  expect(verifyPassword("hunter2", stored)).toBe(true);
  expect(verifyPassword("wrong", stored)).toBe(false);
});

test("verifyPassword returns false on malformed input", () => {
  expect(verifyPassword("hunter2", "not-a-valid-stored-value")).toBe(false);
  expect(verifyPassword("hunter2", "")).toBe(false);
  expect(verifyPassword("hunter2", "deadbeef:")).toBe(false);
});

test("verifyAgencyUser returns the user on correct password", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await createAgencyUser(db, { agencyId: a.id, email: "Boss@Adriatic.ME", role: "admin", password: "pw123" });
  const user = await verifyAgencyUser(db, "boss@adriatic.me", "pw123");
  expect(user).not.toBeNull();
  expect(user?.email).toBe("boss@adriatic.me");
});

test("verifyAgencyUser returns null on wrong password", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await createAgencyUser(db, { agencyId: a.id, email: "boss@adriatic.me", password: "pw123" });
  expect(await verifyAgencyUser(db, "boss@adriatic.me", "nope")).toBeNull();
});

test("verifyAgencyUser returns null for unknown email", async () => {
  expect(await verifyAgencyUser(db, "ghost@nowhere.me", "pw123")).toBeNull();
});

test("verifyAgencyUser returns null when user has no password set", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await createAgencyUser(db, { agencyId: a.id, email: "nopw@adriatic.me" });
  expect(await verifyAgencyUser(db, "nopw@adriatic.me", "anything")).toBeNull();
});

test("getAgencyUserById returns the user or null", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const created = await createAgencyUser(db, { agencyId: a.id, email: "boss@adriatic.me", password: "pw123" });
  const found = await getAgencyUserById(db, created.id);
  expect(found?.id).toBe(created.id);
  expect(await getAgencyUserById(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
});
