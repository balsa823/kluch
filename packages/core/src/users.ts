import { eq } from "drizzle-orm";
import { users, type Database } from "@kluche/db";
import type { Locale } from "./i18n.js";

export async function findOrCreateUser(
  db: Database,
  input: { telegramUserId: number; username?: string; fullName?: string },
) {
  const [existing] = await db.select().from(users).where(eq(users.telegramUserId, input.telegramUserId));
  if (existing) return existing;
  const [created] = await db.insert(users).values({
    telegramUserId: input.telegramUserId,
    telegramUsername: input.username,
    fullName: input.fullName,
  }).returning();
  return created;
}

export async function setUserLocale(db: Database, userId: string, locale: Locale) {
  const [row] = await db.update(users).set({ locale }).where(eq(users.id, userId)).returning();
  return row;
}

export async function getUserById(db: Database, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return row ?? null;
}
