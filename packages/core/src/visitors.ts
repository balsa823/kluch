import { eq } from "drizzle-orm";
import { visitors, type Database } from "@kluche/db";
import { hashPassword, verifyPassword } from "./auth.js";

export type Visitor = typeof visitors.$inferSelect;

export async function createVisitor(
  db: Database,
  input: { email: string; name?: string; password?: string },
): Promise<Visitor> {
  const [visitor] = await db.insert(visitors)
    .values({
      email: input.email.toLowerCase().trim(),
      name: input.name,
      passwordHash: input.password ? hashPassword(input.password) : undefined,
    })
    .returning();
  return visitor;
}

/** Looks up a visitor by email and verifies the password. Returns the visitor or null. */
export async function verifyVisitor(
  db: Database,
  email: string,
  password: string,
): Promise<Visitor | null> {
  const [visitor] = await db.select().from(visitors)
    .where(eq(visitors.email, email.toLowerCase().trim()));
  if (!visitor || !visitor.passwordHash) return null;
  if (!verifyPassword(password, visitor.passwordHash)) return null;
  return visitor;
}

export async function getVisitorById(db: Database, id: string): Promise<Visitor | null> {
  const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id));
  return visitor ?? null;
}
