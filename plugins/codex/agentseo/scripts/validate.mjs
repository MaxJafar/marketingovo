import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(root, "../../..");
const { PUBLIC_AGENT_TOOL_NAMES } = await import(
  pathToFileURL(
    resolve(workspaceRoot, "packages/contracts/dist/agent-tools.js"),
  ).href
);
const manifest = JSON.parse(
  readFileSync(resolve(root, ".codex-plugin/plugin.json"), "utf8"),
);
const mcp = JSON.parse(readFileSync(resolve(root, ".mcp.json"), "utf8"));
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const bundlePath = resolve(root, "dist/agentseo-mcp.mjs");
const skillPath = resolve(root, "skills/seo-marketer/SKILL.md");
const expectedTools = [...PUBLIC_AGENT_TOOL_NAMES];

if (manifest.name !== "agentseo")
  throw new Error("Codex plugin name must match its directory");
if (manifest.version !== packageJson.version)
  throw new Error("Codex manifest and package versions differ");
if (!manifest.skills || !manifest.mcpServers)
  throw new Error("Codex plugin must declare skills and MCP");
const server = mcp.mcpServers?.agentseo;
if (
  !server ||
  server.command !== "node" ||
  JSON.stringify(server.args) !== JSON.stringify(["./dist/agentseo-mcp.mjs"]) ||
  server.cwd !== "."
) {
  throw new Error(
    "Codex MCP server entry does not point to the bundled stdio bridge",
  );
}
if (!existsSync(bundlePath)) throw new Error("Bundled MCP bridge is missing");
if (!existsSync(skillPath)) throw new Error("SEO marketer skill is missing");
const bundle = readFileSync(bundlePath, "utf8");
const shebangCount = bundle
  .split("\n")
  .filter((line) => line.startsWith("#!")).length;
if (!bundle.startsWith("#!/usr/bin/env node\n") || shebangCount !== 1)
  throw new Error(
    "Bundled MCP bridge must contain exactly one leading Node shebang",
  );
execFileSync(process.execPath, ["--check", bundlePath], { stdio: "pipe" });
const bundledToolNames = [
  ...new Set(
    [...bundle.matchAll(/"(golem_seo_[a-z_]+)"/g)].map((match) => match[1]),
  ),
].sort();
if (
  JSON.stringify(bundledToolNames) !== JSON.stringify([...expectedTools].sort())
) {
  throw new Error("Bundled MCP public tool contract drifted");
}

const skill = readFileSync(skillPath, "utf8");
for (const toolName of expectedTools) {
  if (!skill.includes(`\`${toolName}\``))
    throw new Error(`SEO marketer skill does not document ${toolName}`);
}
