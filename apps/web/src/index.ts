import { serve } from "@hono/node-server";
import { createDb } from "@kluche/db";
import { AzureBlobStorage, LocalDiskStorage, type Storage } from "@kluche/core";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const { db, client } = createDb(config.databaseUrl);

const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const uploadDir = process.env.UPLOAD_DIR ?? "./data/uploads";
// Azure Blob in prod (when AZURE_STORAGE_ACCOUNT is set), local disk otherwise.
const storage: Storage = process.env.AZURE_STORAGE_ACCOUNT
  ? new AzureBlobStorage()
  : new LocalDiskStorage(uploadDir, "/uploads");

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
