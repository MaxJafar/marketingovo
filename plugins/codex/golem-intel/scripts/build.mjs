import { build } from "esbuild";
import { resolve } from "node:path";

const pluginRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(pluginRoot, "../../..");
await build({
  entryPoints: [resolve(workspaceRoot, "packages/mcp/dist/stdio.js")],
  outfile: resolve(pluginRoot, "dist/golem-intel-mcp.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "eof",
  sourcemap: false,
});

