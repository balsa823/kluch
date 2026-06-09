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

test("createInquiry supports a phone_click lead with no name/contact", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const p = await createProperty(db, {
    agencyId: a.id, name: "Studio", address: "A", city: "Budva", priceMinor: 100000,
  });
  const inq = await createInquiry(db, { agencyId: a.id, kind: "phone_click", propertyId: p.id });
  expect(inq.kind).toBe("phone_click");
  expect(inq.name).toBeNull();
  expect(inq.contact).toBeNull();
  expect(inq.propertyId).toBe(p.id);
});

test("createInquiry defaults kind to 'inquiry'", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const inq = await createInquiry(db, { agencyId: a.id, name: "Ana", contact: "a@x.me" });
  expect(inq.kind).toBe("inquiry");
});

test("listInquiries filters by kind, newest-first", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await createInquiry(db, { agencyId: a.id, name: "Ana", contact: "a@x.me" });
  await new Promise((r) => setTimeout(r, 5));
  const click1 = await createInquiry(db, { agencyId: a.id, kind: "phone_click" });
  await new Promise((r) => setTimeout(r, 5));
  const click2 = await createInquiry(db, { agencyId: a.id, kind: "phone_click" });

  const clicks = await listInquiries(db, a.id, { kind: "phone_click" });
  expect(clicks.map((r) => r.id)).toEqual([click2.id, click1.id]);
  expect(clicks.every((r) => r.kind === "phone_click")).toBe(true);

  const all = await listInquiries(db, a.id);
  expect(all).toHaveLength(3);
});

test("createInquiry stores visitorId and tourDate", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const visitorId = "11111111-1111-1111-1111-111111111111";
  const inq = await createInquiry(db, {
    agencyId: a.id, kind: "tour", name: "Ana", contact: "a@x.me",
    visitorId, tourDate: "2026-07-01",
  });
  expect(inq.visitorId).toBe(visitorId);
  expect(inq.tourDate).toBe("2026-07-01");
});
