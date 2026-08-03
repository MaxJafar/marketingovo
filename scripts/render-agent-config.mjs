import { resolve } from "node:path";

const target = process.argv[2];
const supported = new Set(["claude-code", "cursor", "antigravity"]);
if (!target || !supported.has(target)) {
  process.stderr.write(
    "Usage: node scripts/render-agent-config.mjs <claude-code|cursor|antigravity>\n",
  );
  process.exitCode = 2;
} else {
  const root = resolve(import.meta.dirname, "..");
  const config = {
    mcpServers: {
      marketingovo: {
        command: "node",
        args: [resolve(root, "packages/mcp/dist/stdio.js")],
        env: { MARKETINGOVO_API_URL: "http://127.0.0.1:3210/api/v1" },
      },
    },
  };
  process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
}
