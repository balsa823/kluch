import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db, client, migrateTestDb, resetDb } from "../test-helpers.js";
import { users } from "../schema.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("can insert and read a user with a default locale", async () => {
  await db.insert(users).values({ telegramUserId: 111, fullName: "Ana" });
  const [row] = await db.select().from(users).where(eq(users.telegramUserId, 111));
  expect(row.fullName).toBe("Ana");
  expect(row.locale).toBe("en");
  expect(row.role).toBe("occupant");
});
