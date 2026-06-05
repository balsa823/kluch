import { eq } from "drizzle-orm";
import { agencyUsers, type Database } from "@kluch/db";

export type AgencyUser = typeof agencyUsers.$inferSelect;
export type AgencyRole = AgencyUser["role"];

export async function createAgencyUser(
  db: Database,
  input: { agencyId: string; email: string; name?: string; role?: AgencyRole },
): Promise<AgencyUser> {
  const [user] = await db.insert(agencyUsers)
    .values({
      agencyId: input.agencyId,
      email: input.email.toLowerCase().trim(),
      name: input.name,
      role: input.role ?? "agent",
    })
    .returning();
  return user;
}

export async function listAgencyUsers(db: Database, agencyId: string): Promise<AgencyUser[]> {
  return db.select().from(agencyUsers).where(eq(agencyUsers.agencyId, agencyId));
}
