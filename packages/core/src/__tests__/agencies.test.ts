import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import {
  slugify, createAgency, getAgency, getAgencyBySlug, getAgencyByDomain,
  updateAgencyConfig, addAgencyDomain,
} from "../agencies.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("slugify lowercases, strips diacritics, and dashes non-alphanumerics", () => {
  expect(slugify("Popović Nekretnine")).toBe("popovic-nekretnine");
  expect(slugify("  Hello,  World!! ")).toBe("hello-world");
  expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  expect(slugify("  Stam!! ")).toBe("stam");
  expect(slugify("A & B  Co.")).toBe("a-b-co");
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

test("createAgency falls back to a usable slug for all-non-Latin names", async () => {
  // Cyrillic / non-Latin names slugify to "" — must not produce an empty/unreachable slug.
  expect(slugify("Стан")).toBe("");
  const a = await createAgency(db, { name: "Стан" });
  const b = await createAgency(db, { name: "Недвижимость" });
  expect(a.slug).toBe("agency");
  expect(b.slug).toBe("agency-2");
});

test("getAgencyBySlug returns the agency or null", async () => {
  await createAgency(db, { name: "Adriatic Homes" });
  const found = await getAgencyBySlug(db, "adriatic-homes");
  expect(found?.name).toBe("Adriatic Homes");
  expect(await getAgencyBySlug(db, "nope")).toBeNull();
});

test("getAgency returns the agency by id or null", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const found = await getAgency(db, a.id);
  expect(found?.id).toBe(a.id);
  expect(await getAgency(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
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

test("updateAgencyConfig rejects an invalid color (CSS injection)", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await expect(
    updateAgencyConfig(db, a.id, { colorPrimary: "red}; body{background:url(https://evil/?x)" }),
  ).rejects.toThrow();
  // bad value was not persisted
  const found = await getAgencyBySlug(db, a.slug);
  expect(found?.colorPrimary).toBe("#1F3A5C");
});

test("updateAgencyConfig accepts a valid hex color", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const updated = await updateAgencyConfig(db, a.id, { colorPrimary: "#abc123" });
  expect(updated.colorPrimary).toBe("#abc123");
});

test("updateAgencyConfig sets phone without changing other columns", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const updated = await updateAgencyConfig(db, a.id, { phone: "+382 67 123 456" });
  expect(updated.phone).toBe("+382 67 123 456");
  expect(updated.name).toBe(a.name);
  expect(updated.slug).toBe(a.slug);
  expect(updated.colorPrimary).toBe("#1F3A5C");
  expect(updated.colorAccent).toBe("#4E827A");
  expect(updated.tagline).toBeNull();
});

test("updateAgencyConfig sets new settings fields", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const hours = {
    mon: { open: "09:00", close: "17:00" },
    sun: null,
  };
  const updated = await updateAgencyConfig(db, a.id, {
    heroHeadline: "  Find your home  ",
    email: "hi@adriatic.me",
    defaultLang: "sr",
    observeHolidays: true,
    businessHours: hours,
    customClosures: [{ from: "2026-08-15", to: "2026-08-20", label: "Summer break" }],
    socials: { instagram: "https://instagram.com/adriatic", facebook: "" },
    heroImageUrl: "/uploads/hero.jpg",
  });
  expect(updated.heroHeadline).toBe("Find your home"); // trimmed
  expect(updated.email).toBe("hi@adriatic.me");
  expect(updated.defaultLang).toBe("sr");
  expect(updated.observeHolidays).toBe(true);
  expect(updated.businessHours).toEqual(hours);
  expect(updated.customClosures).toEqual([{ from: "2026-08-15", to: "2026-08-20", label: "Summer break" }]);
  expect(updated.socials).toEqual({ instagram: "https://instagram.com/adriatic" }); // empty dropped
  expect(updated.heroImageUrl).toBe("/uploads/hero.jpg");
});

test("updateAgencyConfig mapEnabled defaults false and persists true", async () => {
  const a = await createAgency(db, { name: "Map Co" });
  expect(a.mapEnabled).toBe(false);
  const updated = await updateAgencyConfig(db, a.id, { mapEnabled: true });
  expect(updated.mapEnabled).toBe(true);
});

test("updateAgencyConfig rejects malformed business hours", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await expect(
    updateAgencyConfig(db, a.id, { businessHours: { mon: { open: "9", close: "17:00" } } }),
  ).rejects.toThrow("Invalid hours");
  await expect(
    updateAgencyConfig(db, a.id, { businessHours: { holiday: null } as never }),
  ).rejects.toThrow("Invalid hours");
});

test("updateAgencyConfig rejects a javascript: URL", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await expect(
    updateAgencyConfig(db, a.id, { heroImageUrl: "javascript:alert(1)" }),
  ).rejects.toThrow("Invalid URL");
  await expect(
    updateAgencyConfig(db, a.id, { socials: { facebook: "javascript:alert(1)" } }),
  ).rejects.toThrow("Invalid socials");
});

test("updateAgencyConfig rejects an unsupported language", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await expect(
    updateAgencyConfig(db, a.id, { defaultLang: "de" }),
  ).rejects.toThrow("Invalid language");
});

test("updateAgencyConfig clears a text/URL field when sent null", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  await updateAgencyConfig(db, a.id, { heroHeadline: "Find Your Home", heroImageUrl: "https://cdn.example/h.jpg" });
  const cleared = await updateAgencyConfig(db, a.id, { heroHeadline: null, heroImageUrl: null, email: null });
  expect(cleared.heroHeadline).toBeNull();
  expect(cleared.heroImageUrl).toBeNull();
  expect(cleared.email).toBeNull();
});

test("updateAgencyConfig ignores non-whitelisted keys", async () => {
  const a = await createAgency(db, { name: "Adriatic Homes" });
  const updated = await updateAgencyConfig(db, a.id, {
    // @ts-expect-error slug is not part of the patch and must be ignored
    slug: "hacked", name: "Hacked", refSeq: 999,
    tagline: "ok",
  });
  expect(updated.slug).toBe(a.slug);
  expect(updated.name).toBe("Adriatic Homes");
  expect(updated.tagline).toBe("ok");
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
