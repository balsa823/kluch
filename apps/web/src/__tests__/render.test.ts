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

test("renders the chip row with Location/Price/Listing/Beds/Type and no old tab row", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`data-pop="loc"`);
  expect(html).toContain(`data-pop="price"`);
  expect(html).toContain(`data-pop="deal"`);
  expect(html).toContain(`data-pop="beds"`);
  expect(html).toContain(`data-pop="type"`);
  expect(html).toContain(`data-i18n="filter.location"`);
  // the old standalone filter-tab row is gone
  expect(html).not.toContain(`class="tabs"`);
  expect(html).not.toContain(`href="?dealType=rent"`);
});

test("embeds the Montenegro locations JSON blob for the Location popover", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`id="kluche-locations"`);
  expect(html).toContain("Budva");
  expect(html).toContain("Dobrota");
});

test("Location chip is active and a hidden loc input is emitted for filters.locations", () => {
  const html = renderAgencySite(agency, listings, { locations: [{ city: "Budva" }] });
  expect(html).toMatch(/<input type="hidden" name="loc" value="Budva"/);
  // chip is marked active server-side
  expect(html).toMatch(/data-pop="loc"[^>]*class="chip active"|class="chip active"[^>]*data-pop="loc"/);
});

test("a city|area location emits a piped hidden loc input", () => {
  const html = renderAgencySite(agency, listings, { locations: [{ city: "Kotor", area: "Dobrota" }] });
  expect(html).toContain(`name="loc" value="Kotor|Dobrota"`);
});

test("pre-selects the active deal type + property type from filters", () => {
  const html = renderAgencySite(agency, listings, { dealType: "rent", type: "land" });
  expect(html).toMatch(/data-group="deal"[^>]*data-value="rent"[^>]*class="opt sel"|class="opt sel"[^>]*data-group="deal"[^>]*data-value="rent"/);
  expect(html).toMatch(/data-value="rent"/);
  expect(html).toMatch(/data-value="land"/);
  // hidden fields carry the active values for submit
  expect(html).toContain(`name="dealType" value="rent"`);
  expect(html).toContain(`name="type" value="land"`);
});

test("fills the search box from filters.text and filters.refCode", () => {
  expect(renderAgencySite(agency, listings, { text: "sea view" })).toContain(`value="sea view"`);
  expect(renderAgencySite(agency, listings, { refCode: "PO-0001" })).toContain(`value="PO-0001"`);
});

test("shows a thank-you message when sent", () => {
  const html = renderAgencySite(agency, listings, {}, { sent: true });
  expect(html).toContain(`data-i18n="contact.thankyou"`);
});

test("uses the first photo as the card image when present", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("https://cdn.example/p1.jpg");
});

test("renders a GET search form with the free-text q input and price popover fields", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain(`method="get"`);
  expect(html).toContain(`name="q"`);
  expect(html).toContain(`name="minPrice"`);
  expect(html).toContain(`name="maxPrice"`);
});

test("pre-fills the price popover from the given filters (price shown in euros)", () => {
  const html = renderAgencySite(agency, listings, { maxPrice: 50000 });
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
  // Price is emitted in euros (50000 cents = €500); parseSearchFilters re-multiplies
  // by 100, so emitting cents here would balloon the filter on every page step.
  expect(next).toContain("maxPrice=500");
  expect(next).not.toContain("maxPrice=50000");
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

test("a refCode filter fills the q search box (round-trips via the hero search)", () => {
  const html = renderAgencySite(agency, listings, { refCode: "PO-0001" });
  expect(html).toContain(`name="q"`);
  expect(html).toContain(`value="PO-0001"`);
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

test("no [data-i18n] element wraps a form control (regression: applyLang would delete it)", () => {
  const html = renderAgencySite(agency, listings);
  // The bug was <label data-i18n="…"><input/></label>: setting textContent on the
  // label during translation deletes the input. Labels must now use an inner <span>.
  expect(html).not.toMatch(/<label[^>]*\bdata-i18n=/);
  // Contact-form captions survive as siblings of their inputs.
  expect(html).toContain('<span data-i18n="contact.name">');
  expect(html).toContain('name="contact"');
});

test("the hero composes location + deal + type filters into one form", () => {
  const html = renderAgencySite(agency, listings, { locations: [{ city: "Budva" }], dealType: "rent", type: "residential" });
  expect(html).toContain('name="loc" value="Budva"');
  expect(html).toContain('name="dealType" value="rent"');
  expect(html).toContain('name="type" value="residential"');
});

test("pager and tab hrefs emit price in euros, not cents", () => {
  // minPrice stored as 50000 cents (€500). The href must say 500, else each
  // navigation would re-multiply by 100.
  const html = renderAgencySite(agency, listings, { minPrice: 50000 }, { page: 1, pageSize: 1, total: 5 });
  expect(html).toContain("minPrice=500");
  expect(html).not.toContain("minPrice=50000");
});

test("listings with no price show 'Price on request'", () => {
  const free: Property[] = [{ ...listings[0], id: "p0", priceMinor: 0, refCode: "PO-0003" }] as Property[];
  const html = renderAgencySite(agency, free);
  expect(html).toContain('data-i18n="card.priceOnRequest"');
  expect(html).toContain('"card.priceOnRequest":"Price on request"');
});

test("Clear-filters link appears only when a filter is active", () => {
  expect(renderAgencySite(agency, listings, { locations: [{ city: "Budva" }] })).toContain('class="search-clear"');
  expect(renderAgencySite(agency, listings, { text: "sea" })).toContain('class="search-clear"');
  expect(renderAgencySite(agency, listings, {})).not.toContain('class="search-clear"');
});
