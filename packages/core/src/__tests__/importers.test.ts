import { expect, test } from "vitest";
import {
  bestate4Parser,
  mapBestate4,
  pickParser,
  unwrapFirestore,
} from "../importers.js";

// A representative Firestore typed-value `fields` object.
const FIXTURE = {
  title: { stringValue: "Cozy 1BR near the river" },
  monthlyRent: { integerValue: "450" },
  bedrooms: { integerValue: "1" },
  bathrooms: { integerValue: "1" },
  area: { integerValue: "46" },
  price: { integerValue: "0" },
  listingType: { stringValue: "FOR_RENT" },
  type: { stringValue: "Residential" },
  locationDisplay: { stringValue: "Podgorica, Ljubović, Montenegro" },
  montenegroLocation: {
    mapValue: {
      fields: {
        city: { stringValue: "podgorica" },
        neighborhood: { stringValue: "ljubovic" },
        state: { stringValue: "Crna Gora" },
      },
    },
  },
  images: {
    arrayValue: {
      values: [
        { stringValue: "https://firebasestorage.googleapis.com/one.jpg" },
        { stringValue: "https://firebasestorage.googleapis.com/two.jpg" },
      ],
    },
  },
  features: {
    arrayValue: { values: [{ stringValue: "Parking" }] },
  },
  description: { stringValue: "A lovely flat." },
  status: { stringValue: "active" },
};

test("unwrapFirestore turns typed values into a plain object", () => {
  const out = unwrapFirestore({
    s: { stringValue: "hi" },
    n: { integerValue: "42" },
    d: { doubleValue: 3.5 },
    b: { booleanValue: true },
    nil: { nullValue: null },
    arr: { arrayValue: { values: [{ integerValue: "1" }, { stringValue: "x" }] } },
    map: { mapValue: { fields: { inner: { stringValue: "deep" } } } },
  });
  expect(out).toEqual({
    s: "hi",
    n: 42,
    d: 3.5,
    b: true,
    nil: null,
    arr: [1, "x"],
    map: { inner: "deep" },
  });
});

test("unwrapFirestore handles empty arrayValue and missing values", () => {
  expect(unwrapFirestore({ arr: { arrayValue: {} } })).toEqual({ arr: [] });
});

test("bestate4Parser.matches by host suffix", () => {
  expect(bestate4Parser.matches("www.bestate4.me")).toBe(true);
  expect(bestate4Parser.matches("bestate4.me")).toBe(true);
  expect(bestate4Parser.matches("example.com")).toBe(false);
});

test("mapBestate4 maps fixture fields to a ParsedListing", () => {
  const parsed = mapBestate4(unwrapFirestore(FIXTURE));
  expect(parsed.name).toBe("Cozy 1BR near the river");
  expect(parsed.city).toBe("Podgorica");
  expect(parsed.priceMinor).toBe(45000);
  expect(parsed.currency).toBe("EUR");
  expect(parsed.bedrooms).toBe(1);
  expect(parsed.bathrooms).toBe(1);
  expect(parsed.areaM2).toBe(46);
  expect(parsed.type).toBe("apartment");
  expect(parsed.photos).toEqual([
    "https://firebasestorage.googleapis.com/one.jpg",
    "https://firebasestorage.googleapis.com/two.jpg",
  ]);
  expect(parsed.address).toBe("Podgorica, Ljubović, Montenegro");
});

test("mapBestate4 uses sale price when no monthlyRent and marks studio for 0 bedrooms", () => {
  const parsed = mapBestate4({
    title: "Studio for sale",
    price: 80000,
    bedrooms: 0,
    locationDisplay: "Budva, Center, Montenegro",
  });
  expect(parsed.priceMinor).toBe(8000000);
  expect(parsed.type).toBe("studio");
  expect(parsed.city).toBe("Budva");
});

test("mapBestate4 throws when title is missing", () => {
  expect(() => mapBestate4({ locationDisplay: "x" })).toThrow();
});

test("pickParser resolves by URL host", () => {
  expect(pickParser("https://www.bestate4.me/listing/abc")).toBe(bestate4Parser);
  expect(pickParser("https://zoopla.co.uk/x")).toBeNull();
});
