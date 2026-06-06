import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { FakeTranslator } from "../translate.js";
import { findOrCreateUser } from "../users.js";
import { logMessage } from "../messages.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("an incoming message is translated to English for the operator", async () => {
  const user = await findOrCreateUser(db, { telegramUserId: 20 });
  const tr = new FakeTranslator();
  const row = await logMessage(db, tr, {
    userId: user.id, direction: "in", text: "Imam pitanje", locale: "me",
  });
  expect(row.direction).toBe("in");
  expect(row.originalText).toBe("Imam pitanje");
  expect(row.translatedText).toBe("[EN] Imam pitanje");
  expect(tr.calls[0].to).toBe("EN");
});

test("an outgoing message is translated to the user's language", async () => {
  const user = await findOrCreateUser(db, { telegramUserId: 21 });
  const tr = new FakeTranslator();
  const row = await logMessage(db, tr, {
    userId: user.id, direction: "out", text: "Here is your answer", locale: "ru",
  });
  expect(row.translatedText).toBe("[RU] Here is your answer");
  expect(tr.calls[0].to).toBe("RU");
});

test("an English-language message is stored without a translation", async () => {
  const user = await findOrCreateUser(db, { telegramUserId: 22 });
  const tr = new FakeTranslator();
  const row = await logMessage(db, tr, {
    userId: user.id, direction: "in", text: "Hello", locale: "en",
  });
  expect(row.translatedText).toBeNull();
  expect(tr.calls).toHaveLength(0);
});
