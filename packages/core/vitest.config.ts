import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The complete monorepo gate runs many CPU- and I/O-heavy suites in
    // parallel. Keep a finite, CI-safe deadline without making valid module
    // discovery and real-browser dependency checks fail at Vitest's 5s
    // default while the machine is saturated.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: 2,
    // `node:sqlite` is a built-in module. Forks pool spawns a real
    // Node process that can resolve built-ins without Vite's
    // transform pipeline getting in the way.
    pool: "forks",
    server: {
      deps: {
        external: ["node:sqlite"],
      },
    },
  },
});
