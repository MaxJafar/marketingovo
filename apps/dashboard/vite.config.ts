import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The console footer prints the running version. Reading it from package.json
// at build time keeps it honest: a hardcoded string silently claims the wrong
// release for as long as nobody notices it.
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3210";
  const apiOrigin = new URL(apiTarget).origin;

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    server: {
      host: "127.0.0.1",
      port: 4318,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          headers: {
            Origin: apiOrigin,
          },
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4318,
      strictPort: true,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/tests/setup.ts",
      css: true,
      // The monorepo gate also runs durable SQLite and browser-backed suites.
      // Keep UI tests bounded and give real user-event workflows a finite,
      // CI-safe deadline instead of Vitest's tight 5 second default.
      maxWorkers: 2,
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  };
});
