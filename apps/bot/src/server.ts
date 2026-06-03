import { Hono } from "hono";
import { serve } from "@hono/node-server";

/** Minimal HTTP app: a health check now; the web/mobile API will grow here. */
export function createServer(): Hono {
  const app = new Hono();
  app.get("/health", (c) => c.text("ok"));
  return app;
}

export function startServer(port: number) {
  const app = createServer();
  return serve({ fetch: app.fetch, port });
}
