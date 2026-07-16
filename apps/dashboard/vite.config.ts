import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3210";
  const apiOrigin = new URL(apiTarget).origin;

  return {
    plugins: [react()],
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
