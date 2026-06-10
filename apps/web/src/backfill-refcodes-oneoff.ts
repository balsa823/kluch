import { createDb } from "@kluche/db";
import { backfillRefCodes } from "@kluche/core";
import { loadConfig } from "./config.js";

/**
 * One-off: assign per-agency sequential reference codes (e.g. ST-0001) to every
 * existing listing that doesn't have one yet, and set each agency's ref prefix.
 * Idempotent — re-running assigns nothing new. Run against the prod DB:
 *
 *   DATABASE_URL='<prod>' pnpm --filter @kluche/web exec tsx src/backfill-refcodes-oneoff.ts
 */
const { db, client } = createDb(loadConfig().databaseUrl);

try {
  const result = await backfillRefCodes(db);
  console.log(`backfill complete: ${result.assigned} codes assigned across ${result.agencies} agencies`);
} finally {
  await client.end();
}
