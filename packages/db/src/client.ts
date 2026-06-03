import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = postgres(connectionString);
  return { db: drizzle(client, { schema }), client };
}

export type Database = ReturnType<typeof createDb>["db"];
