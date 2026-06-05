import { expect, test } from "vitest";
import { loadConfig } from "../config.js";

const valid = {
  BOT_TOKEN: "123:ABC",
  DATABASE_URL: "postgres://x",
  OPERATOR_CHAT_ID: "-1001234567890",
  DEEPL_API_KEY: "deepl-key",
};

test("returns a typed config from a valid env", () => {
  const cfg = loadConfig(valid);
  expect(cfg.botToken).toBe("123:ABC");
  expect(cfg.operatorChatId).toBe(-1001234567890);
  expect(cfg.deeplApiUrl).toContain("deepl.com");
  expect(cfg.port).toBe(8080);
});

test("throws a clear error naming a missing required key", () => {
  const { BOT_TOKEN, ...withoutToken } = valid;
  expect(() => loadConfig(withoutToken)).toThrow(/BOT_TOKEN/);
});

test("throws when OPERATOR_CHAT_ID is not a number", () => {
  expect(() => loadConfig({ ...valid, OPERATOR_CHAT_ID: "not-a-number" })).toThrow(/OPERATOR_CHAT_ID/);
});
