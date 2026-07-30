// Asserts that every agent-facing instruction still carries its guardrails.
//
// This is deliberately NOT an LLM behavioural eval. Running a model would need a
// live API key and would be non-deterministic, so it cannot gate a pull request.
// What it does instead is pin the invariants a human could otherwise delete while
// editing prose: an evidence-first product's guardrails live in its skill text,
// and nothing previously stopped a rewrite from quietly dropping "unavailable is
// not zero" or "never pass credentials through a tool".
//
// Each requirement below states the behaviour it protects and why removing it
// would be a regression rather than an edit.

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

const { PUBLIC_AGENT_TOOL_CONTRACTS } = await import(
  pathToFileURL(resolve(root, "packages/contracts/dist/agent-tools.js")).href
);

const anyOf =
  (...patterns) =>
  (text) =>
    patterns.some((pattern) => pattern.test(text));

/** Guardrails the shared skill must keep. */
const SKILL_REQUIREMENTS = [
  {
    id: "no-credential-passing",
    protects:
      "An agent must never be told it may carry an API key, OAuth value or cookie. The daemon owns credentials; a skill that softens this invites exfiltration through tool arguments.",
    holds: anyOf(/never request, echo, infer, or pass API[\s\S]{0,10}keys/iu),
  },
  {
    id: "poll-to-terminal",
    protects:
      "Start tools return before work finishes. Without this, an agent reports a queued run as a completed audit.",
    holds: anyOf(/until the status is `succeeded`/u),
  },
  {
    id: "partial-is-not-complete",
    protects:
      "A partial run has real but incomplete evidence. Treating it as complete overstates confidence.",
    holds: anyOf(/partial[\s\S]{0,140}reduce confidence/iu),
  },
  {
    id: "missing-is-not-zero",
    protects:
      "The engine distinguishes an absent measurement from a measured zero. Collapsing them fabricates data.",
    // Must be the imperative prohibition. A passing mention of "missing data is
    // not zero" in a report template is not an instruction to the agent.
    holds: anyOf(/never treat unavailable[\s\S]{0,40}as zero/iu),
  },
  {
    id: "no-invented-uplift",
    protects:
      "Traffic-uplift and word-count promises are the classic SEO fabrication. The skill must forbid them outright.",
    holds: anyOf(
      /never invent a universal word-count, title-length, or traffic-uplift promise/iu,
    ),
  },
  {
    id: "respect-review-decisions",
    protects:
      "Issue Review adjudications are human decisions. An agent that overwrites them destroys operator intent.",
    holds: anyOf(/never overwrite these decisions/iu),
  },
  {
    id: "provider-cost-honesty",
    protects:
      "`not-reported` provider cost is unknown, never $0. Reporting it as free understates BYOK spend.",
    holds: anyOf(/`not-reported` is unknown, never `\$0`/u),
  },
  {
    id: "unavailable-link-graph",
    protects:
      "Runs predating the link graph report links as unavailable. Reading that as 'no links' inverts the finding.",
    holds: anyOf(/link graph existed report the data as unavailable/iu),
  },
  {
    id: "no-client-side-regression",
    protects:
      "Comparison is server-computed and accounts for configuration drift and reviewed noise. Diffing two summaries by hand produces false fixes.",
    holds: anyOf(/never recompute a[\s\S]{0,20}regression/iu),
  },
];

/** Guardrails every generated slash command must keep. */
const COMMAND_REQUIREMENTS = [
  {
    id: "frontmatter",
    protects:
      "A command without a description cannot be surfaced correctly by the host.",
    holds: (text) => /^---\ndescription: .+\n---\n/u.test(text),
  },
  {
    id: "references-a-real-tool",
    protects:
      "A command that names no tool is prose, not an entry point. Unknown tool names are caught separately by validate:plugins.",
    holds: (text) => /`agentseo_[a-z_]+`/u.test(text),
  },
  {
    id: "no-guessing",
    protects:
      "Acting on the wrong project silently crawls the wrong site. Ambiguity must stop the agent, not be resolved by guessing.",
    holds: anyOf(
      /never guess/iu,
      /ask which/iu,
      /read-only/iu,
      /change nothing/iu,
    ),
  },
];

/** Extra guardrails for commands that start asynchronous work. */
const START_COMMAND_REQUIREMENTS = [
  {
    id: "poll-before-reporting",
    protects:
      "A start command that reports immediately describes a queued job as a result.",
    holds: anyOf(/`agentseo_run_get`/u, /until the run/iu),
  },
  {
    id: "no-gap-filling",
    protects:
      "When evidence is missing the agent must name the gap. Filling it with generic advice is the failure mode this product exists to prevent.",
    holds: anyOf(
      /rather\s*\n?\s*than filling the gap/iu,
      /instead of filling/iu,
      /only findings present/iu,
      /only differences the run actually measured/iu,
      /do not (?:invent|infer)/iu,
      /label[^.]{0,60}unavailable/iu,
    ),
  },
];

const failures = [];

const check = (label, text, requirements) => {
  for (const requirement of requirements) {
    if (requirement.holds(text)) continue;
    failures.push(
      `${label}\n    missing guardrail: ${requirement.id}\n    protects: ${requirement.protects}`,
    );
  }
};

// ---------------------------------------------------------------------------

const skillsRoot = resolve(root, "plugins/shared/skills");
const skillDirs = (await readdir(skillsRoot, { withFileTypes: true })).filter(
  (entry) => entry.isDirectory(),
);

if (skillDirs.length === 0) {
  failures.push("plugins/shared/skills\n    no shared skill found");
}

let skillCount = 0;
for (const dir of skillDirs) {
  const relative = `plugins/shared/skills/${dir.name}/SKILL.md`;
  const text = await readFile(
    resolve(skillsRoot, dir.name, "SKILL.md"),
    "utf8",
  );
  skillCount += 1;
  check(relative, text, SKILL_REQUIREMENTS);

  // The skill routes to tools, so it must document every one that exists.
  for (const contract of PUBLIC_AGENT_TOOL_CONTRACTS) {
    if (text.includes(`\`${contract.name}\``)) continue;
    failures.push(
      `${relative}\n    does not document ${contract.name}\n    protects: a tool the skill never mentions is a tool the agent will not reach.`,
    );
  }
}

const commandsRoot = resolve(root, "plugins/claude/agentseo/commands");
const commandFiles = (await readdir(commandsRoot)).filter((name) =>
  name.endsWith(".md"),
);

const startTools = new Set(
  PUBLIC_AGENT_TOOL_CONTRACTS.filter(
    (contract) => contract.annotations?.readOnlyHint !== true,
  ).map((contract) => contract.name),
);

for (const file of commandFiles) {
  const relative = `plugins/claude/agentseo/commands/${file}`;
  const text = await readFile(resolve(commandsRoot, file), "utf8");
  check(relative, text, COMMAND_REQUIREMENTS);

  const startsWork = [...text.matchAll(/`(agentseo_[a-z_]+)`/gu)].some(
    ([, name]) => startTools.has(name),
  );
  if (startsWork) {
    check(relative, text, START_COMMAND_REQUIREMENTS);
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Agent instruction discipline failed in ${failures.length} place(s):\n\n` +
      `${failures.map((entry) => `  ${entry}`).join("\n\n")}\n\n` +
      "These guardrails are load-bearing. If one is genuinely obsolete, remove " +
      "its requirement in scripts/validate-skill-discipline.mjs in the same " +
      "commit and say why, so the deletion is deliberate rather than incidental.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Agent instruction discipline holds: ${skillCount} skill(s) against ` +
    `${SKILL_REQUIREMENTS.length} guardrails and ${PUBLIC_AGENT_TOOL_CONTRACTS.length} documented tools, ` +
    `${commandFiles.length} command(s) against ${COMMAND_REQUIREMENTS.length} guardrails ` +
    `plus ${START_COMMAND_REQUIREMENTS.length} more for start-shaped commands.\n`,
);
