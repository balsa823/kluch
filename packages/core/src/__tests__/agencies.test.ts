import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import {
  slugify, createAgency, getAgencyBySlug, getAgencyByDomain,
  updateAgencyConfig, addAgencyDomain,
} from "../agencies.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("slugify lowercases, strips diacritics, and dashes non-alphanumerics", () => {
  expect(slugify("Popović Nekretnine")).toBe("popovic-nekretnine");
  expect(slugify("  Hello,  World!! ")).toBe("hello-world");
  expect(slugify("Crème Brûlée")).toBe("creme-brulee");
});

test("createAgency derives a slug from the name", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  expect(a.slug).toBe("adriatic-homes");
  expect(a.colorPrimary).toBe("#1F3A5C");
});

test("createAgency honours an explicit slug", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes", slug: "custom-slug" });
  expect(a.slug).toBe("custom-slug");
});

test("createAgency disambiguates duplicate slugs", async () => {
  const a = await createAgency(db, { name: "Sea View" });
  const b = await createAgency(db, { name: "Sea View" });
  const c = await createAgency(db, { name: "Sea View" });
  expect(a.slug).toBe("sea-view");
  expect(b.slug).toBe("sea-view-2");
  expect(c.slug).toBe("sea-view-3");
});

test("getAgencyBySlug returns the agency or null", async () => {
  await createAgency(db, { name: "Adriatic Homes" });
  const found = await getAgencyBySlug(db, "adriatic-homes");
  expect(found?.name).toBe("Adriatic Homes");
  expect(await getAgencyBySlug(db, "nope")).toBeNull();
});

test("updateAgencyConfig updates only provided fields", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const updated = await updateAgencyConfig(db, a.id, {
    tagline: "Your home by the sea", colorPrimary: "#000000",
  });
  expect(updated.tagline).toBe("Your home by the sea");
  expect(updated.colorPrimary).toBe("#000000");
  expect(updated.colorAccent).toBe("#4E827A"); // untouched default
});

test("addAgencyDomain + getAgencyByDomain round-trip (lowercased)", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const d = await addAgencyDomain(db, a.id, "  Adriatic.ME  ");
  expect(d.domain).toBe("adriatic.me");
  const found = await getAgencyByDomain(db, "ADRIATIC.me");
  expect(found?.id).toBe(a.id);
  expect(await getAgencyByDomain(db, "unknown.com")).toBeNull();
});

test("duplicate domain throws", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await addAgencyDomain(db, a.id, "adriatic.me");
  await expect(addAgencyDomain(db, a.id, "adriatic.me")).rejects.toThrow();
});
