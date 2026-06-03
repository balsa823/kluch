import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const { db, client } = createDb(url);
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await client.end();
console.log("migrations applied");
