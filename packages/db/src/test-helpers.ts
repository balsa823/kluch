import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { createDb } from "./client.js";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://kluch:kluch@localhost:5433/kluch_test";
export const { db, client } = createDb(url);

export async function migrateTestDb() {
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
}

export async function resetDb() {
  await db.execute(sql`
    TRUNCATE messages, tickets, payments, leases, properties, users RESTART IDENTITY CASCADE;
  `);
}
