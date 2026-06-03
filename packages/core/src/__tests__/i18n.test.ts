import { expect, test } from "vitest";
import { t, type Locale } from "../i18n.js";

test("returns the string for the given locale", () => {
  expect(t("en", "welcome")).toContain("Kluch");
  expect(t("ru", "welcome")).not.toEqual(t("en", "welcome"));
});

test("interpolates params", () => {
  expect(t("en", "ticketCreated", { id: 142 })).toContain("142");
});

test("falls back to English for a missing translation", () => {
  expect(() => t("me" as Locale, "welcome")).not.toThrow();
});
