import { defineConfig } from "vitest/config";

export default defineConfig({
  // DB-backed tests share one Postgres; run files sequentially so one file's
  // beforeEach TRUNCATE can't wipe another file's data mid-test.
  test: { include: ["src/**/*.test.ts"], hookTimeout: 30000, fileParallelism: false },
});
