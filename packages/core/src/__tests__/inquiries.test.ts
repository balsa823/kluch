import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { createAgency } from "../agencies.js";
import { createProperty } from "../listings.js";
import { createInquiry, listInquiries } from "../inquiries.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("createInquiry persists with defaults", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const inq = await createInquiry(db, { agencyId: a.id, name: "Ana", contact: "ana@example.com" });
  expect(inq.agencyId).toBe(a.id);
  expect(inq.name).toBe("Ana");
  expect(inq.contact).toBe("ana@example.com");
  expect(inq.status).toBe("new");
  expect(inq.propertyId).toBeNull();
  expect(inq.message).toBeNull();
});

test("createInquiry accepts propertyId and message", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const p = await createProperty(db, {
    agencyId: a.id, name: "Studio", address: "A", city: "Budva", priceMinor: 100000,
  });
  const inq = await createInquiry(db, {
    agencyId: a.id, propertyId: p.id, name: "Boris", contact: "+38269", message: "Interested",
  });
  expect(inq.propertyId).toBe(p.id);
  expect(inq.message).toBe("Interested");
});

test("listInquiries returns agency inquiries newest-first", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const b = await createAgency(db, { name: "Other" });
  const first = await createInquiry(db, { agencyId: a.id, name: "First", contact: "c1" });
  await new Promise((r) => setTimeout(r, 5));
  const second = await createInquiry(db, { agencyId: a.id, name: "Second", contact: "c2" });
  await createInquiry(db, { agencyId: b.id, name: "Other", contact: "c3" });

  const results = await listInquiries(db, a.id);
  expect(results.map((r) => r.name)).toEqual([second.name, first.name]);
  expect(results.find((r) => r.id === first.id)?.propertyId).toBeNull();
});
