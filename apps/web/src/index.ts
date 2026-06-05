import { serve } from "@hono/node-server";
import { createDb } from "@kluch/db";
import { LocalDiskStorage } from "@kluch/core";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const { db, client } = createDb(config.databaseUrl);

const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const uploadDir = process.env.UPLOAD_DIR ?? "./data/uploads";
const storage = new LocalDiskStorage(uploadDir, "/uploads");

const app = createApp(db, {
  baseDomain: config.baseDomain,
  storage,
  sessionSecret,
  uploadDir,
});

const server = serve({ fetch: app.fetch, port: config.port });
console.log(`web server listening on :${config.port} (base domain: ${config.baseDomain})`);

async function shutdown() {
  server.close();
  await client.end();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
