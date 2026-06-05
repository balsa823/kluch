import { serve } from "@hono/node-server";
import { createDb } from "@kluch/db";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const { db, client } = createDb(config.databaseUrl);
const app = createApp(db, config.baseDomain);

const server = serve({ fetch: app.fetch, port: config.port });
console.log(`web server listening on :${config.port} (base domain: ${config.baseDomain})`);

async function shutdown() {
  server.close();
  await client.end();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
