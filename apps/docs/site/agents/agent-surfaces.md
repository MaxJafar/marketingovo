---
title: MCP, Codex, and OpenClaw
description: Connect agents to six workflow-level tools without giving them provider credentials.
---

# MCP, Codex, and OpenClaw

All official agent surfaces connect to the existing local daemon. They do not start another runtime, own another database, or receive provider credentials.

## Six public tools

| Tool                                  | Mode                   | Purpose                                                              |
| ------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `marketingovo_audit_start`            | Starts network work    | Audit an existing project with bounded static or JavaScript settings |
| `marketingovo_run_get`                | Read-only, replay-safe | Read run state and canonical issues                                  |
| `marketingovo_compare_start`          | Starts network work    | Compare a project with one to five public competitor URLs            |
| `marketingovo_keyword_research_start` | Starts provider work   | Expand a seed, classify intent, and evaluate momentum                |
| `marketingovo_content_plan_start`     | Starts provider work   | Build profiles and clusters for up to ten seed topics                |
| `marketingovo_monitoring_status`      | Read-only, replay-safe | Read health, schedules, and recent runs                              |

Start tools return a run ID. The agent must call `marketingovo_run_get` until the run is terminal before describing the work as complete.

The start tools are marked optional in the OpenClaw adapter so an operator can allowlist network-initiating behavior. Read-only inspection remains separate.

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
  append-only marketer journal.

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
