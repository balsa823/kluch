import { expect, test } from "vitest";
import { MNE_LOCATIONS, cityNames, areasFor, isKnownArea, cityCoords, areaCoords } from "../index.js";

test("MNE_LOCATIONS is non-empty and well-shaped", () => {
  expect(MNE_LOCATIONS.length).toBeGreaterThan(0);
  for (const entry of MNE_LOCATIONS) {
    expect(typeof entry.city).toBe("string");
    expect(entry.city.length).toBeGreaterThan(0);
    expect(Array.isArray(entry.areas)).toBe(true);
  }
});

test("cityNames includes Podgorica and Budva", () => {
  const names = cityNames();
  expect(names).toContain("Podgorica");
  expect(names).toContain("Budva");
});

test("areasFor returns the right list", () => {
  expect(areasFor("Budva")).toContain("Bečići");
  expect(areasFor("Nonexistent")).toEqual([]);
});

test("isKnownArea true/false cases", () => {
  expect(isKnownArea("Budva", "Bečići")).toBe(true);
  expect(isKnownArea("Budva", "Nope")).toBe(false);
});

test("cityCoords returns Podgorica centre", () => {
  const c = cityCoords("Podgorica");
  expect(c).not.toBeNull();
  expect(c!.lat).toBeCloseTo(42.44, 1);
  expect(c!.lng).toBeCloseTo(19.26, 1);
});

test("cityCoords non-null for Budva, null for unknown", () => {
  expect(cityCoords("Budva")).not.toBeNull();
  expect(cityCoords("Nowhere")).toBeNull();
});

test("cityCoords covers every MNE city", () => {
  for (const { city } of MNE_LOCATIONS) {
    expect(cityCoords(city), `missing coords for ${city}`).not.toBeNull();
  }
});

test("areaCoords for a Podgorica area differs from the city centre", () => {
  // The area name must match a real curated area string.
  expect(areasFor("Podgorica")).toContain("Blok 5");
  const a = areaCoords("Podgorica", "Blok 5");
  const c = cityCoords("Podgorica")!;
  expect(a).not.toBeNull();
  expect(a!.lat === c.lat && a!.lng === c.lng).toBe(false);
});

test("areaCoords null for an area without coords", () => {
  expect(areaCoords("Podgorica", "Nonexistent")).toBeNull();
});
