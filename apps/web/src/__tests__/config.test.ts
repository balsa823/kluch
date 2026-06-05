import { expect, test } from "vitest";
import { loadConfig } from "../config.js";

test("defaults PORT to 8080 when unset", () => {
  const cfg = loadConfig({ DATABASE_URL: "postgres://x" });
  expect(cfg.port).toBe(8080);
});

test("parses a numeric PORT", () => {
  const cfg = loadConfig({ DATABASE_URL: "postgres://x", PORT: "3000" });
  expect(cfg.port).toBe(3000);
});

test("throws on a non-numeric PORT", () => {
  expect(() => loadConfig({ DATABASE_URL: "postgres://x", PORT: "notaport" })).toThrow();
});
