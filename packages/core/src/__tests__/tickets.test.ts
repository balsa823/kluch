import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { FakeTranslator } from "../translate.js";
import { findOrCreateUser } from "../users.js";
import { createLease } from "../leases.js";
import { createTicket, updateTicketStatus } from "../tickets.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

async function setup() {
  const { lease } = await createLease(db, {
    property: { name: "4B", address: "x", city: "Budva" }, rentMinor: 45000, dueDay: 5,
  });
  const user = await findOrCreateUser(db, { telegramUserId: 10 });
  return { lease, user };
}

test("createTicket stores a translated ticket and returns a numeric id", async () => {
  const { lease, user } = await setup();
  const tr = new FakeTranslator();
  const ticket = await createTicket(db, tr, {
    leaseId: lease.id, occupantUserId: user.id, description: "Voda ne radi", locale: "me",
  });
  expect(typeof ticket.id).toBe("number");
  expect(ticket.status).toBe("received");
  expect(ticket.translatedDescription).toBe("[EN] Voda ne radi");
  expect(tr.calls).toHaveLength(1);
  expect(tr.calls[0].to).toBe("EN");
});

test("an English-speaking occupant's ticket is not translated", async () => {
  const { lease, user } = await setup();
  const tr = new FakeTranslator();
  const ticket = await createTicket(db, tr, {
    leaseId: lease.id, occupantUserId: user.id, description: "Boiler broken", locale: "en",
  });
  expect(ticket.translatedDescription).toBeNull();
  expect(tr.calls).toHaveLength(0);
});

test("createTicket stores an optional photo file id", async () => {
  const { lease, user } = await setup();
  const ticket = await createTicket(db, new FakeTranslator(), {
    leaseId: lease.id, occupantUserId: user.id, description: "leak", locale: "ru", photoFileId: "PHOTO123",
  });
  expect(ticket.photoFileId).toBe("PHOTO123");
});

test("updateTicketStatus changes the status", async () => {
  const { lease, user } = await setup();
  const ticket = await createTicket(db, new FakeTranslator(), {
    leaseId: lease.id, occupantUserId: user.id, description: "leak", locale: "ru",
  });
  const updated = await updateTicketStatus(db, ticket.id, "scheduled");
  expect(updated.status).toBe("scheduled");
});
