// Onboard a new agency + its first admin user.
// Usage: tsx src/create-agency.ts "<Agency Name>" <admin-email> [password]
//   DATABASE_URL must point at the target DB.
import { randomBytes } from "node:crypto";
import { createDb } from "@kluch/db";
import { createAgency, createAgencyUser } from "@kluch/core";

const [name, email, pwArg] = process.argv.slice(2);
if (!name || !email) {
  console.error('Usage: tsx src/create-agency.ts "<Agency Name>" <admin-email> [password]');
  process.exit(1);
}

const { db, client } = createDb(process.env.DATABASE_URL);
const password = pwArg ?? randomBytes(12).toString("base64url"); // strong random

try {
  const agency = await createAgency(db, { name });
  await createAgencyUser(db, {
    agencyId: agency.id,
    email,
    name: email.split("@")[0],
    role: "admin",
    password,
  });
  console.log(`Created agency "${agency.name}" (slug: ${agency.slug})`);
  console.log("Admin login:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  console:  http://localhost:8082/login`);
  console.log(`  site:     http://${agency.slug}.localhost:8080`);
} catch (e) {
  console.error("Failed:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
