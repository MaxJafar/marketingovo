import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
assert.equal(codex.license, "Apache-2.0");
assert.equal(codex.skills, "./skills/");

const mcp = JSON.parse(
  await readFile(resolve(root, "plugins/codex/agentseo/.mcp.json"), "utf8"),
);
assert.ok(
  mcp.mcpServers?.agentseo,
  "Codex bundle must register its bundled MCP bridge",
);
// Every agent host must expose the same tool surface. A host that drifts, or a
// host that is missing entirely, fails here rather than at install time.
const claude = JSON.parse(
  await readFile(
    resolve(root, "plugins/claude/agentseo/.claude-plugin/plugin.json"),
    "utf8",
  ),
);
assert.equal(claude.name, "agentseo");
assert.equal(claude.license, "Apache-2.0");
assert.equal(claude.skills, "./skills/");
assert.equal(claude.commands, "./commands/");
assert.equal(claude.mcpServers, "./.mcp.json");

const marketplace = JSON.parse(
  await readFile(resolve(root, ".claude-plugin/marketplace.json"), "utf8"),
);
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].source, "./plugins/claude/agentseo");
assert.equal(marketplace.plugins[0].license, "Apache-2.0");

// Each generated slash command must reference a tool that actually exists.
const commandsDir = resolve(root, "plugins/claude/agentseo/commands");
const commandFiles = (await readdir(commandsDir)).filter((name) =>
  name.endsWith(".md"),
);
assert.ok(commandFiles.length >= 5, "expected a command per public workflow");
const referenced = new Set();
for (const file of commandFiles) {
  const body = await readFile(resolve(commandsDir, file), "utf8");
  assert.match(body, /^---\ndescription: .+\n---\n/u);
  for (const [, name] of body.matchAll(/`(agentseo_[a-z_]+)`/gu)) {
    assert.ok(
      expectedTools.includes(name),
      `${file} references unknown tool ${name}`,
    );
    referenced.add(name);
  }
}
// Every start-shaped tool needs a way in; the read tools are reachable from them.
for (const name of expectedTools) {
  if (name === "agentseo_run_get") continue;
  assert.ok(referenced.has(name), `no slash command reaches ${name}`);
}

// The shared skill is the single source; each host copy must match it byte for byte.
const sharedSkill = await readFile(
  resolve(root, "plugins/shared/skills/seo-marketer/SKILL.md"),
  "utf8",
);
for (const host of ["plugins/claude/agentseo", "plugins/codex/agentseo"]) {
  const copy = await readFile(
    resolve(root, host, "skills/seo-marketer/SKILL.md"),
    "utf8",
  );
  assert.equal(
    copy,
    sharedSkill,
    `${host} skill copy drifted from the shared source`,
  );
}
for (const toolName of expectedTools) {
  assert.ok(
    sharedSkill.includes(`\`${toolName}\``),
    `shared skill does not document ${toolName}`,
  );
}

// Plain-MCP editor configs.
for (const file of [
  "integrations/cursor.mcp.json",
  "integrations/claude-code.mcp.json",
  "integrations/generic.mcp.json",
]) {
  const config = JSON.parse(await readFile(resolve(root, file), "utf8"));
  assert.ok(
    config.mcpServers?.agentseo?.command,
    `${file} has no server command`,
  );
  assert.ok(
    !JSON.stringify(config).includes("/absolute/path/to/"),
    `${file} still contains a placeholder path`,
  );
}
const vscode = JSON.parse(
  await readFile(resolve(root, "integrations/vscode.mcp.json"), "utf8"),
);
assert.equal(vscode.servers?.agentseo?.type, "stdio");

process.stdout.write(
  `Validated Claude Code, Codex, OpenClaw and plain-MCP surfaces against the ${expectedTools.length}-tool registry.\n`,
);
