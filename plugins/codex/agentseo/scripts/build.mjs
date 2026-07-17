import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(pluginRoot, "../../..");
await build({
  entryPoints: [resolve(workspaceRoot, "packages/mcp/dist/stdio.js")],
  outfile: resolve(pluginRoot, "dist/agentseo-mcp.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "eof",
  sourcemap: false,
});
