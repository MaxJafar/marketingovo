// Generates every agent-host surface from one source of truth.
//
// The tool registry in @agentseoapp/contracts is authoritative. Host manifests
// (Claude Code, Codex, Cursor, generic MCP) and the plugin marketplace entry are
// derived from it, never hand-maintained, so a tool cannot be added or renamed
// in one host and forgotten in another. `validate:plugins` re-derives the same
// files and fails on any drift.
//
// Run with --check to verify without writing.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");

const { PUBLIC_AGENT_TOOL_CONTRACTS } = await import(
  pathToFileURL(resolve(root, "packages/contracts/dist/agent-tools.js")).href
);

const rootManifest = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const version = JSON.parse(
  await readFile(resolve(root, "plugins/codex/agentseo/package.json"), "utf8"),
).version;

const AUTHOR = { name: "AGENTseo", url: "https://golemworkers.com" };
const REPOSITORY = "https://github.com/GolemWorkers/agentseo";
const DESCRIPTION =
  "Turn local crawl, Search Console, GA4, performance, and SERP evidence into prioritized SEO actions.";

const readOnly = (contract) => contract.annotations?.readOnlyHint === true;

// ---------------------------------------------------------------------------
// Slash commands, one per start-shaped workflow plus the two read tools.
// ---------------------------------------------------------------------------

const COMMANDS = [
  {
    file: "seo-audit.md",
    description: "Audit a project and rank the actions that matter most.",
    tool: "agentseo_audit_start",
    body: `Run an AGENTseo audit and report prioritized, evidence-backed actions.

1. Call \`agentseo_audit_start\` for the project named in $ARGUMENTS (ask which
   project if it is ambiguous — never guess).
2. Poll \`agentseo_run_get\` until the run leaves the running state.
3. Report only findings present in the run's issues. Cite the run id and the
   affected URLs. If the run is \`partial\`, say which evidence is missing rather
   than filling the gap with generic advice.
4. Rank by measured impact, not by rule severity alone.

Never request or echo API keys, OAuth values, or cookies.`,
  },
  {
    file: "seo-compare.md",
    description: "Compare a project against competitor URLs.",
    tool: "agentseo_compare_start",
    body: `Compare an AGENTseo project against competitors under identical crawl settings.

1. Call \`agentseo_compare_start\` with the project and the competitor URLs in
   $ARGUMENTS.
2. Poll \`agentseo_run_get\` until the run finishes.
3. Report only differences the run actually measured. Separate structural gaps
   from content gaps, and state which competitor pages were not reachable.

Do not infer a competitor's traffic or rankings; AGENTseo does not measure them.`,
  },
  {
    file: "seo-plan.md",
    description: "Build a content plan from seed topics.",
    tool: "agentseo_content_plan_start",
    body: `Build an AGENTseo content plan from the seed topics in $ARGUMENTS.

1. Call \`agentseo_content_plan_start\` with up to ten seeds.
2. Poll \`agentseo_run_get\` until it finishes.
3. Present clusters with their supporting keyword evidence. Mark any cluster
   whose demand signal is unavailable as unavailable — not as zero.`,
  },
  {
    file: "seo-keywords.md",
    description: "Research keyword demand and intent for a seed.",
    tool: "agentseo_keyword_research_start",
    body: `Research keyword demand for the seed in $ARGUMENTS.

1. Call \`agentseo_keyword_research_start\`.
2. Poll \`agentseo_run_get\` until it finishes.
3. Report intent classification and momentum with the evidence behind each.
   Name the configured sources; if a source is not connected, say so.`,
  },
  {
    file: "seo-status.md",
    description: "Read schedules, recent runs, and runtime health.",
    tool: "agentseo_monitoring_status",
    body: `Report AGENTseo monitoring status.

1. Call \`agentseo_monitoring_status\`.
2. Summarize schedules, recent run outcomes, and runtime health.
3. Flag failed or partial runs explicitly. Change nothing — this is read-only.`,
  },
];

// ---------------------------------------------------------------------------
// Host manifests.
// ---------------------------------------------------------------------------

const mcpServerEntry = {
  command: "node",
  args: ["./dist/agentseo-mcp.mjs"],
  cwd: ".",
};

const claudePluginManifest = {
  name: "agentseo",
  version,
  description: DESCRIPTION,
  author: AUTHOR,
  homepage: "https://golemworkers.com",
  repository: REPOSITORY,
  license: rootManifest.license,
  keywords: ["seo", "marketing", "crawler", "search-console", "analytics"],
  commands: "./commands/",
  skills: "./skills/",
  mcpServers: "./.mcp.json",
};

const marketplaceManifest = {
  name: "agentseo",
  owner: AUTHOR,
  metadata: {
    description: "Local-first, evidence-based SEO tooling for coding agents.",
    version,
  },
  plugins: [
    {
      name: "agentseo",
      source: "./plugins/claude/agentseo",
      description: DESCRIPTION,
      version,
      author: AUTHOR,
      homepage: "https://golemworkers.com",
      license: rootManifest.license,
      keywords: ["seo", "marketing", "crawler", "search-console", "analytics"],
    },
  ],
};

// Editors that speak plain MCP over stdio. They run the published CLI's MCP
// bridge rather than a bundled copy, so there is nothing to build first.
const stdioServer = {
  command: "npx",
  args: ["-y", "@agentseoapp/mcp", "agentseo-mcp"],
};

const editorConfigs = [
  {
    file: "integrations/cursor.mcp.json",
    body: { mcpServers: { agentseo: stdioServer } },
  },
  {
    file: "integrations/vscode.mcp.json",
    body: { servers: { agentseo: { type: "stdio", ...stdioServer } } },
  },
  {
    file: "integrations/claude-code.mcp.json",
    body: { mcpServers: { agentseo: stdioServer } },
  },
  {
    file: "integrations/generic.mcp.json",
    body: { mcpServers: { agentseo: stdioServer } },
  },
];

// ---------------------------------------------------------------------------

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const outputs = new Map();

outputs.set(
  "plugins/claude/agentseo/.claude-plugin/plugin.json",
  json(claudePluginManifest),
);
outputs.set(
  "plugins/claude/agentseo/.mcp.json",
  json({ mcpServers: { agentseo: mcpServerEntry } }),
);
outputs.set(".claude-plugin/marketplace.json", json(marketplaceManifest));

for (const command of COMMANDS) {
  outputs.set(
    `plugins/claude/agentseo/commands/${command.file}`,
    `---\ndescription: ${command.description}\n---\n\n${command.body}\n`,
  );
}

for (const config of editorConfigs) {
  outputs.set(config.file, json(config.body));
}

// The canonical skills live once and are copied into each host bundle.
const sharedSkills = resolve(root, "plugins/shared/skills");
for (const skill of await readdir(sharedSkills, { withFileTypes: true })) {
  if (!skill.isDirectory()) continue;
  const source = await readFile(
    join(sharedSkills, skill.name, "SKILL.md"),
    "utf8",
  );
  for (const host of ["plugins/claude/agentseo", "plugins/codex/agentseo"]) {
    outputs.set(`${host}/skills/${skill.name}/SKILL.md`, source);
  }
}

// ---------------------------------------------------------------------------

const drift = [];
for (const [relative, content] of outputs) {
  const path = resolve(root, relative);
  let current = null;
  try {
    current = await readFile(path, "utf8");
  } catch {
    /* absent */
  }
  if (current === content) continue;
  if (check) {
    drift.push(relative);
    continue;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

if (check) {
  if (drift.length > 0) {
    process.stderr.write(
      `Generated agent-host surfaces are stale. Run pnpm plugins:generate.\n${drift
        .map((file) => `  ${file}`)
        .join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `Agent-host surfaces match the contract registry (${outputs.size} files, ${PUBLIC_AGENT_TOOL_CONTRACTS.length} tools).\n`,
  );
} else {
  process.stdout.write(
    `Generated ${outputs.size} agent-host files from ${PUBLIC_AGENT_TOOL_CONTRACTS.length} tool contracts (${
      PUBLIC_AGENT_TOOL_CONTRACTS.filter(readOnly).length
    } read-only).\n`,
  );
}
