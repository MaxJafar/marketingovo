---
title: REST API
description: Use the loopback v1 API safely for projects, asynchronous runs, actions, integrations, schedules, and reports.
---

# REST API

The local REST API is the contract boundary shared by the dashboard, CLI, SDK, MCP bridge, and agent adapters.

```text
http://127.0.0.1:3210/api/v1
```

The server binds to loopback and validates `Host` on every request. For cookie-authenticated, non-safe browser mutations it also validates `Origin` and CSRF. It does not enable CORS and is not designed to sit behind a public proxy.

## Discover the current contract

The OpenAPI document and capability response are the most reliable runtime references:

```bash
curl http://127.0.0.1:3210/api/v1/openapi.json
curl http://127.0.0.1:3210/api/v1/capabilities
```

Capabilities report the edition, product version, API version, telemetry state, local limits, feature identifiers, and hosted-option message.

## Authentication modes

### Browser dashboard

The CLI prints a dashboard URL containing a one-time token in the URL fragment. The dashboard exchanges it for an HttpOnly, SameSite session cookie, stores the returned CSRF value only in memory, and removes the fragment from the address bar.

Browser mutations require the same origin and the `X-Golem-CSRF` header. The bootstrap token is one-time and is not a reusable API credential.

### Trusted local clients

The CLI, SDK, MCP bridge, and adapters use the service-token file created in the private Golem SEO data directory. Prefer the typed SDK or official adapter so the token is read from the file rather than copied into shell history or configuration text.

Do not paste the service token into the dashboard, an agent prompt, a report, or a support request.

## Core resources

| Method and path                               | Purpose                                                      |
| --------------------------------------------- | ------------------------------------------------------------ |
| `GET /health`                                 | Local database, queue, and version health                    |
| `GET /capabilities`                           | Edition and runtime feature discovery                        |
| `GET /projects`                               | List projects                                                |
| `POST /projects`                              | Create a project with a canonical URL                        |
| `DELETE /projects/:id`                        | Permanently delete a confirmed local project                 |
| `GET /projects/:id/overview`                  | Read metrics, last run, and Top 5 Actions                    |
| `GET /projects/:id/context`                   | Read current context, revision history, and marketer journal |
| `PUT /projects/:id/context`                   | Create the next immutable Project Context revision           |
| `POST /projects/:id/context/journal`          | Append a human observation, decision, constraint, or test    |
| `GET /extraction-rule-templates`              | Read curated review-required extraction packs                |
| `GET /projects/:id/extraction-rules`          | Read current and historical extraction-rule revisions        |
| `PUT /projects/:id/extraction-rules`          | Save the next validated immutable rule revision              |
| `POST /projects/:id/extraction-rules/preview` | Preview draft rules on one exact-origin page                 |
| `GET /runs?projectId=`                        | List asynchronous runs                                       |
| `POST /runs`                                  | Start audit, compare, keyword-research, or content-plan work |
| `GET /runs/:id`                               | Read current run state                                       |
| `GET /runs/:id/comparison`                    | Compare two immutable audit snapshots                        |
| `GET /runs/:id/evidence`                      | Page crawl, redirect, hreflang, or extraction evidence       |
| `GET /runs/:id/links`                         | Page one immutable inlink or outlink direction               |
| `POST /runs/:id/replay`                       | Copy stored configuration into an independent run            |
| `GET /runs/:id/events`                        | Stream run events over SSE                                   |
| `GET /runs/:id/issues`                        | Read canonical issue instances                               |
| `GET /issues?projectId=`                      | Search and page latest issue-review state                    |
| `PATCH /issues/:fingerprint`                  | Ignore, mark false positive, or reopen with a safe reason    |
| `POST /runs/:id/cancel`                       | Request cancellation                                         |
| `GET /runs/:id/report?format=`                | Download HTML, PDF, CSV, or JSON when available              |
| `GET /actions?projectId=`                     | List the action backlog                                      |
| `PATCH /actions/:id`                          | Update owner, state, or verification                         |
| `GET /integrations`                           | Read safe connector state and masked metadata                |
| `POST /integrations/:provider/credentials`    | Submit write-only provider credentials                       |
| `POST /integrations/:provider/test`           | Test a configured connection                                 |
| `DELETE /integrations/:provider`              | Remove a connection                                          |
| `GET /schedules?projectId=`                   | List local schedules                                         |
| `POST /schedules`                             | Create a schedule                                            |
| `PATCH /schedules/:id`                        | Update a schedule                                            |
| `DELETE /schedules/:id`                       | Remove a schedule                                            |
| `POST /export`                                | Export a project without secrets                             |

Dashboard-specific compatibility routes adapt these same public contracts for UI workspaces. They are not a second data source.

Issue adjudication is a deliberate write operation. `ignored` and
`false_positive` require a bounded reason; secrets and local filesystem paths
are rejected. The actor is assigned locally and cannot be supplied by the
client. Agent adapters expose issue review as a read-only resource rather than
as a default mutation tool.

The CLI mirrors this boundary:

```bash
golem-seo issue list PROJECT_ID --status open --severity high
golem-seo issue review PROJECT_ID FINGERPRINT false-positive --reason-file ./review-reason.txt
golem-seo issue review PROJECT_ID FINGERPRINT open
```

Mutation reasons use a file so they do not become a shell-history argument.
The local API applies the same length and secret-screening checks.

The CLI mirrors Project Context without placing profile or journal prose in
shell history:

```bash
golem-seo context show PROJECT_ID
golem-seo context update PROJECT_ID --profile-file ./context.json --change-summary-file ./change.txt
golem-seo context append PROJECT_ID decision --title-file ./title.txt --detail-file ./detail.txt --source-run RUN_ID
```

Project Context is also a deliberate human write boundary. A profile update
always creates a new revision; a journal entry is append-only and can cite only
a run from the same project. Secret-like values and local filesystem paths are
rejected. MCP projects this state as a read-only resource and does not expose a
context mutation tool.

Extraction templates are read-only catalog data. The response declares
`importMode: "review_required"` and includes every selector, capture mode,
recommended page, and assumption. Clients must create fresh rule IDs and show
the proposed fields before adding them to an unsaved draft. The CLI exposes the
same catalog with `golem-seo extraction templates`; saving remains an explicit
project-scoped operation.

Project deletion is deliberately outside the agent surface. `DELETE
/projects/:id` requires `{ "confirmation": "Exact current project name" }`.
It stops active work and returns a receipt with deleted record counts and file
cleanup state. The deletion removes project-scoped data and artifacts but
retains global BYOK credentials for other projects. The equivalent CLI command
uses `--confirm-name-file PATH` so the confirmation is not a shell-history
argument.

## Start an asynchronous run

`POST /runs` requires an `Idempotency-Key` header of at least eight characters. A successful start returns `202 Accepted` and a run record.

```json
{
  "projectId": "project-id",
  "workflowId": "audit",
  "goal": "Find the highest-value technical blockers",
  "options": {
    "renderMode": "static",
    "maxUrls": 500
  }
}
```

Do not treat `202` as a completed audit. Read `/runs/:id`, stream `/runs/:id/events`, or use the SDK watcher until the run reaches `succeeded`, `partial`, `failed`, or `cancelled`.

## Use the typed SDK

```ts
import { GolemSeoClient } from "@golem-seo/sdk";

const client = await GolemSeoClient.fromTokenFile(
  "/private/path/to/service-token",
);
const projects = await client.projects.list();

const templates = await client.extractionRules.templates();

const context = await client.context.get(projects[0].id);

const run = await client.runs.start({
  projectId: projects[0].id,
  workflowId: "audit",
  goal: "Find technical blockers",
});

const hreflang = await client.runs.evidence(run.id, {
  section: "hreflang",
  limit: 50,
  offset: 0,
});

const outlinks = await client.runs.links(run.id, {
  pageUrl: "https://example.com/pricing",
  direction: "outlinks",
  limit: 50,
});

const replay = await client.runs.replay(run.id);
console.log(replay.configurationHash, replay.run.id);

for await (const event of client.watchRun(run.id)) {
  console.log(event.type);
}
```

Use the service-token path printed by the local CLI; keep the file private. Production code should handle the possibility that no project exists instead of indexing the array directly as this compact example does.

The same immutable graph is available without writing code:

```bash
pnpm golem-seo run links RUN_ID \
  --url https://example.com/pricing \
  --direction outlinks \
  --limit 50
```

Add `--search TEXT` to narrow source URLs, destination URLs, titles, or captured
anchor text. The command prints the server result; it does not recompute link
state in the CLI.

For complete route-level typing, use the generated client. Its path, parameter,
request-body, media-type, and response types are regenerated from the server's
OpenAPI document, while the runtime wrapper still refuses any token destination
other than the canonical IPv4 loopback API.

```ts
import { createGeneratedGolemSeoClientFromTokenFile } from "@golem-seo/sdk";

const api = await createGeneratedGolemSeoClientFromTokenFile(
  "/private/path/to/service-token",
);
const { data, error } = await api.GET("/api/v1/health");
```

## Errors and source state

Errors use `application/problem+json` with an HTTP status and optional `detail`,
`instance`, and stable `code`. CI checks the documented error media type across
every public operation. Clients should still branch on status and tolerate an
unknown future problem code.

Measurements use explicit source state. A metric can be `available`, `unavailable`, `stale`, or `failed`, with nullable value, observation time, coverage, and a human-readable note. Clients must preserve those distinctions.

## Stability

The versioned route is `/api/v1`, but `0.11` remains an alpha. Route contract changes should update TypeBox schemas, runtime validation, OpenAPI, generated SDK types, tests, and documentation together. The six agent tools use a separate canonical TypeBox registry that MCP and OpenClaw project into their native schema dialects.

<p class="source-note">
  Canonical sources: <a href="https://github.com/GolemWorkers/golem-seo/blob/main/packages/contracts/src/index.ts">public API TypeBox contracts</a>,
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/packages/contracts/src/agent-tools.ts">agent tool contracts</a>,
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/packages/server/src/index.ts">local server</a>,
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/packages/sdk/src/index.ts">typed SDK</a>, and
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/docs/architecture.md">architecture</a>.
</p>
