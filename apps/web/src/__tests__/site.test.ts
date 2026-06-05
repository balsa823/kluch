import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { createAgency, addAgencyDomain } from "@kluch/core";
import { resolveSite } from "../site.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

async function seedAgency() {
  const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
  await addAgencyDomain(db, agency.id, "popovicnekretnine.me");
  return agency;
}

test("apex and www resolve to the marketplace", async () => {
  expect(await resolveSite("kluche.me", db)).toEqual({ kind: "marketplace" });
  expect(await resolveSite("www.kluche.me", db)).toEqual({ kind: "marketplace" });
});

test("agency subdomain resolves to the console", async () => {
  expect(await resolveSite("agency.kluche.me", db)).toEqual({ kind: "console" });
});

test("a slug subdomain resolves to that agency", async () => {
  const agency = await seedAgency();
  const site = await resolveSite("popovic.kluche.me", db);
  expect(site.kind).toBe("agency");
  if (site.kind === "agency") expect(site.agency.id).toBe(agency.id);
});

test("a custom domain resolves to that agency", async () => {
  const agency = await seedAgency();
  const site = await resolveSite("popovicnekretnine.me", db);
  expect(site.kind).toBe("agency");
  if (site.kind === "agency") expect(site.agency.id).toBe(agency.id);
});

test("an unknown host resolves to notfound", async () => {
  expect(await resolveSite("does-not-exist.kluche.me", db)).toEqual({ kind: "notfound" });
  expect(await resolveSite("randomdomain.com", db)).toEqual({ kind: "notfound" });
});

test("a :port suffix is stripped and host is lowercased", async () => {
  await seedAgency();
  expect(await resolveSite("KLUCHE.ME:8080", db)).toEqual({ kind: "marketplace" });
  const site = await resolveSite("Popovic.kluche.me:8080", db);
  expect(site.kind).toBe("agency");
});
