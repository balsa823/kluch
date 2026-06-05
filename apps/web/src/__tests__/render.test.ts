import { expect, test } from "vitest";
import type { Agency, Property } from "@kluch/core";
import { renderAgencySite } from "../render.js";

const agency: Agency = {
  id: "a1",
  name: "Popović Nekretnine",
  slug: "popovic",
  logoUrl: "https://cdn.example/logo.png",
  colorPrimary: "#1F3A5C",
  colorAccent: "#4E827A",
  tagline: "Your home on the Adriatic",
  createdAt: new Date(),
};

const listings: Property[] = [
  {
    id: "p1",
    name: "Seaside Studio",
    address: "Obala 1",
    city: "Kotor",
    landlordName: null,
    landlordContact: null,
    createdAt: new Date(),
    agencyId: "a1",
    priceMinor: 12000000,
    currency: "EUR",
    bedrooms: 1,
    bathrooms: 1,
    areaM2: 40,
    type: "studio",
    status: "published",
    photos: ["https://cdn.example/p1.jpg"],
  },
  {
    id: "p2",
    name: "Old Town Apartment",
    address: "Trg 2",
    city: "Podgorica",
    landlordName: null,
    landlordContact: null,
    createdAt: new Date(),
    agencyId: "a1",
    priceMinor: 45000,
    currency: "EUR",
    bedrooms: 2,
    bathrooms: 1,
    areaM2: 70,
    type: "apartment",
    status: "published",
    photos: [],
  },
];

test("renders the agency name and logo", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("Popović Nekretnine");
  expect(html).toContain(`<img`);
  expect(html).toContain("https://cdn.example/logo.png");
});

test("injects agency colours as CSS variables", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("--color-primary: #1F3A5C");
  expect(html).toContain("--color-accent: #4E827A");
});

test("renders one card per listing with title, price and city", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("Seaside Studio");
  expect(html).toContain("Old Town Apartment");
  expect(html).toContain("€120000.00");
  expect(html).toContain("€450.00");
  expect(html).toContain("Kotor");
  expect(html).toContain("Podgorica");
});

test("uses the first photo as the card image when present", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("https://cdn.example/p1.jpg");
});

test("renders a GET search form with the expected inputs", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`method="get"`);
  expect(html).toContain(`name="city"`);
  expect(html).toContain(`name="minPrice"`);
  expect(html).toContain(`name="maxPrice"`);
  expect(html).toContain(`name="bedrooms"`);
});

test("pre-fills the form from the given filters", () => {
  const html = renderAgencySite(agency, listings, { city: "Kotor", maxPrice: 50000 });
  expect(html).toContain(`value="Kotor"`);
  expect(html).toContain(`value="50000"`);
});

test("includes a Powered by Kluch footer", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("Powered by Kluch");
});

test("falls back to the default color when colorPrimary is malicious (CSS injection)", () => {
  const html = renderAgencySite({ ...agency, colorPrimary: "red} body{x:1}" }, listings);
  expect(html).not.toContain("red} body{x:1}");
  expect(html).toContain("--color-primary: #1F3A5C");
});

test("escapes the agency name to prevent HTML injection", () => {
  const html = renderAgencySite({ ...agency, name: "<script>alert(1)</script>" }, listings);
  expect(html).not.toContain("<script>alert(1)</script>");
});

test("drops a javascript: photo URL", () => {
  const evil: Property = { ...listings[0], photos: ["javascript:alert(1)"] };
  const html = renderAgencySite(agency, [evil]);
  expect(html).not.toContain("javascript:alert(1)");
});

test("drops a javascript: logo URL", () => {
  const html = renderAgencySite({ ...agency, logoUrl: "javascript:alert(1)" }, listings);
  expect(html).not.toContain("javascript:alert(1)");
});
