import { describe, expect, it } from "vitest";
import { DICT, LANGS, tr, isLang, type Lang } from "../i18n.js";

describe("tr()", () => {
  it("returns the translated value for a known locale + key", () => {
    expect(tr("sr", "nav.about")).toBe("O nama");
    expect(tr("ru", "nav.about")).toBe("О нас");
    expect(tr("tr", "nav.about")).toBe("Hakkımızda");
  });

  it("falls back to English for an unknown locale", () => {
    expect(tr("xx" as unknown as Lang, "nav.about")).toBe("About");
  });

  it("returns the key itself when it is unknown in every locale", () => {
    expect(tr("en", "totally.unknown.key")).toBe("totally.unknown.key");
    expect(tr("sr", "totally.unknown.key")).toBe("totally.unknown.key");
  });
});

describe("isLang()", () => {
  it("accepts the four supported languages", () => {
    expect(isLang("en")).toBe(true);
    expect(isLang("sr")).toBe(true);
    expect(isLang("ru")).toBe(true);
    expect(isLang("tr")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLang("xx")).toBe(false);
    expect(isLang("")).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe("DICT parity", () => {
  // Keys rendered into the page server-side: every locale must translate these
  // (EN is the canonical superset; some EN-only keys such as the tour/auth flow
  // are JS-only and intentionally fall back to English in other locales).
  const RENDERED_KEYS = [
    "nav.properties", "nav.about", "nav.contact",
    "filter.location", "filter.price", "filter.listing", "filter.beds", "filter.type",
    "opt.any", "tab.rent", "tab.sale", "tab.clear",
    "pager.prev", "pager.next",
    "card.forRent", "card.forSale", "card.perMonth", "card.priceOnRequest",
    "properties.heading", "properties.empty",
    "about.body",
    "contact.name", "contact.contact", "contact.message", "contact.submit", "contact.thankyou", "contact.heading",
    "hero.title",
    "footer.hours", "footer.openNow", "footer.closed", "footer.closedDay", "footer.contact", "footer.map", "footer.powered",
    "search.submit", "search.placeholder", "search.typeResidential", "search.typeLand", "search.typeCommercial",
    "loc.searchPh", "loc.clear", "loc.done",
    "beds.1plus", "beds.2plus", "beds.3plus", "beds.4plus",
    "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat", "day.sun",
  ];

  it("every locale translates each server-rendered key", () => {
    for (const { code } of LANGS) {
      for (const key of RENDERED_KEYS) {
        expect(DICT[code][key], `${code} missing ${key}`).toBeTruthy();
      }
    }
  });

  it("non-English locale keys all exist in English (no orphan keys beyond the known JS-only set)", () => {
    const enKeys = new Set(Object.keys(DICT.en));
    for (const { code } of LANGS) {
      for (const key of Object.keys(DICT[code])) {
        // sr/ru/tr add dealRent/dealSale variants not present in en; allow those.
        if (key === "search.dealRent" || key === "search.dealSale") continue;
        expect(enKeys.has(key), `${code} key ${key} missing from en`).toBe(true);
      }
    }
  });
});
