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
assert.equal(openClaw.id, "agentseo");
assert.deepEqual(openClaw.contracts?.tools, expectedTools);

const codex = JSON.parse(
  await readFile(
    resolve(root, "plugins/codex/agentseo/.codex-plugin/plugin.json"),
    "utf8",
  ),
);
assert.equal(codex.name, "agentseo");
assert.equal(codex.license, "Elastic-2.0");
assert.equal(codex.skills, "./skills/");

const mcp = JSON.parse(
  await readFile(resolve(root, "plugins/codex/agentseo/.mcp.json"), "utf8"),
);
assert.ok(
  mcp.mcpServers?.agentseo,
  "Codex bundle must register its bundled MCP bridge",
);
const legacyCodex = JSON.parse(
  await readFile(
    resolve(root, "plugins/codex/golem-seo/.codex-plugin/plugin.json"),
    "utf8",
  ),
);
assert.equal(legacyCodex.name, "golem-seo");
assert.equal(legacyCodex.interface?.deprecated, true);
process.stdout.write(
  "Validated canonical Codex/OpenClaw manifests, the deprecated Codex alias, and the exact six-tool public surface.\n",
);
