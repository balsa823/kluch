import { expect, test } from "vitest";
import { MNE_LOCATIONS, cityNames, areasFor, isKnownArea } from "../index.js";

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
