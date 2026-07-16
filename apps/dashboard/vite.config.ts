import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 7466,
    strictPort: true,
    proxy: {
      "/v1": "http://127.0.0.1:7465",
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://127.0.0.1:7466/" },
    },
    setupFiles: ["./src/tests/setup.ts"],
  },
});
