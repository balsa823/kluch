import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { payments } from "@kluche/db";
import { createLease } from "../leases.js";
import { claimPayment, confirmPayment, leasesDueOn, formatMoney } from "../rent.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

const prop = { name: "4B", address: "x", city: "Budva" };

test("formatMoney renders minor units as currency", () => {
  expect(formatMoney(45000, "EUR")).toBe("€450.00");
  expect(formatMoney(9999, "EUR")).toBe("€99.99");
});

test("leasesDueOn returns active leases due on the given day", async () => {
  await createLease(db, { property: prop, rentMinor: 45000, dueDay: 5 });
  await createLease(db, { property: prop, rentMinor: 50000, dueDay: 15 });
  const due = await leasesDueOn(db, 5);
  expect(due).toHaveLength(1);
  expect(due[0].dueDay).toBe(5);
});

test("claimPayment creates a pending payment using the lease rent", async () => {
  const { lease } = await createLease(db, { property: prop, rentMinor: 45000, dueDay: 5 });
  const p = await claimPayment(db, lease.id, "2026-06");
  expect(p.status).toBe("pending");
  expect(p.amountMinor).toBe(45000);
  expect(p.period).toBe("2026-06");
});

test("claimPayment is idempotent per lease+period", async () => {
  const { lease } = await createLease(db, { property: prop, rentMinor: 45000, dueDay: 5 });
  const a = await claimPayment(db, lease.id, "2026-06");
  const b = await claimPayment(db, lease.id, "2026-06");
  expect(b.id).toBe(a.id);
  const rows = await db.select().from(payments).where(eq(payments.leaseId, lease.id));
  expect(rows).toHaveLength(1);
});

test("confirmPayment marks the payment confirmed with a timestamp", async () => {
  const { lease } = await createLease(db, { property: prop, rentMinor: 45000, dueDay: 5 });
  const p = await claimPayment(db, lease.id, "2026-06");
  const confirmed = await confirmPayment(db, p.id);
  expect(confirmed.status).toBe("confirmed");
  expect(confirmed.confirmedAt).not.toBeNull();
});
