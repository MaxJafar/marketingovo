// Generates every agent-host surface from one source of truth.
//
// The tool registry in @marketingovo/contracts is authoritative. Host manifests
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
  await readFile(
    resolve(root, "plugins/codex/marketingovo/package.json"),
    "utf8",
  ),
).version;

const AUTHOR = {
  name: "Marketingovo",
  url: "https://github.com/MaxJafar/marketingovo",
};
const REPOSITORY = "https://github.com/MaxJafar/marketingovo";
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
    tool: "marketingovo_audit_start",
    body: `Run an Marketingovo audit and report prioritized, evidence-backed actions.

1. Call \`marketingovo_audit_start\` for the project named in $ARGUMENTS (ask which
   project if it is ambiguous — never guess).
2. Poll \`marketingovo_run_get\` until the run leaves the running state.
3. Report only findings present in the run's issues. Cite the run id and the
   affected URLs. If the run is \`partial\`, say which evidence is missing rather
   than filling the gap with generic advice.
4. Rank by measured impact, not by rule severity alone.

Never request or echo API keys, OAuth values, or cookies.`,
  },
  {
    file: "seo-compare.md",
    description: "Compare a project against competitor URLs.",
    tool: "marketingovo_compare_start",
    body: `Compare an Marketingovo project against competitors under identical crawl settings.

1. Call \`marketingovo_compare_start\` with the project and the competitor URLs in
   $ARGUMENTS. Ask which project is meant if it is ambiguous — never guess, and
   never substitute a competitor URL the user did not give you.
2. Poll \`marketingovo_run_get\` until the run finishes.
3. Report only differences the run actually measured. Separate structural gaps
   from content gaps, and state which competitor pages were not reachable.
4. Use \`marketingovo_run_evidence\` to show the rows behind a claimed gap rather
   than describing it.

Do not infer a competitor's traffic or rankings; Marketingovo does not measure them.`,
  },
  {
    file: "seo-plan.md",
    description: "Build a content plan from seed topics.",
    tool: "marketingovo_content_plan_start",
    body: `Build an Marketingovo content plan from the seed topics in $ARGUMENTS.

1. Call \`marketingovo_content_plan_start\` with up to ten seeds for the project
   named in $ARGUMENTS. Ask which project is meant if it is ambiguous — never
   guess.
2. Poll \`marketingovo_run_get\` until it finishes.
3. Present clusters with their supporting keyword evidence. Mark any cluster
   whose demand signal is unavailable as unavailable — not as zero.
4. Do not invent a publishing cadence, word count, or traffic projection. If the
   run could not support a cluster, name the missing evidence rather than filling
   the gap with generic advice.`,
  },
  {
    file: "seo-keywords.md",
    description: "Research keyword demand and intent for a seed.",
    tool: "marketingovo_keyword_research_start",
    body: `Research keyword demand for the seed in $ARGUMENTS.

1. Call \`marketingovo_keyword_research_start\` for the project named in
   $ARGUMENTS. Ask which project is meant if it is ambiguous — never guess.
2. Poll \`marketingovo_run_get\` until it finishes.
3. Report intent classification and momentum with the evidence behind each.
   Name the configured sources; if a source is not connected, say so.
4. Do not invent search volume. Autocomplete breadth is not demand, and a
   provider value that was not returned is unavailable, never zero. Name the gap
   instead of filling it with generic advice.`,
  },
  {
    file: "osint-research.md",
    description: "Build a bounded public-web OSINT dossier for a project.",
    tool: "marketingovo_osint_research_start",
    body: `Build a public-web intelligence dossier for the project in $ARGUMENTS.

1. Call \`marketingovo_osint_research_start\` with the project and only the
   explicitly supplied public HTTPS targets. Ask which project is meant if it
   is ambiguous — never guess or add a target on the user's behalf.
2. Poll \`marketingovo_run_get\` until the run finishes, then read its JSON
   report. Summarize coverage, target status, findings, and the evidence URLs.
3. Keep missing and insufficient observations visible. A linked social URL is
   linkage evidence, not proof of account ownership, audience, or engagement.
4. Never request credentials or pivot to people lookup, contact enrichment,
   authenticated scraping, identity resolution, breach data, or dark-web work.
   Cadence is publication evidence only — do not turn it into reach or revenue.`,
  },
  {
    file: "meta-ads.md",
    description: "Audit Facebook and Instagram ad cabinets.",
    tool: "marketingovo_ads_audit_start",
    body: `Audit the Meta ad cabinets linked to the project in $ARGUMENTS.

1. Call \`marketingovo_ads_cabinets\` to see which cabinets the workspace reads,
   their currency, and the spend caps the operator set. Ask which project is
   meant if it is ambiguous — never guess.
2. Call \`marketingovo_ads_audit_start\`, then poll \`marketingovo_run_get\` until
   the run leaves the running state. A \`partial\` run means at least one cabinet
   could not be fully read; name which, and why.
3. Read \`marketingovo_ads_performance\` for each cabinet and report Facebook and
   Instagram separately. They are different auctions with different costs, and
   an account total hides which one is working.
4. A null metric was not measured. Say so and give the stated reason — never
   report it as zero spend, zero conversions, or a cost per result derived from
   a missing denominator. Reach and frequency have no window total by design.
5. Rank findings by measured money at stake, not by rule severity alone.

You may draft campaigns with \`marketingovo_campaign_stage\`. You cannot approve
or publish one, and no tool here can: a person approves what runs under their
brand, in the dashboard. Say the drafts are waiting for review rather than
describing anything as launched.`,
  },
  {
    file: "email-campaign.md",
    description:
      "Build a brand-consistent HTML email that survives real inboxes.",
    tool: "marketingovo_email_draft",
    body: `Build an HTML email for the campaign described in $ARGUMENTS.

1. Call \`marketingovo_brand_kit\` for the project named in $ARGUMENTS. Ask which
   project is meant if it is ambiguous — never guess. Use its colours, type
   stacks, content width, voice and prohibitions. The footer fields are not
   optional decoration: the postal address and the unsubscribe merge tag are
   legally required in commercial mail.
2. Write the HTML. Email is not the web:
   - lay out with nested tables and \`role="presentation"\`, never flexbox or
     grid — Outlook on Windows renders with Microsoft Word and has neither;
   - give every image \`alt\` text and a \`width\` attribute, because Outlook
     blocks remote images by default and the alt is what most people see;
   - end every font stack with a generic family, since web fonts are ignored
     by Outlook and Gmail's mobile apps;
   - keep the whole document under 102KB or Gmail clips it, hiding the footer
     and the unsubscribe link behind a "view entire message" link.
3. Call \`marketingovo_email_draft\` without a \`template_id\` and read the
   findings. Each one names a real client and what it does. Fix them and
   resubmit. Do not explain a finding away — the report is the specification.
4. When nothing blocking or error-level remains, call it once more with the
   \`template_id\` to save it.
5. Report what you built, the revision, and any warnings you deliberately left.

Marketingovo does not send email. Say the HTML is ready to export into the
operator's own email service; never describe a campaign as sent.`,
  },
  {
    file: "marketing-report.md",
    description:
      "Build a client-facing report across paid, organic, social and email.",
    tool: "marketingovo_marketing_report",
    body: `Build the cross-channel report for the period in $ARGUMENTS.

1. Call \`marketingovo_marketing_report\` for the project named in $ARGUMENTS.
   Ask which project is meant if it is ambiguous — never guess.
2. Read every section, including the ones marked unavailable. A section that
   could not be read is a finding, not an omission.
3. Write the narrative. Report each channel's own figures.

Three things you must not do, because this document goes to a client who
cannot check it:

- **Never add conversions across channels.** Meta counts conversions it
  attributes on its own window; Analytics counts key events on a last-click
  session model. The same purchase appears in both, so a sum is larger than
  what happened. The report refuses this total — repeat the refusal.
- **Never turn an unavailable source into zero.** If Search Console was
  disconnected, say so. "Organic clicks: 0" is a different claim, and a false
  one.
- **Never compute a change against an unmeasured period.** The report already
  withholds those; do not reconstruct them.

Say plainly what the period showed and what could not be seen. A report whose
gaps are stated is worth more to a client than one that reads as complete.`,
  },
  {
    file: "seo-status.md",
    description: "Read schedules, recent runs, and runtime health.",
    tool: "marketingovo_monitoring_status",
    body: `Report Marketingovo monitoring status.

1. Call \`marketingovo_monitoring_status\`.
2. Summarize schedules, recent run outcomes, and runtime health.
3. Flag failed or partial runs explicitly. Change nothing — this is read-only.`,
  },
];

// ---------------------------------------------------------------------------
// Host manifests.
// ---------------------------------------------------------------------------

const mcpServerEntry = {
  command: "node",
  args: ["./dist/marketingovo-mcp.mjs"],
  cwd: ".",
};

const claudePluginManifest = {
  name: "marketingovo",
  version,
  description: DESCRIPTION,
  author: AUTHOR,
  homepage: "https://github.com/MaxJafar/marketingovo",
  repository: REPOSITORY,
  license: rootManifest.license,
  keywords: ["seo", "marketing", "crawler", "search-console", "analytics"],
  commands: "./commands/",
  skills: "./skills/",
  mcpServers: "./.mcp.json",
};

const marketplaceManifest = {
  name: "marketingovo",
  owner: AUTHOR,
  metadata: {
    description: "Local-first, evidence-based SEO tooling for coding agents.",
    version,
  },
  plugins: [
    {
      name: "marketingovo",
      source: "./plugins/claude/marketingovo",
      description: DESCRIPTION,
      version,
      author: AUTHOR,
      homepage: "https://github.com/MaxJafar/marketingovo",
      license: rootManifest.license,
      keywords: ["seo", "marketing", "crawler", "search-console", "analytics"],
    },
  ],
};

// Editors that speak plain MCP over stdio. They run the published CLI's MCP
// bridge rather than a bundled copy, so there is nothing to build first.
const stdioServer = {
  command: "npx",
  args: ["-y", "@marketingovo/mcp", "marketingovo-mcp"],
};

const editorConfigs = [
  {
    file: "integrations/cursor.mcp.json",
    body: { mcpServers: { marketingovo: stdioServer } },
  },
  {
    file: "integrations/vscode.mcp.json",
    body: { servers: { marketingovo: { type: "stdio", ...stdioServer } } },
  },
  {
    file: "integrations/claude-code.mcp.json",
    body: { mcpServers: { marketingovo: stdioServer } },
  },
  {
    file: "integrations/generic.mcp.json",
    body: { mcpServers: { marketingovo: stdioServer } },
  },
];

// ---------------------------------------------------------------------------

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const outputs = new Map();

outputs.set(
  "plugins/claude/marketingovo/.claude-plugin/plugin.json",
  json(claudePluginManifest),
);
outputs.set(
  "plugins/claude/marketingovo/.mcp.json",
  json({ mcpServers: { marketingovo: mcpServerEntry } }),
);
outputs.set(".claude-plugin/marketplace.json", json(marketplaceManifest));

for (const command of COMMANDS) {
  outputs.set(
    `plugins/claude/marketingovo/commands/${command.file}`,
    `---\ndescription: ${command.description}\n---\n\n${command.body}\n`,
  );
}

for (const config of editorConfigs) {
  outputs.set(config.file, json(config.body));
}

// ---------------------------------------------------------------------------
// OpenClaw plugin manifest. Its tool list and per-tool metadata are derived
// from the registry; only the connection config is adapter-specific.
// ---------------------------------------------------------------------------

outputs.set(
  "adapters/openclaw/openclaw.plugin.json",
  json({
    id: "marketingovo",
    name: "Marketingovo",
    description:
      "Run local SEO audits, comparisons, keyword research, content plans, public-web OSINT research, evidence inspection, and monitoring through bounded workflow-level tools.",
    version,
    configSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        serverUrl: {
          type: "string",
          default: "http://127.0.0.1:3210/api/v1",
          description: "Marketingovo loopback API URL.",
        },
        tokenFile: {
          type: "string",
          description: "Path to the local Marketingovo service-token file.",
        },
        timeoutMs: {
          type: "number",
          minimum: 1000,
          maximum: 120000,
          default: 30000,
          description: "Request timeout in milliseconds.",
        },
      },
    },
    uiHints: {
      serverUrl: { label: "Local API URL" },
      tokenFile: { label: "Service token file", sensitive: false },
      timeoutMs: { label: "Request timeout (ms)" },
    },
    activation: { onStartup: true },
    contracts: {
      tools: PUBLIC_AGENT_TOOL_CONTRACTS.map((contract) => contract.name),
    },
    toolMetadata: Object.fromEntries(
      PUBLIC_AGENT_TOOL_CONTRACTS.filter((contract) => contract.optional).map(
        (contract) => [contract.name, { optional: true }],
      ),
    ),
  }),
);

// The canonical skills live once and are copied into each host bundle.
const sharedSkills = resolve(root, "plugins/shared/skills");
for (const skill of await readdir(sharedSkills, { withFileTypes: true })) {
  if (!skill.isDirectory()) continue;
  const source = await readFile(
    join(sharedSkills, skill.name, "SKILL.md"),
    "utf8",
  );
  for (const host of [
    "plugins/claude/marketingovo",
    "plugins/codex/marketingovo",
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
    `Agent-host surfaces match the contract registry (${outputs.size} files, ${PUBLIC_AGENT_TOOL_CONTRACTS.length} tools).\n`,
  );
} else {
  process.stdout.write(
    `Generated ${outputs.size} agent-host files from ${PUBLIC_AGENT_TOOL_CONTRACTS.length} tool contracts (${
      PUBLIC_AGENT_TOOL_CONTRACTS.filter(readOnly).length
    } read-only).\n`,
  );
}
