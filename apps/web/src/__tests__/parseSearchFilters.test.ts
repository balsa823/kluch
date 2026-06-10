import { describe, expect, it } from "vitest";
import { parseSearchFilters } from "../app.js";

describe("parseSearchFilters", () => {
  it("converts euro price inputs to cents", () => {
    const f = parseSearchFilters({ minPrice: "500", maxPrice: "1000" });
    expect(f.minPrice).toBe(50000);
    expect(f.maxPrice).toBe(100000);
  });

  it("keeps a valid property type, drops an invalid one", () => {
    expect(parseSearchFilters({ type: "land" }).type).toBe("land");
    expect(parseSearchFilters({ type: "apartment" }).type).toBeUndefined();
  });

  it("reads city, bedrooms, dealType and page", () => {
    const f = parseSearchFilters({ city: " Kotor ", bedrooms: "2", dealType: "rent", page: "3" });
    expect(f).toMatchObject({ city: "Kotor", bedrooms: 2, dealType: "rent", page: 3 });
  });

  it("ignores blanks and bad values", () => {
    expect(parseSearchFilters({ city: "", page: "0", dealType: "x" })).toEqual({});
  });

  it("normalizes a ref code to upper-case", () => {
    expect(parseSearchFilters({ code: "st-0042" }).refCode).toBe("ST-0042");
  });

  it("trims surrounding whitespace from a ref code", () => {
    expect(parseSearchFilters({ code: "  st-0042 " }).refCode).toBe("ST-0042");
  });

  it("ignores a ref code that does not match the XX-NNNN shape", () => {
    expect(parseSearchFilters({ code: "hello" }).refCode).toBeUndefined();
    expect(parseSearchFilters({ code: "ST" }).refCode).toBeUndefined();
    expect(parseSearchFilters({ code: "" }).refCode).toBeUndefined();
  });

  it("reads repeated loc params into locations (city / city|area)", () => {
    const f = parseSearchFilters({}, ["Budva", "Kotor|Dobrota"]);
    expect(f.locations).toEqual([
      { city: "Budva" },
      { city: "Kotor", area: "Dobrota" },
    ]);
  });

  it("splits loc on the first pipe only and trims parts", () => {
    const f = parseSearchFilters({}, [" Kotor | Dobrota | x "]);
    expect(f.locations).toEqual([{ city: "Kotor", area: "Dobrota | x" }]);
  });

  it("skips empty loc values and an empty city", () => {
    const f = parseSearchFilters({}, ["", "  ", "|Dobrota", "Budva"]);
    expect(f.locations).toEqual([{ city: "Budva" }]);
  });

  it("caps the number of locations", () => {
    const many = Array.from({ length: 80 }, (_, i) => `City${i}`);
    const f = parseSearchFilters({}, many);
    expect(f.locations).toHaveLength(50);
  });

  it("leaves locations undefined when no loc params are given", () => {
    expect(parseSearchFilters({}).locations).toBeUndefined();
    expect(parseSearchFilters({}, []).locations).toBeUndefined();
  });

  it("treats a ref-code-shaped q as a refCode", () => {
    expect(parseSearchFilters({ q: "st-0042" }).refCode).toBe("ST-0042");
    expect(parseSearchFilters({ q: "  st-0042 " }).refCode).toBe("ST-0042");
  });

  it("treats free-text q as text search", () => {
    const f = parseSearchFilters({ q: "sea view" });
    expect(f.text).toBe("sea view");
    expect(f.refCode).toBeUndefined();
  });

  it("ignores a blank q", () => {
    const f = parseSearchFilters({ q: "   " });
    expect(f.text).toBeUndefined();
    expect(f.refCode).toBeUndefined();
  });
});
