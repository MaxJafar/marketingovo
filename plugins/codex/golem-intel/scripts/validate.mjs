import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(root, "../../..");
const manifest = JSON.parse(
  readFileSync(resolve(root, ".codex-plugin/plugin.json"), "utf8"),
);
const mcp = JSON.parse(readFileSync(resolve(root, ".mcp.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const contractSource = readFileSync(
  resolve(workspaceRoot, "packages/contracts/src/agent-tools.ts"),
  "utf8",
);
const skill = readFileSync(
  resolve(root, "skills/intelligence-researcher/SKILL.md"),
  "utf8",
);
const bundlePath = resolve(root, "dist/golem-intel-mcp.mjs");
const expectedTools = [
  "golem_intel_research_start",
  "golem_intel_compare_start",
  "golem_intel_run_get",
  "golem_intel_search",
  "golem_intel_entity_get",
  "golem_intel_monitoring_status",
];

if (manifest.name !== "golem-intel") throw new Error("Codex plugin name drifted");
if (manifest.version !== packageJson.version) throw new Error("Version drifted");
if (!manifest.skills || !manifest.mcpServers) throw new Error("Skill or MCP missing");
const server = mcp.mcpServers?.["golem-intel"];
if (
  server?.command !== "node" ||
  JSON.stringify(server.args) !== JSON.stringify(["./dist/golem-intel-mcp.mjs"]) ||
  server.cwd !== "."
) {
  throw new Error("Codex MCP entry is invalid");
}
for (const toolName of expectedTools) {
  if (!contractSource.includes(`name: "${toolName}"`)) {
    throw new Error(`Contract does not define ${toolName}`);
  }
  if (!skill.includes(`\`${toolName}\``)) {
    throw new Error(`Skill does not document ${toolName}`);
  }
}
if (!existsSync(bundlePath)) throw new Error("Bundled MCP bridge is missing");
const bundle = readFileSync(bundlePath, "utf8");
if (!bundle.startsWith("#!/usr/bin/env node\n")) {
  throw new Error("Bundled MCP bridge needs one leading Node shebang");
}
execFileSync(process.execPath, ["--check", bundlePath], { stdio: "pipe" });

