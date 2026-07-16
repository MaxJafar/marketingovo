import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Runtime tests exercise encrypted credentials, SQLite, backup/restore,
    // scheduler recovery and complete audit workflows. Bound parallelism so
    // those checks remain deterministic on smaller CI runners.
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
