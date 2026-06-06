import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { findOrCreateUser } from "../users.js";
import { createLease, linkOccupantByCode, generateJoinCode, getActiveLeaseForUser } from "../leases.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

const sampleProperty = { name: "Apartment 4B", address: "Jadranski put 1", city: "Budva" };

test("generateJoinCode produces an unambiguous fixed-length code", () => {
  const code = generateJoinCode();
  expect(code).toHaveLength(6);
  expect(code).toMatch(/^[A-Z2-9]+$/); // no 0/O/1/I
});

test("createLease creates a property + lease with a unique join code", async () => {
  const { lease, property } = await createLease(db, {
    property: sampleProperty, rentMinor: 45000, dueDay: 5,
  });
  expect(property.name).toBe("Apartment 4B");
  expect(lease.joinCode).toHaveLength(6);
  expect(lease.rentMinor).toBe(45000);
  expect(lease.currency).toBe("EUR");
  expect(lease.occupantUserId).toBeNull();
});

test("linkOccupantByCode links the user and returns lease + property", async () => {
  const { lease } = await createLease(db, { property: sampleProperty, rentMinor: 45000, dueDay: 5 });
  const user = await findOrCreateUser(db, { telegramUserId: 1 });
  const result = await linkOccupantByCode(db, user.id, lease.joinCode);
  expect(result).not.toBeNull();
  expect(result!.lease.occupantUserId).toBe(user.id);
  expect(result!.property.city).toBe("Budva");
});

test("a bad code returns null", async () => {
  const user = await findOrCreateUser(db, { telegramUserId: 2 });
  expect(await linkOccupantByCode(db, user.id, "ZZZZZZ")).toBeNull();
});

test("the same user re-linking is idempotent", async () => {
  const { lease } = await createLease(db, { property: sampleProperty, rentMinor: 45000, dueDay: 5 });
  const user = await findOrCreateUser(db, { telegramUserId: 3 });
  await linkOccupantByCode(db, user.id, lease.joinCode);
  const again = await linkOccupantByCode(db, user.id, lease.joinCode);
  expect(again!.lease.occupantUserId).toBe(user.id);
});

test("getActiveLeaseForUser returns the linked lease+property, or null", async () => {
  const { lease } = await createLease(db, { property: sampleProperty, rentMinor: 45000, dueDay: 5 });
  const user = await findOrCreateUser(db, { telegramUserId: 99 });
  expect(await getActiveLeaseForUser(db, user.id)).toBeNull();
  await linkOccupantByCode(db, user.id, lease.joinCode);
  const res = await getActiveLeaseForUser(db, user.id);
  expect(res!.lease.id).toBe(lease.id);
  expect(res!.property.city).toBe("Budva");
});

test("a code already linked to another occupant is rejected", async () => {
  const { lease } = await createLease(db, { property: sampleProperty, rentMinor: 45000, dueDay: 5 });
  const a = await findOrCreateUser(db, { telegramUserId: 4 });
  const b = await findOrCreateUser(db, { telegramUserId: 5 });
  await linkOccupantByCode(db, a.id, lease.joinCode);
  await expect(linkOccupantByCode(db, b.id, lease.joinCode)).rejects.toThrow();
});
