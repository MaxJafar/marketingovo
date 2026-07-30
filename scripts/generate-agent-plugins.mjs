// Generates every agent-host surface from one source of truth.
//
// The tool registry in @agentintel/contracts is authoritative. Host manifests
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

const { PUBLIC_AGENT_TOOLS } = await import(
  pathToFileURL(resolve(root, "packages/contracts/dist/agent-tools.js")).href
);

const rootManifest = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const version = JSON.parse(
  await readFile(
    resolve(root, "plugins/codex/agentintel/package.json"),
    "utf8",
  ),
).version;

const AUTHOR = { name: "MaxJafar", url: "https://github.com/MaxJafar/AGENTintel" };
const REPOSITORY = "https://github.com/MaxJafar/AGENTintel";
const DESCRIPTION =
  "Turn public and authorized market signals into replayable, cited competitive research.";

const readOnly = (contract) => contract.annotations?.readOnlyHint === true;

// ---------------------------------------------------------------------------
// Slash commands, one per start-shaped workflow plus the two read tools.
// ---------------------------------------------------------------------------

const COMMANDS = [
  {
    file: "intel-research.md",
    description: "Run cited research on a company, brand, or market.",
    tool: "agentintel_research_start",
    body: `Run AGENTintel research and separate observations from estimates.

1. Call \`agentintel_research_start\` for the subject in $ARGUMENTS.
2. Poll \`agentintel_run_get\` until the run leaves the running state.
3. Report only claims the run cites. Every material conclusion needs an
   observation citation; if there is none, say the evidence is absent instead of
   inferring.
4. Preserve contradictions rather than averaging them away, and repeat the
   run's own warnings (for example that follower change is not customer
   retention).

The daemon owns credentials. Never request, echo, or pass API keys or cookies.`,
  },
  {
    file: "intel-compare.md",
    description: "Compare brands or creators over the same sources.",
    tool: "agentintel_compare_start",
    body: `Compare the targets in $ARGUMENTS under identical collection settings.

1. Call \`agentintel_compare_start\` with every target.
2. Poll \`agentintel_run_get\` until it finishes.
3. Report denominator-safe metrics only. Missing measurements are unavailable,
   never zero. Name the sources that failed or were skipped.`,
  },
  {
    file: "intel-evidence.md",
    description: "Trace a claim back to its stored evidence.",
    tool: "agentintel_search",
    body: `Trace evidence for the query in $ARGUMENTS.

1. Call \`agentintel_search\` over committed evidence.
2. For any entity worth expanding, call \`agentintel_entity_get\`.
3. Present each result with its source, snapshot hash, and run id so the reader
   can verify it independently. Do not summarize beyond what the evidence says.`,
  },
  {
    file: "intel-status.md",
    description: "Inspect collection health and recent runs.",
    tool: "agentintel_monitoring_status",
    body: `Report AGENTintel collection health.

1. Call \`agentintel_monitoring_status\`.
2. Summarize source freshness, recent run outcomes, and daemon health.
3. Flag failed, partial, and cancelled runs explicitly. This is read-only.`,
  },
];

// ---------------------------------------------------------------------------
// Host manifests.
// ---------------------------------------------------------------------------

const mcpServerEntry = {
  command: "node",
  args: ["./dist/agentintel-mcp.mjs"],
  cwd: ".",
};

const claudePluginManifest = {
  name: "agentintel",
  version,
  description: DESCRIPTION,
  author: AUTHOR,
  homepage: "https://github.com/MaxJafar/AGENTintel",
  repository: REPOSITORY,
  license: rootManifest.license,
  keywords: [
    "competitive-intelligence",
    "creators",
    "research",
    "marketing",
    "evidence",
  ],
  commands: "./commands/",
  skills: "./skills/",
  mcpServers: "./.mcp.json",
};

const marketplaceManifest = {
  name: "agentintel",
  owner: AUTHOR,
  metadata: {
    description:
      "Local-first, evidence-first competitive research for coding agents.",
    version,
  },
  plugins: [
    {
      name: "agentintel",
      source: "./plugins/claude/agentintel",
      description: DESCRIPTION,
      version,
      author: AUTHOR,
      homepage: "https://github.com/MaxJafar/AGENTintel",
      license: rootManifest.license,
      keywords: [
        "competitive-intelligence",
        "creators",
        "research",
        "marketing",
        "evidence",
      ],
    },
  ],
};

// Editors that speak plain MCP over stdio. They run the published CLI's MCP
// bridge rather than a bundled copy, so there is nothing to build first.
const stdioServer = {
  command: "npx",
  args: ["-y", "@agentintel/mcp", "agentintel-mcp"],
};

const editorConfigs = [
  {
    file: "integrations/cursor.mcp.json",
    body: { mcpServers: { agentintel: stdioServer } },
  },
  {
    file: "integrations/vscode.mcp.json",
    body: { servers: { agentintel: { type: "stdio", ...stdioServer } } },
  },
  {
    file: "integrations/claude-code.mcp.json",
    body: { mcpServers: { agentintel: stdioServer } },
  },
  {
    file: "integrations/generic.mcp.json",
    body: { mcpServers: { agentintel: stdioServer } },
  },
  {
    file: "integrations/antigravity.mcp.json",
    body: { mcpServers: { agentintel: stdioServer } },
  },
];

// ---------------------------------------------------------------------------

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const outputs = new Map();

outputs.set(
  "plugins/claude/agentintel/.claude-plugin/plugin.json",
  json(claudePluginManifest),
);
outputs.set(
  "plugins/claude/agentintel/.mcp.json",
  json({ mcpServers: { agentintel: mcpServerEntry } }),
);
outputs.set(".claude-plugin/marketplace.json", json(marketplaceManifest));

for (const command of COMMANDS) {
  outputs.set(
    `plugins/claude/agentintel/commands/${command.file}`,
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
  for (const host of [
    "plugins/claude/agentintel",
    "plugins/codex/agentintel",
  ]) {
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
    `Agent-host surfaces match the contract registry (${outputs.size} files, ${PUBLIC_AGENT_TOOLS.length} tools).\n`,
  );
} else {
  process.stdout.write(
    `Generated ${outputs.size} agent-host files from ${PUBLIC_AGENT_TOOLS.length} tool contracts (${
      PUBLIC_AGENT_TOOLS.filter(readOnly).length
    } read-only).\n`,
  );
}
