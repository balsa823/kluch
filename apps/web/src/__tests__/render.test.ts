import { expect, test } from "vitest";
import type { Agency, Property } from "@kluche/core";
import { renderAgencySite } from "../render.js";

const agency: Agency = {
  id: "a1",
  name: "Popović Nekretnine",
  slug: "popovic",
  logoUrl: "https://cdn.example/logo.png",
  colorPrimary: "#1F3A5C",
  colorAccent: "#4E827A",
  tagline: "Your home on the Adriatic",
  phone: null,
  refPrefix: "PO",
  refSeq: 2,
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
    type: "residential",
    dealType: "sale",
    status: "published",
    photos: ["https://cdn.example/p1.jpg"],
    refCode: "PO-0001",
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
    type: "residential",
    dealType: "rent",
    status: "published",
    photos: [],
    refCode: "PO-0002",
  },
] as Property[];

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

test("renders all four language buttons", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`data-code="en"`);
  expect(html).toContain(`data-code="sr"`);
  expect(html).toContain(`data-code="ru"`);
  expect(html).toContain(`data-code="tr"`);
});

test("contact form posts to the slug inquiry endpoint with a honeypot", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`action="/a/popovic/inquiry"`);
  expect(html).toContain(`method="post"`);
  expect(html).toContain(`name="company"`);
  expect(html).toContain(`name="name"`);
  expect(html).toContain(`name="contact"`);
  expect(html).toContain(`name="message"`);
});

test("rent listing shows a per-month label and the for-rent tag", () => {
  const rent: Property = { ...listings[0], dealType: "rent" } as Property;
  const html = renderAgencySite(agency, [rent]);
  expect(html).toContain(`data-i18n="card.perMonth"`); // the per-month span on the card
  expect(html).toContain("/ mo");
  expect(html).toContain(`data-i18n="card.forRent"`);
});

test("sale listing shows the for-sale tag but no per-month label on its card", () => {
  const sale: Property = { ...listings[0], dealType: "sale" } as Property;
  const html = renderAgencySite(agency, [sale]);
  expect(html).toContain(`data-i18n="card.forSale"`);
  // The per-month span only appears on rent cards. Its data-i18n attribute is
  // unique to the card markup (the bare key string also lives in the i18n dict).
  expect(html).not.toContain(`data-i18n="card.perMonth"`);
});

test("renders deal-type filter tabs", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`href="?dealType=rent"`);
  expect(html).toContain(`href="?dealType=sale"`);
});

test("preserves dealType (hidden) + pre-selects the property type", () => {
  const html = renderAgencySite(agency, listings, { dealType: "rent", type: "land" });
  expect(html).toContain(`name="dealType" value="rent"`); // preserved across search
  expect(html).toMatch(/<option value="land"[^>]*selected/); // property-type filter
});

test("shows a thank-you message when sent", () => {
  const html = renderAgencySite(agency, listings, {}, { sent: true });
  expect(html).toContain(`data-i18n="contact.thankyou"`);
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

test("pre-fills the form from the given filters (price shown in euros)", () => {
  const html = renderAgencySite(agency, listings, { city: "Kotor", maxPrice: 50000 });
  expect(html).toContain(`value="Kotor"`);
  expect(html).toContain(`value="500"`); // 50000 cents → €500 in the form
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

test("page 1 of multiple shows a Next link and no Prev link", () => {
  const html = renderAgencySite(agency, listings, {}, { page: 1, pageSize: 24, total: 30 });
  expect(html).toContain(`href="?page=2"`);
  expect(html).toContain("Page 1 of 2");
  expect(html).not.toContain("pager-prev");
});

test("last page shows a Prev link and no Next link", () => {
  const html = renderAgencySite(agency, listings, {}, { page: 2, pageSize: 24, total: 30 });
  expect(html).toContain(`href="?"`);
  expect(html).toContain(`class="pager-link pager-prev"`);
  expect(html).toContain("Page 2 of 2");
  expect(html).not.toContain("pager-next");
});

test("pager links preserve the active filters", () => {
  const html = renderAgencySite(
    agency,
    listings,
    { city: "Kotor", dealType: "rent", maxPrice: 50000 },
    { page: 1, pageSize: 24, total: 30 },
  );
  const next = html.match(/pager-next" href="([^"]+)"/)?.[1] ?? "";
  expect(next).toContain("city=Kotor");
  expect(next).toContain("dealType=rent");
  expect(next).toContain("maxPrice=50000");
  expect(next).toContain("page=2");
});

test("no pager when total fits on one page", () => {
  const html = renderAgencySite(agency, listings, {}, { page: 1, pageSize: 24, total: 20 });
  expect(html).not.toContain(`<nav class="pager"`);
});

test("renders a call button per listing when the agency has a phone", () => {
  const withPhone = { ...agency, phone: "+382 67 111 222" };
  const html = renderAgencySite(withPhone, listings);
  expect(html).toContain(`class="call-btn"`);
  expect(html).toContain(`data-pid="p1"`);
  expect(html).toContain(`data-pid="p2"`);
});

test("renders no call button when the agency has no phone", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).not.toContain(`class="call-btn"`);
});

test("emits a listings JSON blob, modal container and tour panel", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`id="kluche-listings"`);
  expect(html).toContain(`id="kluche-modal"`);
  expect(html).toContain(`id="kluche-tour"`);
});

test("cards carry a data-id and are keyboard-activatable", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`data-id="p1"`);
  expect(html).toContain(`data-id="p2"`);
  expect(html).toMatch(/class="card" data-id="p1" role="button" tabindex="0"/);
});

test("call control is a phone icon button with stopPropagation", () => {
  const withPhone = { ...agency, phone: "+382 67 111 222" };
  const html = renderAgencySite(withPhone, listings);
  expect(html).toContain(`data-i18n="card.call"`);
  expect(html).toContain(`onclick="event.stopPropagation()"`);
  expect(html).toContain("📞");
});

test("listings JSON blob escapes < to avoid breaking out of the script tag", () => {
  const evil: Property = { ...listings[0], name: "</script><b>x" };
  const html = renderAgencySite(agency, [evil]);
  expect(html).not.toContain("</script><b>x");
  expect(html).toContain("\\u003c/script>");
});

test("shows the ref code as a card badge and includes it in the listings JSON blob", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("PO-0001");
  expect(html).toContain("PO-0002");
  expect(html).toContain(`class="card-code"`);
  // The code is also embedded in the modal's listings blob.
  expect(html).toMatch(/"refCode":"PO-0001"/);
});

test("renders a ref-code search field and the search.code i18n key", () => {
  const html = renderAgencySite(agency, listings, { refCode: "PO-0001" });
  expect(html).toContain(`name="code"`);
  expect(html).toContain(`value="PO-0001"`);
  expect(html).toContain(`data-i18n="search.code"`);
});

test("does not render a card badge when a listing has no ref code", () => {
  const noCode: Property = { ...listings[0], refCode: null } as Property;
  const html = renderAgencySite(agency, [noCode]);
  expect(html).not.toContain(`class="card-code"`);
});

test("only safe photo URLs are embedded in the listings blob", () => {
  const evil: Property = { ...listings[0], photos: ["javascript:alert(1)", "https://cdn.example/ok.jpg"] };
  const html = renderAgencySite(agency, [evil]);
  expect(html).not.toContain("javascript:alert(1)");
  expect(html).toContain("https://cdn.example/ok.jpg");
});
