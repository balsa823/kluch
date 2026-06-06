import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { agencyUsers, type Database } from "@kluche/db";
import type { AgencyUser } from "./agencyUsers.js";

const KEY_LEN = 64;

/** Hashes a password with scrypt. Returns "<saltHex>:<hashHex>". */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Verifies a password against a stored "<saltHex>:<hashHex>" value. False on any malformation. */
export function verifyPassword(pw: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== KEY_LEN) return false;
    const actual = scryptSync(pw, salt, KEY_LEN);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Looks up an agency user by email and verifies the password. Returns the user or null. */
export async function verifyAgencyUser(
  db: Database,
  email: string,
  password: string,
): Promise<AgencyUser | null> {
  const [user] = await db.select().from(agencyUsers)
    .where(eq(agencyUsers.email, email.toLowerCase().trim()));
  if (!user || !user.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export async function getAgencyUserById(db: Database, id: string): Promise<AgencyUser | null> {
  const [user] = await db.select().from(agencyUsers).where(eq(agencyUsers.id, id));
  return user ?? null;
}
