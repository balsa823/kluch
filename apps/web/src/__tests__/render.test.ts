import { describe, expect, test } from "vitest";
import type { Agency, Property } from "@kluche/core";
import { renderAgencySite, thumbSrc, listingPin } from "../render.js";

const agency: Agency = {
  id: "a1",
  name: "Popović Nekretnine",
  slug: "popovic",
  logoUrl: "https://cdn.example/logo.png",
  colorPrimary: "#1F3A5C",
  colorAccent: "#4E827A",
  tagline: "Your home on the Adriatic",
  phone: null,
  heroHeadline: null,
  heroImageUrl: null,
  faviconUrl: null,
  email: null,
  whatsapp: null,
  viber: null,
  address: null,
  mapUrl: null,
  aboutBlurb: null,
  footerName: null,
  notifyEmail: null,
  defaultLang: null,
  observeHolidays: false,
  mapEnabled: false,
  businessHours: null,
  customClosures: null,
  socials: null,
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

test("thumbSrc rewrites blob URLs to /t/ and leaves others alone", () => {
  expect(
    thumbSrc("https://kluchprod.blob.core.windows.net/photos/properties/abc/photo-0.jpg", 480),
  ).toBe("/t/properties/abc/photo-0.jpg?w=480");
  // non-blob URLs pass through untouched
  expect(thumbSrc("https://cdn.example/p1.jpg", 480)).toBe("https://cdn.example/p1.jpg");
  expect(thumbSrc("/uploads/properties/abc/photo-0.jpg", 480)).toBe("/uploads/properties/abc/photo-0.jpg");
});

test("card image uses the /t thumbnail endpoint with a data-full fallback to the full URL", () => {
  const blobUrl = "https://kluchprod.blob.core.windows.net/photos/properties/abc/photo-0.jpg";
  const withBlob: Property[] = [{ ...listings[0], photos: [blobUrl] }] as Property[];
  const html = renderAgencySite(agency, withBlob);
  // card <img> src points at the thumb endpoint at w=480
  expect(html).toContain(`src="/t/properties/abc/photo-0.jpg?w=480"`);
  // fallback is a data attribute (not an inline JS-string onerror) + a delegated handler
  expect(html).toContain(`data-full="${blobUrl}"`);
  expect(html).not.toContain("onerror=");
  expect(html).toContain('img.card-photo[data-full]');
  // the modal/listings JSON still carries the FULL blob URL (quality)
  expect(html).toContain(`"photos":["${blobUrl}"]`);
});

test("a crafted photo URL cannot inject an attribute/handler on the card image", () => {
  // Scraped (attacker-influenced) URLs can try to break out of the attribute with a quote.
  const evil = 'https://x.example/a" onerror="alert(1)';
  const withEvil: Property[] = [{ ...listings[0], photos: [evil] }] as Property[];
  const html = renderAgencySite(agency, withEvil);
  expect(html).not.toContain('onerror="alert(1)'); // the breakout is neutralized
  expect(html).toContain("&quot;"); // the quote is HTML-escaped inside the attribute
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

test("the call button is in the modal, not on the card face", () => {
  const withPhone = { ...agency, phone: "+382 67 111 222" };
  const html = renderAgencySite(withPhone, listings);
  // exactly one call button (the modal's), no per-listing call buttons on the cards
  expect(html).toContain(`class="call-btn modal-call"`);
  expect(html).not.toContain(`data-pid="p1"`);
  expect(html).not.toContain(`data-pid="p2"`);
});

test("modal call button is hidden when the agency has no phone", () => {
  const html = renderAgencySite(agency, listings); // fixture has phone: null
  expect(html).toMatch(/class="call-btn modal-call"[^>]*style="display:none"/);
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

test("modal call control is a phone-icon button", () => {
  const withPhone = { ...agency, phone: "+382 67 111 222" };
  const html = renderAgencySite(withPhone, listings);
  expect(html).toContain(`data-i18n="card.call"`);
  expect(html).toContain("📞");
  expect(html).toContain(`class="call-btn modal-call"`);
});

test("phones show two cards per row (compact grid media query)", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("@media (max-width: 560px)");
  expect(html).toMatch(/@media \(max-width: 560px\)[^}]*\.grid\s*\{\s*grid-template-columns: 1fr 1fr/s);
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

test("Clear-filters button shows when a filter is active, hidden otherwise", () => {
  // The clear control is always in the DOM (so JS can reveal it on filter change),
  // but carries the `hidden` attribute until a filter is active.
  const withLoc = renderAgencySite(agency, listings, { locations: [{ city: "Budva" }] });
  expect(withLoc).toContain('id="hero-action"');
  expect(withLoc).not.toMatch(/id="hero-action"[^>]*hidden/);
  expect(renderAgencySite(agency, listings, { text: "sea" })).not.toMatch(/id="hero-action"[^>]*hidden/);
  expect(renderAgencySite(agency, listings, {})).toMatch(/id="hero-action"[^>]*hidden/);
});

test("price chip keeps its €range label after a server render (Search), not just 'Price'", () => {
  const html = renderAgencySite(agency, listings, { maxPrice: 30000 }); // €300
  expect(html).toContain("€0–300");
  // min + max
  const both = renderAgencySite(agency, listings, { minPrice: 50000, maxPrice: 80000 });
  expect(both).toContain("€500–800");
  // min only → open-ended max
  const minOnly = renderAgencySite(agency, listings, { minPrice: 50000 });
  expect(minOnly).toContain("€500–∞");
});

// --- Hero ------------------------------------------------------------------

test("hero H1 uses agency.heroHeadline literally when set", () => {
  const html = renderAgencySite({ ...agency, heroHeadline: "Live by the sea" }, listings);
  expect(html).toMatch(/<h1[^>]*>Live by the sea<\/h1>/);
  // when a headline is set, the H1 is literal (not the localizable default)
  expect(html).not.toMatch(/<h1 data-i18n="hero.title">/);
});

test("hero H1 falls back to the localizable default when no heroHeadline", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toMatch(/<h1 data-i18n="hero.title">Find Your Perfect Home<\/h1>/);
});

test("hero headline is escaped", () => {
  const html = renderAgencySite({ ...agency, heroHeadline: "<script>alert(1)</script>" }, listings);
  expect(html).not.toContain("<script>alert(1)</script>");
});

test("hero subtitle stays the agency tagline", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("Your home on the Adriatic");
});

test("hero background prefers agency.heroImageUrl over the first listing photo", () => {
  const html = renderAgencySite({ ...agency, heroImageUrl: "https://cdn.example/hero.jpg" }, listings);
  expect(html).toContain("url('https://cdn.example/hero.jpg')");
  // first-listing-photo no longer drives the hero when heroImageUrl is set
  expect(html).not.toMatch(/header\.hero[\s\S]*url\('https:\/\/cdn\.example\/p1\.jpg'\)/);
});

test("hero falls back to the first listing photo when no heroImageUrl", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("url('https://cdn.example/p1.jpg')");
});

test("hero falls back to the gradient when no heroImageUrl and no photos", () => {
  const noPhotos = [{ ...listings[0], photos: [] }] as Property[];
  const html = renderAgencySite(agency, noPhotos);
  expect(html).toContain("linear-gradient(135deg, var(--color-primary)");
});

test("favicon link present only when faviconUrl is set and safe", () => {
  const withFav = renderAgencySite({ ...agency, faviconUrl: "https://cdn.example/fav.ico" }, listings);
  expect(withFav).toContain(`<link rel="icon" href="https://cdn.example/fav.ico">`);
  // none by default
  expect(renderAgencySite(agency, listings)).not.toContain(`rel="icon"`);
  // unsafe url is rejected
  const evil = renderAgencySite({ ...agency, faviconUrl: "javascript:alert(1)" }, listings);
  expect(evil).not.toContain(`rel="icon"`);
});

// --- Footer ----------------------------------------------------------------

const HOURS = {
  mon: { open: "09:00", close: "17:00" },
  tue: { open: "09:00", close: "17:00" },
  wed: { open: "09:00", close: "17:00" },
  thu: { open: "09:00", close: "17:00" },
  fri: { open: "09:00", close: "17:00" },
  sat: { open: "10:00", close: "14:00" },
  sun: null,
};

test("footer renders the legal line with footerName fallback to name + Powered by Kluche", () => {
  expect(renderAgencySite(agency, listings)).toContain("Popović Nekretnine");
  const html = renderAgencySite({ ...agency, footerName: "Popović Group d.o.o." }, listings);
  expect(html).toContain("Popović Group d.o.o.");
  expect(html).toContain("Powered by Kluch");
});

test("footer renders 7 business-hours rows with localized day keys and times", () => {
  const html = renderAgencySite({ ...agency, businessHours: HOURS } as Agency, listings);
  expect(html).toContain(`data-i18n="footer.hours"`);
  expect(html).toContain(`data-i18n="day.mon"`);
  expect(html).toContain(`data-i18n="day.sun"`);
  expect(html).toContain("09:00–17:00");
  expect(html).toContain("10:00–14:00");
  // the closed (null) day shows a localizable "Closed"
  expect(html).toContain(`data-i18n="footer.closedDay"`);
});

test("footer open-now badge reflects openStatus (open within hours)", () => {
  // Monday 2026-06-08 12:00 Podgorica → open with the HOURS fixture.
  const html = renderAgencySite(
    { ...agency, businessHours: HOURS } as Agency,
    listings,
    {},
    { now: new Date("2026-06-08T10:00:00Z") },
  );
  expect(html).toContain(`class="open-badge is-open"`);
  expect(html).toContain(`data-i18n="footer.openNow"`);
});

test("footer open-now badge is closed outside hours", () => {
  // Sunday 2026-06-07 → null hours → closed.
  const html = renderAgencySite(
    { ...agency, businessHours: HOURS } as Agency,
    listings,
    {},
    { now: new Date("2026-06-07T10:00:00Z") },
  );
  expect(html).toContain(`class="open-badge is-closed"`);
});

test("footer renders social icons only for present, safe socials", () => {
  const html = renderAgencySite(
    { ...agency, socials: { instagram: "https://instagram.com/popovic", facebook: "javascript:alert(1)" } } as Agency,
    listings,
  );
  expect(html).toContain("https://instagram.com/popovic");
  // an unsafe facebook url is dropped, and absent socials emit no link
  expect(html).not.toContain("javascript:alert(1)");
  expect(html).not.toContain("linkedin");
});

test("footer renders nothing social when socials is null", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).not.toContain(`class="footer-social"`);
});

test("footer about uses aboutBlurb when set, else the default about copy", () => {
  const withBlurb = renderAgencySite({ ...agency, aboutBlurb: "Family-run since 1998." }, listings);
  expect(withBlurb).toContain("Family-run since 1998.");
  expect(renderAgencySite(agency, listings)).toContain(`data-i18n="about.body"`);
});

test("footer contact column renders phone/email/whatsapp/viber/address/map when set", () => {
  const html = renderAgencySite(
    {
      ...agency,
      phone: "+382 67 111 222",
      email: "hello@popovic.me",
      whatsapp: "+38267111222",
      viber: "+38267111222",
      address: "Bulevar 1\nPodgorica",
      mapUrl: "https://maps.example/popovic",
    },
    listings,
  );
  expect(html).toContain(`href="tel:+382 67 111 222"`);
  expect(html).toContain(`href="mailto:hello@popovic.me"`);
  expect(html).toContain("hello@popovic.me");
  expect(html).toContain("Bulevar 1");
  expect(html).toContain("https://maps.example/popovic");
  expect(html).toContain(`data-i18n="footer.contact"`);
});

test("footer contact escapes the address", () => {
  const html = renderAgencySite({ ...agency, address: "<b>x</b>" }, listings);
  expect(html).not.toContain("<b>x</b>");
});

test("footer looks fine for an unconfigured agency (no hours/socials/contact)", () => {
  const html = renderAgencySite(agency, listings);
  const start = html.indexOf('<footer class="site">');
  const footer = html.slice(start, html.indexOf("</footer>", start));
  // legal line + powered-by still present; optional columns omitted entirely
  expect(footer).toContain("Powered by Kluch");
  expect(footer).not.toContain("undefined");
  expect(footer).not.toContain("null");
  expect(footer).not.toContain(`class="footer-hours"`);
  expect(footer).not.toContain(`class="footer-contact"`);
  expect(footer).not.toContain(`class="footer-social"`);
});

test("nav has a mobile burger toggle", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain('id="navBurger"');
  expect(html).toContain('class="nav-links" id="navLinks"');
  expect(html).toContain(".nav-burger"); // CSS rule present
  // burger toggles the panel open
  expect(html).toContain('navLinks.classList.toggle("open")');
});

test("first-visit language picker modal is present with the four self-labelled options", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain('id="langModal"');
  // the four self-labelled language options
  expect(html).toContain("English");
  expect(html).toContain("Crnogorski / Srpski");
  expect(html).toContain("Русский");
  expect(html).toContain("Türkçe");
});

test("language modal visibility is server-controlled by showLangPicker", () => {
  expect(renderAgencySite(agency, listings, {}, { showLangPicker: true }))
    .toContain('id="langModal" class="lang-modal" style="display:flex"');
  expect(renderAgencySite(agency, listings, {}, { showLangPicker: false }))
    .toContain('id="langModal" class="lang-modal" style="display:none"');
  // default (no opts) hides the modal — the server only shows it when no cookie.
  expect(renderAgencySite(agency, listings))
    .toContain('id="langModal" class="lang-modal" style="display:none"');
});

test("setLang writes the kluche_lang cookie (so the server renders the choice next request)", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain('document.cookie = "kluche_lang=" + code');
  expect(html).toContain("samesite=lax");
});

test("server-side localization: lang=sr renders Serbian text + html lang + active SR pill", () => {
  const html = renderAgencySite(agency, listings, {}, { lang: "sr" });
  expect(html).toContain('<html lang="sr">');
  // nav / hero / footer in Serbian
  expect(html).toContain(">O nama<"); // nav.about
  expect(html).toContain(">Pronađite svoj savršen dom<"); // hero.title
  expect(html).toContain(">Pokreće Kluche<"); // footer.powered
  expect(html).toContain(">Dostupne nekretnine<"); // properties.heading
  // SR pill pre-marked active server-side
  expect(html).toContain('data-code="sr" class="active"');
});

test("default lang is English and emits <html lang=\"en\">", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain('<html lang="en">');
  expect(html).toContain('data-code="en" class="active"');
  expect(html).toContain(">Find Your Perfect Home<");
});

test("mobile viewport: dynamic-height fill + viewport-fit + theme-color (iOS Safari toolbar)", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("viewport-fit=cover");
  expect(html).toContain('name="theme-color"');
  expect(html).toContain("min-height: 100dvh");
  expect(html).toMatch(/html \{ background: var\(--color-cream\); min-height: 100%/);
});

test("nav + footer extend into the iOS safe-area insets (full-bleed top/bottom on Safari)", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("env(safe-area-inset-top");
  expect(html).toContain("env(safe-area-inset-bottom");
});

test("nav is collapsible on scroll (hide-on-down, show-on-up)", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("nav.site.nav-hidden");          // CSS rule
  expect(html).toContain('classList.add("nav-hidden")');  // scroll handler
  expect(html).toContain('classList.remove("nav-hidden")');
});

test("card has photo arrows when a listing has multiple photos, and gallery swipe wiring", () => {
  const multi: Property[] = [{ ...listings[0], photos: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"] }] as Property[];
  const html = renderAgencySite(agency, multi);
  expect(html).toContain('<button class="card-arrow card-arrow-prev"');
  expect(html).toContain('<button class="card-arrow card-arrow-next"');
  expect(html).toContain('class="card-media"');
  // touch-swipe handlers (modal + card)
  expect(html).toContain('addEventListener("touchend"');
  expect(html).toContain("galStep(");
});

test("card has no arrow buttons when a listing has a single photo", () => {
  const one: Property[] = [{ ...listings[0], photos: ["https://cdn.example/only.jpg"] }] as Property[];
  const html = renderAgencySite(agency, one);
  expect(html).not.toContain('<button class="card-arrow card-arrow-prev"');
});

// --- Map view (gated by mapEnabled) ----------------------------------------

const mapAgency: Agency = { ...agency, mapEnabled: true };

test("mapEnabled:false renders no map view, toggle or Leaflet includes", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).not.toContain('id="kluche-map"');
  expect(html).not.toContain('id="kluche-map-areas"');
  expect(html).not.toContain('data-i18n="view.map"');
  expect(html).not.toContain("leaflet@1.9.4");
});

test("mapEnabled:true renders the map (always shown), Leaflet includes and map containers", () => {
  const html = renderAgencySite(mapAgency, listings);
  // The List/Map toggle was removed — the map shows alongside the list.
  expect(html).not.toContain('id="view-list"');
  expect(html).toContain('id="kluche-map"');
  expect(html).toContain('id="kluche-map-canvas"');
  // area-region polygons were removed — no longer emitted
  expect(html).not.toContain('id="kluche-map-areas"');
  // Leaflet CSS + JS from unpkg
  expect(html).toContain("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
  expect(html).toContain("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
  // Carto Voyager basemap tiles
  expect(html).toContain("basemaps.cartocdn.com/rastertiles/voyager");
});

test("kluche-listings JSON carries numeric lat/lng for a known city and null for an unknown one", () => {
  // Podgorica is known (p2); "Atlantis" is unknown.
  const unknown: Property = { ...listings[0], id: "px", city: "Atlantis" } as Property;
  const html = renderAgencySite(mapAgency, [listings[1], unknown]);
  const m = html.match(/<script type="application\/json" id="kluche-listings">([\s\S]*?)<\/script>/);
  expect(m).toBeTruthy();
  const data = JSON.parse(m![1].replace(/\\u003c/g, "<"));
  const pg = data.find((d: { id: string }) => d.id === "p2");
  const atl = data.find((d: { id: string }) => d.id === "px");
  expect(typeof pg.lat).toBe("number");
  expect(typeof pg.lng).toBe("number");
  expect(Math.abs(pg.lat - 42.4411)).toBeLessThan(0.006);
  expect(atl.lat).toBeNull();
  expect(atl.lng).toBeNull();
});

test("listingPin is deterministic, within ~0.006° of the centre, and null for unknown cities", () => {
  const a = listingPin(listings[1]); // Podgorica
  const b = listingPin(listings[1]);
  expect(a).not.toBeNull();
  expect(a).toEqual(b); // same id → same coords
  expect(Math.abs(a!.lat - 42.4411)).toBeLessThan(0.006);
  expect(Math.abs(a!.lng - 19.2627)).toBeLessThan(0.006);
  expect(listingPin({ ...listings[0], city: "Atlantis" } as Property)).toBeNull();
});

test("listingPin uses the area centre when the listing has known area coords", () => {
  const blok5: Property = { ...listings[1], id: "pb", area: "Blok 5" } as unknown as Property;
  const pin = listingPin(blok5);
  expect(pin).not.toBeNull();
  // Blok 5 centre is 42.4378, 19.247 — offset, not the Podgorica centre.
  expect(Math.abs(pin!.lat - 42.4378)).toBeLessThan(0.006);
  expect(Math.abs(pin!.lng - 19.247)).toBeLessThan(0.006);
});

test("the inline <script> is syntactically valid JS (no template-literal escape breakage)", () => {
  const html = renderAgencySite(agency, listings);
  // The executable script has a bare <script> tag; the data blobs use type="application/json".
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  expect(m).toBeTruthy();
  const body = m![1];
  // new Function parses (doesn't run) the body — throws on any syntax error.
  expect(() => new Function(body)).not.toThrow();
});

test("the inline <script> stays valid JS with the map view enabled", () => {
  const html = renderAgencySite(mapAgency, listings);
  // Match the executable bare <script> (the map JS lives in the same block); the
  // leaflet include is <script src=...> so it won't match the bare-tag regex.
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(matches.length).toBeGreaterThan(0);
  for (const m of matches) {
    expect(() => new Function(m[1])).not.toThrow();
  }
});

test("modal sizes with dvh + safe-area padding so the ✕ isn't clipped on iOS Safari", () => {
  const html = renderAgencySite(agency, listings);
  expect(html).toContain("88dvh");
  expect(html).toMatch(/\.modal \{[^}]*env\(safe-area-inset-top/s);
});

test("when mapEnabled, the map is initialised on load (shown alongside the list)", () => {
  const mapAgency = { ...agency, mapEnabled: true } as typeof agency;
  const html = renderAgencySite(mapAgency, listings);
  // The map is always visible now; the script inits Leaflet on load.
  expect(html).toContain("initMap();");
  expect(html).toContain('class="search-section"');
});

// --- Map overlay city shortcuts --------------------------------------------

describe("map overlay city shortcuts", () => {
  const cityListings: Property[] = [
    { ...listings[0], id: "c1", city: "Podgorica" } as Property,
    { ...listings[0], id: "c2", city: "Budva" } as Property,
  ];

  test("emits a kluche-map-cities blob with known cities and numeric lat/lng/zoom", () => {
    const html = renderAgencySite(mapAgency, cityListings);
    expect(html).toContain('id="kluche-map-cities"');
    const m = html.match(/<script type="application\/json" id="kluche-map-cities">([\s\S]*?)<\/script>/);
    expect(m).toBeTruthy();
    const data = JSON.parse(m![1].replace(/\\u003c/g, "<"));
    expect(Array.isArray(data)).toBe(true);
    const pg = data.find((d: { name: string }) => d.name === "Podgorica");
    expect(pg).toBeTruthy();
    expect(typeof pg.lat).toBe("number");
    expect(typeof pg.lng).toBe("number");
    expect(typeof pg.zoom).toBe("number");
    expect(Math.abs(pg.lat - 42.44)).toBeLessThan(0.01);
  });

  test("is a fixed top-6-towns shortlist, independent of which cities have listings", () => {
    // Listings only in Kotor — shortcuts stay the curated 6 biggest towns.
    const kotorOnly: Property[] = [{ ...listings[0], id: "k1", city: "Kotor" } as Property];
    const html = renderAgencySite(mapAgency, kotorOnly);
    const m = html.match(/<script type="application\/json" id="kluche-map-cities">([\s\S]*?)<\/script>/);
    const data = JSON.parse(m![1].replace(/\\u003c/g, "<"));
    expect(data.map((d: { name: string }) => d.name)).toEqual(["Podgorica", "Nikšić", "Bar", "Herceg Novi", "Budva", "Cetinje", "Tivat"]);
  });

  test("emits no kluche-map-cities blob when mapEnabled is false", () => {
    const html = renderAgencySite(agency, cityListings);
    expect(html).not.toContain("kluche-map-cities");
  });
});


// --- Map overlay markup -----------------------------------------------------

describe("map overlay markup", () => {
  test("mapEnabled renders the overlay container, cities box and filters slot", () => {
    const html = renderAgencySite(mapAgency, listings);
    expect(html).toContain('class="map-overlay"');
    expect(html).toContain('id="map-overlay-cities"');
    expect(html).toContain('id="map-overlay-filters"');
  });

  test("renders the centre expand/collapse button", () => {
    const html = renderAgencySite(mapAgency, listings);
    expect(html).toContain('id="map-expand"');
    expect(html).toContain('class="ic-expand"');
    expect(html).toContain('class="ic-collapse"');
  });
});

// --- Map overlay: hero-form relocation + city flyTo -------------------------

describe("map overlay hero-form relocation + flyTo", () => {
  function executableScript(html: string): string {
    const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(matches.length).toBeGreaterThan(0);
    // The largest bare <script> body is the executable one (data blobs are JSON).
    return matches.map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
  }

  test("the inline <script> stays valid JS with the relocation logic", () => {
    const html = renderAgencySite(mapAgency, listings);
    const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    for (const m of matches) {
      expect(() => new Function(m[1])).not.toThrow();
    }
  });

  test("the map script references the cities blob, filters slot, hero-form and flyTo", () => {
    const html = renderAgencySite(mapAgency, listings);
    const body = executableScript(html);
    expect(body.includes("kluche-map-cities")).toBe(true);
    expect(body.includes("map-overlay-filters")).toBe(true);
    expect(body.includes("hero-form")).toBe(true);
    expect(body.includes("flyTo")).toBe(true);
  });
});
