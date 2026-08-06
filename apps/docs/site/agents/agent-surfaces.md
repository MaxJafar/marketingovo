---
title: MCP, Codex, and OpenClaw
description: Connect agents to nineteen workflow tools and five session tools without giving them provider credentials.
---

# MCP, Codex, and OpenClaw

All official agent surfaces connect to the existing local daemon. They do not start another runtime, own another database, or receive provider credentials.

## Nineteen public workflow tools

| Tool                                  | Mode                   | Purpose                                                               |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `marketingovo_audit_start`            | Starts network work    | Audit an existing project with bounded static or JavaScript settings  |
| `marketingovo_run_get`                | Read-only, replay-safe | Read run state and canonical issues                                   |
| `marketingovo_run_evidence`           | Read-only, replay-safe | Page through stored crawl, redirect, hreflang and extraction evidence |
| `marketingovo_run_links`              | Read-only, replay-safe | Read the recorded inlinks or outlinks for one page URL                |
| `marketingovo_run_compare`            | Read-only, replay-safe | Read the server-computed comparison between two completed audits      |
| `marketingovo_compare_start`          | Starts network work    | Compare a project with one to five public competitor URLs             |
| `marketingovo_keyword_research_start` | Starts provider work   | Expand a seed, classify intent, and evaluate momentum                 |
| `marketingovo_content_plan_start`     | Starts provider work   | Build profiles and clusters for up to ten seed topics                 |
| `marketingovo_osint_research_start`   | Starts network work    | Build a bounded public-web dossier with exact source evidence         |
| `marketingovo_monitoring_status`      | Read-only, replay-safe | Read health, schedules, and recent runs                               |
| `marketingovo_ads_cabinets`           | Read-only, replay-safe | List linked Meta ad cabinets, their currency and local spend caps     |
| `marketingovo_ads_performance`        | Read-only, replay-safe | One cabinet's measured window, split by Facebook and Instagram        |
| `marketingovo_ads_audit_start`        | Starts provider work   | Sync the cabinets and run the paid-media rules                        |
| `marketingovo_campaign_stage`         | Writes locally         | Draft a campaign brief and its deliverables for a person to review    |
| `marketingovo_brand_kit`              | Read-only, replay-safe | Brand colours, type stacks, voice and the legal email footer          |
| `marketingovo_email_templates`        | Read-only, replay-safe | Email templates and their revision history                            |
| `marketingovo_email_draft`            | Writes locally         | Compile email HTML and get back every real client defect in it        |
| `marketingovo_marketing_report`       | Writes locally         | Generate or read the cross-channel report, including what it refuses  |
| `marketingovo_campaign_link`          | Writes locally         | Build a tagged link and a QR code, refusing tagging that loses data   |

Start tools return a run ID. The agent must call `marketingovo_run_get` until the run is terminal before describing the work as complete.

Tools that change state — every start tool, plus `marketingovo_campaign_stage`, `marketingovo_email_draft`, `marketingovo_marketing_report` and `marketingovo_campaign_link` — are marked optional in the OpenClaw adapter so an operator can allowlist them separately from read-only inspection. Only the start tools are open-world; the rest write locally and reach no provider.

## The one thing no agent tool does

There is no approve or publish tool, and there will not be one.

An agent may draft an entire campaign — ad copy, a reel script, an article — and stage the exact payload that would be sent to Meta. Approving that payload requires a request carrying the browser's session cookie and CSRF token, and the daemon refuses it for the local service token that every agent surface authenticates with.

This is deliberately not a permission flag or a confirmation prompt the model answers. Both are things a sufficiently confused or prompt-injected agent talks its way past, because their enforcement lives inside the thing being controlled. The transport split already means "a person did this in a browser", and spending money under the operator's brand is exactly the operation that should be pinned to it.

The contract and MCP test suites assert that no tool named for approving or publishing exists, so adding one fails a build before it reaches an operator.

Paid numbers carry one more obligation. Every metric Marketingovo could not measure is returned as `null` with a stated reason, never as `0`, and reach and frequency have no window total by design. An agent that reports a null as zero spend, zero conversions, or a cost per result derived from a missing denominator is inventing a measurement — say "not measured" and give the reason.

## Five terminal session tools

The dashboard's bottom edge is a console with no model of its own. It waits for an agent to attach and answer. These five tools are that other half, and they live in a registry separate from the ten workflow tools so an operator can grant conversational access without granting crawl access, or the reverse.

| Tool                          | Mode                   | Purpose                                                              |
| ----------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `marketingovo_session_list`   | Read-only, replay-safe | Find sessions and see whether one already has an agent attached      |
| `marketingovo_session_attach` | Claims a session       | Become its answering agent; returns `agent_id` and any earlier turns |
| `marketingovo_session_wait`   | Long poll              | Block for the next turn the marketer types; renews the lease         |
| `marketingovo_session_say`    | Writes a line          | Answer, narrate progress, report a tool, or report a failure         |
| `marketingovo_session_detach` | Releases a session     | Hand the session back so another agent can answer it                 |

The loop is `list → attach → wait → work → say → wait`. An empty `wait` result means nobody has typed yet, not that the conversation ended. Because `wait` doubles as the lease heartbeat, an agent that stops polling releases the session after ninety seconds rather than holding a console nobody is answering. Stop and discard the current answer when a wait returns `cancel_requested`.

Marketingovo never becomes a model client here. It has no provider key for the conversation and runs no inference; the harness brings its own model, which is why attaching costs the daemon no new credential. Never write a credential or provider key into a session.

Names, descriptions, strict input objects, defaults, limits, and safety annotations live in one `@marketingovo/contracts` registry. MCP converts that JSON Schema to Zod for runtime validation; OpenClaw projects the same schema into its TypeBox dialect. Neither adapter maintains a second field definition.

## MCP bridge

The bundled stdio MCP server reads the service token from the platform-specific Marketingovo data directory by default. Override only when the local daemon uses a custom location:

```text
MARKETINGOVO_API_URL=http://127.0.0.1:3210/api/v1
MARKETINGOVO_SERVICE_TOKEN_FILE=/private/path/to/service-token
```

For a source checkout that has already been built, an MCP client can launch the workspace binary:

```json
{
  "mcpServers": {
    "marketingovo": {
      "command": "pnpm",
      "args": [
        "--dir",
        "/absolute/path/to/marketingovo",
        "--filter",
        "@marketingovo/mcp",
        "exec",
        "marketingovo-mcp"
      ]
    }
  }
}
```

The package binary is named `marketingovo-mcp`. Confirm the current release channel before assuming a registry package is published.

### Read-only MCP resources

- `marketingovo://runs/{id}` — canonical run plus issues;
- `marketingovo://runs/{id}/report` — run summary with top issues;
- `marketingovo://projects/{id}/overview` — project metrics and prioritized actions;
- `marketingovo://projects/{id}/issues` — latest evidence, occurrence counts, and
  marketer adjudications;
- `marketingovo://projects/{id}/context` — versioned business/SEO profile and the
  append-only marketer journal;
- `marketingovo://projects/{id}/ads` — linked ad cabinets with their last
  measured window, split by platform.

## Codex bundle

The repository includes an installable Codex bundle at `plugins/codex/marketingovo`. It contains:

- the bundled MCP bridge;
- an MCP server manifest;
- the `seo-marketer` skill;
- product metadata and marketer-focused default prompts.

The skill routes questions into audit, comparison, keyword, content-plan, run-inspection, or monitoring workflows. It reads Project Context before overview and issue resources, treats journal observations as hypotheses rather than proof, keeps unavailable sources visible, respects reviewed issue states, explains `priority-v1` when ordering matters, and avoids unsupported traffic-uplift promises. Agents can read context and adjudications but must send a human back to the local dashboard to change them.

Use the Codex plugin installation flow for a local plugin directory in the Codex version you run. Build and validate the bundle from the workspace before installing it:

```bash
pnpm --filter @marketingovo/codex-plugin build
pnpm --filter @marketingovo/codex-plugin test
```

## OpenClaw adapter

The official adapter is `@marketingovo/openclaw` and currently declares compatibility with OpenClaw `2026.5.17` or newer.

Its configuration contains only:

```json
{
  "serverUrl": "http://127.0.0.1:3210/api/v1",
  "tokenFile": "/private/path/to/service-token",
  "timeoutMs": 30000
}
```

`tokenFile` is a path, not the token value. On every invocation, the adapter rereads that file and creates a typed local client so service-token rotation takes effect without restarting OpenClaw. Credential connection, rotation, deletion, project deletion, and commercial billing remain outside the agent surface.

Install through the OpenClaw plugin workflow supported by your runtime version, then validate the repository adapter:

```bash
pnpm --filter @marketingovo/openclaw build
pnpm --filter @marketingovo/openclaw test
```

## Safe operating pattern

1. Identify the intended project and marketing goal.
2. Read Project Context, then name missing, stale, or contradictory human context.
3. Ask before initiating open-world network work when the user has not already authorized it.
4. Preserve the run ID and poll instead of starting duplicates.
5. Report terminal state, source coverage, and freshness.
6. Separate measured evidence, human decisions, and inference.
7. Show impact, effort, confidence, and affected URLs for each action.
8. Name unavailable data and explain how it changes confidence.
9. Suggest the smallest verification run.

## What agents must never handle

- provider API keys, OAuth values, cookies, or billing data;
- the service-token value in prompts or tool parameters;
- credential rotation or deletion;
- raw customer reports or databases copied into conversation context;
- a queued or running job described as completed.

<p class="source-note">
  Canonical sources: <a href="https://github.com/MaxJafar/marketingovo/blob/main/packages/contracts/src/agent-tools.ts">agent tool contracts</a>,
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/packages/mcp/src/index.ts">MCP implementation</a>,
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/plugins/codex/marketingovo/skills/seo-marketer/SKILL.md">Codex marketer skill</a>, and
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/adapters/openclaw/README.md">OpenClaw adapter boundary</a>.
</p>
