import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db, client, migrateTestDb, resetDb } from "@kluch/db/test-helpers";
import { users } from "@kluch/db";
import { findOrCreateUser, setUserLocale } from "../users.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("creates a new user with default locale en", async () => {
  const u = await findOrCreateUser(db, { telegramUserId: 555, fullName: "Marko" });
  expect(u.telegramUserId).toBe(555);
  expect(u.locale).toBe("en");
});

test("is idempotent — same telegram id returns the same row, no duplicate", async () => {
  const a = await findOrCreateUser(db, { telegramUserId: 777 });
  const b = await findOrCreateUser(db, { telegramUserId: 777, fullName: "Later" });
  expect(b.id).toBe(a.id);
  const all = await db.select().from(users).where(eq(users.telegramUserId, 777));
  expect(all).toHaveLength(1);
});

test("setUserLocale updates the locale", async () => {
  const u = await findOrCreateUser(db, { telegramUserId: 999 });
  const updated = await setUserLocale(db, u.id, "ru");
  expect(updated.locale).toBe("ru");
});
