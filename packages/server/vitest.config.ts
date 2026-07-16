import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Server integration tests exercise the durable scheduler, SQLite and
    // report generation. The full monorepo gate can saturate the machine, so
    // use a bounded CI deadline instead of Vitest's overly tight 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: 2,
  },
});
