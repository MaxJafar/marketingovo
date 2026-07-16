import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(root, "../..");
const { PUBLIC_AGENT_TOOL_CONTRACTS, PUBLIC_AGENT_TOOL_NAMES } = await import(
  pathToFileURL(
    resolve(repositoryRoot, "packages/contracts/dist/agent-tools.js"),
  ).href
);
const manifest = JSON.parse(
  readFileSync(resolve(root, "openclaw.plugin.json"), "utf8"),
);
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const source = readFileSync(resolve(root, "src/index.ts"), "utf8");
const runtimePath = resolve(root, "dist/index.js");
const expected = [...PUBLIC_AGENT_TOOL_NAMES];
const expectedOptional = PUBLIC_AGENT_TOOL_CONTRACTS.filter(
  (contract) => contract.optional,
).map((contract) => contract.name);

if (manifest.id !== "golem-seo")
  throw new Error("OpenClaw manifest id is invalid");
if (manifest.version !== packageJson.version)
  throw new Error("OpenClaw manifest and package versions differ");
if (JSON.stringify(manifest.contracts?.tools) !== JSON.stringify(expected))
  throw new Error("OpenClaw public tool contract drifted");
if (
  !manifest.configSchema ||
  manifest.configSchema.type !== "object" ||
  manifest.configSchema.additionalProperties !== false
) {
  throw new Error("OpenClaw config schema must be a strict object");
}
const optionalTools = Object.entries(manifest.toolMetadata ?? {})
  .filter(([, metadata]) => metadata?.optional === true)
  .map(([name]) => name);
if (JSON.stringify(optionalTools) !== JSON.stringify(expectedOptional))
  throw new Error("OpenClaw optional tool metadata drifted");

if (!source.includes('from "@golem-seo/contracts/agent-tools"'))
  throw new Error("OpenClaw must project the canonical agent tool contracts");

if (!existsSync(runtimePath))
  throw new Error("OpenClaw runtime build is missing");
if (!packageJson.openclaw?.extensions?.includes("./dist/index.js"))
  throw new Error("OpenClaw runtime entry is not declared");
if (
  !packageJson.files?.includes("dist") ||
  !packageJson.files?.includes("openclaw.plugin.json")
)
  throw new Error("OpenClaw package files omit runtime metadata");
if (
  !packageJson.dependencies?.["@golem-seo/contracts"] ||
  !packageJson.dependencies?.typebox ||
  !packageJson.peerDependencies?.openclaw
)
  throw new Error("OpenClaw runtime dependencies are incomplete");

execFileSync(process.execPath, ["--check", runtimePath], { stdio: "pipe" });
const runtime = readFileSync(runtimePath, "utf8");
for (const toolName of expected) {
  if (!runtime.includes(`"${toolName}"`))
    throw new Error(`OpenClaw runtime is missing ${toolName}`);
}
if (!runtime.includes(`description: "${manifest.description}"`))
  throw new Error("OpenClaw runtime and manifest descriptions differ");
if (
  !runtime.includes('from "openclaw/plugin-sdk/tool-plugin"') ||
  !runtime.includes('from "typebox"')
) {
  throw new Error(
    "OpenClaw runtime imports do not match the supported tool-plugin entry point",
  );
}
