import { eq } from "drizzle-orm";
import { partnerUsers, type Database } from "@kluche/db";
import { hashPassword, verifyPassword } from "./auth.js";

export type PartnerUser = typeof partnerUsers.$inferSelect;

/** Maps a dashboard key ("agency" | "law") to its metadata, e.g. { agency: { agencyId } }. */
export type DashboardMap = Record<string, Record<string, string>>;

/** Returns the dashboard keys a partner user has access to. */
export function dashboardKeys(dashboards: DashboardMap): string[] {
  return Object.keys(dashboards);
}

export async function createPartnerUser(
  db: Database,
  input: { email: string; name?: string; password?: string; dashboards: DashboardMap },
): Promise<PartnerUser> {
  const [user] = await db.insert(partnerUsers)
    .values({
      email: input.email.toLowerCase().trim(),
      name: input.name,
      passwordHash: input.password ? hashPassword(input.password) : undefined,
      dashboards: input.dashboards,
    })
    .returning();
  return user;
}

export async function getPartnerUserById(db: Database, id: string): Promise<PartnerUser | null> {
  const [user] = await db.select().from(partnerUsers).where(eq(partnerUsers.id, id));
  return user ?? null;
}

/** Looks up a partner user by email and verifies the password. Returns the user or null. */
export async function verifyPartnerUser(
  db: Database,
  email: string,
  password: string,
): Promise<PartnerUser | null> {
  const [user] = await db.select().from(partnerUsers)
    .where(eq(partnerUsers.email, email.toLowerCase().trim()));
  if (!user || !user.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}
