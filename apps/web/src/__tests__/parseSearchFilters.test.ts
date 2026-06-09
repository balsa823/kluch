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
});
