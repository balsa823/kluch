import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db, client, migrateTestDb, resetDb } from "../test-helpers.js";
import { agencies, agencyUsers, properties } from "../schema.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("can insert and read an agency, agency user, and property", async () => {
  const [agency] = await db.insert(agencies)
    .values({ name: "Adriatic Homes", slug: "adriatic-homes" })
    .returning();
  expect(agency.slug).toBe("adriatic-homes");
  expect(agency.colorPrimary).toBe("#1F3A5C");
  expect(agency.colorAccent).toBe("#4E827A");

  await db.insert(agencyUsers)
    .values({ agencyId: agency.id, email: "agent@adriatic.me" });
  const [user] = await db.select().from(agencyUsers)
    .where(eq(agencyUsers.email, "agent@adriatic.me"));
  expect(user.agencyId).toBe(agency.id);
  expect(user.role).toBe("agent");

  await db.insert(properties).values({
    name: "Seaside Studio",
    address: "Obala 1",
    city: "Budva",
    agencyId: agency.id,
  });
  const [property] = await db.select().from(properties)
    .where(eq(properties.name, "Seaside Studio"));
  expect(property.agencyId).toBe(agency.id);
  expect(property.status).toBe("draft");
  expect(property.photos).toEqual([]);
});
