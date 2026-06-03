import { createDb } from "@kluch/db";
import { createLease } from "@kluch/core";

/**
 * Seeds pilot properties + leases and prints their join codes.
 * Run: pnpm --filter @kluch/bot seed
 * Give each tenant their code to use with /join <code> (or a deep link).
 */
const { db, client } = createDb(process.env.DATABASE_URL);

const pilots = [
  { property: { name: "Apartment 4B", address: "Jadranski put 1", city: "Budva" }, rentMinor: 45000, dueDay: 5 },
  { property: { name: "Studio 2A", address: "Slovenska obala 10", city: "Budva" }, rentMinor: 38000, dueDay: 1 },
];

for (const p of pilots) {
  const { lease, property } = await createLease(db, p);
  console.log(`${property.name} (${property.city})  →  join code: ${lease.joinCode}`);
}

await client.end();
