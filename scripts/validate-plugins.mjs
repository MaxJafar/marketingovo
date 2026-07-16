import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const { PUBLIC_AGENT_TOOL_CONTRACTS, PUBLIC_AGENT_TOOL_NAMES } = await import(
  pathToFileURL(resolve(root, "packages/contracts/dist/agent-tools.js")).href
);
const expectedTools = [...PUBLIC_AGENT_TOOL_NAMES];

assert.equal(PUBLIC_AGENT_TOOL_CONTRACTS.length, 6);
assert.equal(new Set(expectedTools).size, expectedTools.length);
for (const contract of PUBLIC_AGENT_TOOL_CONTRACTS) {
  assert.equal(contract.inputSchema.type, "object");
  assert.equal(contract.inputSchema.additionalProperties, false);
}

const openClaw = JSON.parse(
  await readFile(
    resolve(root, "adapters/openclaw/openclaw.plugin.json"),
    "utf8",
  ),
);
assert.equal(openClaw.id, "golem-seo");
assert.deepEqual(openClaw.contracts?.tools, expectedTools);

const codex = JSON.parse(
  await readFile(
    resolve(root, "plugins/codex/golem-seo/.codex-plugin/plugin.json"),
    "utf8",
  ),
);
assert.equal(codex.name, "golem-seo");
assert.equal(codex.license, "Elastic-2.0");
assert.equal(codex.skills, "./skills/");

const mcp = JSON.parse(
  await readFile(resolve(root, "plugins/codex/golem-seo/.mcp.json"), "utf8"),
);
assert.ok(
  mcp.mcpServers?.["golem-seo"],
  "Codex bundle must register its bundled MCP bridge",
);
process.stdout.write(
  "Validated Codex and OpenClaw manifests and the exact six-tool public surface.\n",
);
