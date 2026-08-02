import { join } from "node:path";
import { homedir } from "node:os";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  AgentAuditStartTool,
  AgentCompareStartTool,
  AgentContentPlanStartTool,
  AgentKeywordResearchStartTool,
  AgentMonitoringStatusTool,
  AgentRunCompareTool,
  AgentRunEvidenceTool,
  AgentRunGetTool,
  AgentRunLinksTool,
  AgentSessionAttachTool,
  AgentSessionDetachTool,
  AgentSessionListTool,
  AgentSessionSayTool,
  AgentSessionWaitTool,
  PUBLIC_AGENT_TOOL_NAMES,
  TERMINAL_SESSION_TOOL_NAMES,
  type AgentAuditStartInput,
  type AgentCompareStartInput,
  type AgentContentPlanStartInput,
  type AgentKeywordResearchStartInput,
  type AgentMonitoringStatusInput,
  type AgentRunCompareInput,
  type AgentRunEvidenceInput,
  type AgentRunGetInput,
  type AgentRunLinksInput,
  type AgentSessionAttachInput,
  type AgentSessionDetachInput,
  type AgentSessionListInput,
  type AgentSessionSayInput,
  type AgentSessionWaitInput,
} from "@marketingovo/contracts/agent-tools";
import { MarketingovoClient } from "@marketingovo/sdk";
import { resolveMcpConnectionEnvironment } from "./compatibility.js";

export const PUBLIC_TOOL_NAMES = PUBLIC_AGENT_TOOL_NAMES;
export const SESSION_TOOL_NAMES = TERMINAL_SESSION_TOOL_NAMES;

const toMcpInputSchema = <Value>(schema: unknown): z.ZodType<Value> =>
  z.fromJSONSchema(
    schema as Parameters<typeof z.fromJSONSchema>[0],
  ) as z.ZodType<Value>;

const auditStartInputSchema = toMcpInputSchema<AgentAuditStartInput>(
  AgentAuditStartTool.inputSchema,
);
const runGetInputSchema = toMcpInputSchema<AgentRunGetInput>(
  AgentRunGetTool.inputSchema,
);
const runEvidenceInputSchema = toMcpInputSchema<AgentRunEvidenceInput>(
  AgentRunEvidenceTool.inputSchema,
);
const runLinksInputSchema = toMcpInputSchema<AgentRunLinksInput>(
  AgentRunLinksTool.inputSchema,
);
const runCompareInputSchema = toMcpInputSchema<AgentRunCompareInput>(
  AgentRunCompareTool.inputSchema,
);
const compareStartInputSchema = toMcpInputSchema<AgentCompareStartInput>(
  AgentCompareStartTool.inputSchema,
);
const keywordResearchStartInputSchema =
  toMcpInputSchema<AgentKeywordResearchStartInput>(
    AgentKeywordResearchStartTool.inputSchema,
  );
const contentPlanStartInputSchema =
  toMcpInputSchema<AgentContentPlanStartInput>(
    AgentContentPlanStartTool.inputSchema,
  );
const monitoringStatusInputSchema =
  toMcpInputSchema<AgentMonitoringStatusInput>(
    AgentMonitoringStatusTool.inputSchema,
  );
const sessionListInputSchema = toMcpInputSchema<AgentSessionListInput>(
  AgentSessionListTool.inputSchema,
);
const sessionAttachInputSchema = toMcpInputSchema<AgentSessionAttachInput>(
  AgentSessionAttachTool.inputSchema,
);
const sessionWaitInputSchema = toMcpInputSchema<AgentSessionWaitInput>(
  AgentSessionWaitTool.inputSchema,
);
const sessionSayInputSchema = toMcpInputSchema<AgentSessionSayInput>(
  AgentSessionSayTool.inputSchema,
);
const sessionDetachInputSchema = toMcpInputSchema<AgentSessionDetachInput>(
  AgentSessionDetachTool.inputSchema,
);

export interface MarketingovoMcpOptions {
  client?: MarketingovoClient;
  baseUrl?: string;
  tokenFile?: string;
}

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

function defaultMarketingovoDataDirectory(): string {
  // Preserve the persisted 1.x data root until the storage migration owns the
  // default-path cutover. Connection environment variables remain canonical.
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "Marketingovo");
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "Marketingovo",
    );
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "marketingovo",
  );
}

export async function createMarketingovoMcpServer(
  options: MarketingovoMcpOptions = {},
): Promise<McpServer> {
  let client = options.client;
  if (!client) {
    const connectionEnvironment = resolveMcpConnectionEnvironment();
    client = await MarketingovoClient.fromTokenFile(
      options.tokenFile ??
        connectionEnvironment.tokenFile ??
        join(defaultMarketingovoDataDirectory(), "service-token"),
      { baseUrl: options.baseUrl ?? connectionEnvironment.baseUrl },
    );
  }
  const server = new McpServer(
    { name: "marketingovo", version: "1.1.0" },
    {
      instructions:
        "Use start tools only after identifying the project and reading its context resource. Runs are asynchronous: call marketingovo_run_get until terminal, then summarize evidence, confidence, effort, and the five highest-value actions. Respect ignored and false-positive classifications exposed by the project issue-review resource. Never ask for or transmit credentials through tools.\n\nTo answer a marketer typing at the dashboard terminal, run this loop: marketingovo_session_list to find the session, marketingovo_session_attach to claim it, then marketingovo_session_wait to receive each turn. Answer with marketingovo_session_say, using kind 'thought' to narrate long work so the terminal does not look frozen, and kind 'message' for the answer itself. Keep polling with marketingovo_session_wait — it renews your lease, and an empty result simply means nobody has typed yet. Stop and discard the current answer when a wait returns cancel_requested. Call marketingovo_session_detach when the conversation ends.",
    },
  );

  server.registerTool(
    AgentAuditStartTool.name,
    {
      title: AgentAuditStartTool.title,
      description: AgentAuditStartTool.description,
      inputSchema: auditStartInputSchema,
      annotations: {
        title: AgentAuditStartTool.title,
        ...AgentAuditStartTool.annotations,
      },
    },
    async ({ project_id, goal, render_mode, collect_vitals, max_urls }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "audit",
          goal,
          options: {
            renderMode: render_mode ?? "static",
            collectVitals: collect_vitals ?? false,
            ...(max_urls !== undefined ? { maxUrls: max_urls } : {}),
          },
        }),
      ),
  );

  server.registerTool(
    AgentRunGetTool.name,
    {
      title: AgentRunGetTool.title,
      description: AgentRunGetTool.description,
      inputSchema: runGetInputSchema,
      annotations: {
        title: AgentRunGetTool.title,
        ...AgentRunGetTool.annotations,
      },
    },
    async ({ run_id, include_issues }) => {
      const run = await client.runs.get(run_id);
      const terminal = ["succeeded", "partial"].includes(run.status);
      const issues =
        include_issues !== false && terminal
          ? await client.runs.issues(run_id)
          : [];
      let result: unknown = null;
      if (terminal && run.workflowId !== "audit") {
        try {
          const bytes = await client.reports.get(run_id, "json");
          result = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          // A terminal legacy run may predate persisted research reports.
        }
      }
      return textResult({
        run,
        issues,
        ...(result === null ? {} : { result }),
      });
    },
  );

  server.registerTool(
    AgentRunEvidenceTool.name,
    {
      title: AgentRunEvidenceTool.title,
      description: AgentRunEvidenceTool.description,
      inputSchema: runEvidenceInputSchema,
      annotations: {
        title: AgentRunEvidenceTool.title,
        ...AgentRunEvidenceTool.annotations,
      },
    },
    async ({ run_id, section, search, limit, offset }) =>
      textResult(
        await client.runs.evidence(run_id, {
          section: section ?? "crawl",
          ...(search === undefined ? {} : { search }),
          ...(limit === undefined ? {} : { limit }),
          ...(offset === undefined ? {} : { offset }),
        }),
      ),
  );

  server.registerTool(
    AgentRunLinksTool.name,
    {
      title: AgentRunLinksTool.title,
      description: AgentRunLinksTool.description,
      inputSchema: runLinksInputSchema,
      annotations: {
        title: AgentRunLinksTool.title,
        ...AgentRunLinksTool.annotations,
      },
    },
    async ({ run_id, page_url, direction, search, limit, offset }) =>
      textResult(
        await client.runs.links(run_id, {
          pageUrl: page_url,
          direction: direction ?? "inlinks",
          ...(search === undefined ? {} : { search }),
          ...(limit === undefined ? {} : { limit }),
          ...(offset === undefined ? {} : { offset }),
        }),
      ),
  );

  server.registerTool(
    AgentRunCompareTool.name,
    {
      title: AgentRunCompareTool.title,
      description: AgentRunCompareTool.description,
      inputSchema: runCompareInputSchema,
      annotations: {
        title: AgentRunCompareTool.title,
        ...AgentRunCompareTool.annotations,
      },
    },
    async ({ run_id, baseline_run_id }) =>
      textResult(await client.runs.compare(run_id, baseline_run_id)),
  );

  server.registerTool(
    AgentCompareStartTool.name,
    {
      title: AgentCompareStartTool.title,
      description: AgentCompareStartTool.description,
      inputSchema: compareStartInputSchema,
      annotations: {
        title: AgentCompareStartTool.title,
        ...AgentCompareStartTool.annotations,
      },
    },
    async ({ project_id, competitor_urls, max_urls }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "compare",
          options: {
            competitorUrls: competitor_urls,
            maxUrls: max_urls ?? 30,
          },
        }),
      ),
  );

  server.registerTool(
    AgentKeywordResearchStartTool.name,
    {
      title: AgentKeywordResearchStartTool.title,
      description: AgentKeywordResearchStartTool.description,
      inputSchema: keywordResearchStartInputSchema,
      annotations: {
        title: AgentKeywordResearchStartTool.title,
        ...AgentKeywordResearchStartTool.annotations,
      },
    },
    async ({ project_id, seed }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "keyword-research",
          options: { seed },
        }),
      ),
  );

  server.registerTool(
    AgentContentPlanStartTool.name,
    {
      title: AgentContentPlanStartTool.title,
      description: AgentContentPlanStartTool.description,
      inputSchema: contentPlanStartInputSchema,
      annotations: {
        title: AgentContentPlanStartTool.title,
        ...AgentContentPlanStartTool.annotations,
      },
    },
    async ({ project_id, seeds }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "content-plan",
          options: { seeds },
        }),
      ),
  );

  server.registerTool(
    AgentMonitoringStatusTool.name,
    {
      title: AgentMonitoringStatusTool.title,
      description: AgentMonitoringStatusTool.description,
      inputSchema: monitoringStatusInputSchema,
      annotations: {
        title: AgentMonitoringStatusTool.title,
        ...AgentMonitoringStatusTool.annotations,
      },
    },
    async ({ project_id }) =>
      textResult({
        health: await client.health(),
        schedules: await client.schedules.list(project_id),
        runs: (await client.runs.list(project_id)).slice(0, 10),
      }),
  );

  /* ------------------------------------------------------------------ */
  /* Terminal sessions                                                   */
  /*                                                                     */
  /* These five turn this MCP server into the answering half of the      */
  /* dashboard's console. The loop an agent runs is: list → attach →     */
  /* wait → (work) → say → wait again. `wait` doubles as the lease       */
  /* heartbeat, so an agent that stops polling releases the session      */
  /* rather than holding it hostage.                                     */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    AgentSessionListTool.name,
    {
      title: AgentSessionListTool.title,
      description: AgentSessionListTool.description,
      inputSchema: sessionListInputSchema,
      annotations: {
        title: AgentSessionListTool.title,
        ...AgentSessionListTool.annotations,
      },
    },
    async () => textResult(await client.terminal.list()),
  );

  server.registerTool(
    AgentSessionAttachTool.name,
    {
      title: AgentSessionAttachTool.title,
      description: AgentSessionAttachTool.description,
      inputSchema: sessionAttachInputSchema,
      annotations: {
        title: AgentSessionAttachTool.title,
        ...AgentSessionAttachTool.annotations,
      },
    },
    async ({ session_id, label, harness }) =>
      textResult(
        await client.terminal.attach(session_id, {
          label,
          harness: harness ?? "mcp",
        }),
      ),
  );

  server.registerTool(
    AgentSessionWaitTool.name,
    {
      title: AgentSessionWaitTool.title,
      description: AgentSessionWaitTool.description,
      inputSchema: sessionWaitInputSchema,
      annotations: {
        title: AgentSessionWaitTool.title,
        ...AgentSessionWaitTool.annotations,
      },
    },
    async ({ session_id, agent_id, wait_ms }) =>
      textResult(
        await client.terminal.wait(session_id, agent_id, wait_ms ?? 20_000),
      ),
  );

  server.registerTool(
    AgentSessionSayTool.name,
    {
      title: AgentSessionSayTool.title,
      description: AgentSessionSayTool.description,
      inputSchema: sessionSayInputSchema,
      annotations: {
        title: AgentSessionSayTool.title,
        ...AgentSessionSayTool.annotations,
      },
    },
    async ({ session_id, agent_id, text, kind, tool }) =>
      textResult(
        await client.terminal.say(session_id, {
          agentId: agent_id,
          text,
          kind: kind ?? "message",
          ...(tool ? { tool } : {}),
        }),
      ),
  );

  server.registerTool(
    AgentSessionDetachTool.name,
    {
      title: AgentSessionDetachTool.title,
      description: AgentSessionDetachTool.description,
      inputSchema: sessionDetachInputSchema,
      annotations: {
        title: AgentSessionDetachTool.title,
        ...AgentSessionDetachTool.annotations,
      },
    },
    async ({ session_id, agent_id }) => {
      await client.terminal.detach(session_id, agent_id);
      return textResult({ detached: true, sessionId: session_id });
    },
  );

  server.registerResource(
    "marketingovo-run",
    new ResourceTemplate("marketingovo://runs/{id}", {
      list: async () => ({
        resources: (await client.runs.list()).slice(0, 100).map((run) => ({
          uri: `marketingovo://runs/${run.id}`,
          name: `${run.workflowId} — ${run.status}`,
        })),
      }),
    }),
    {
      title: "Marketingovo run",
      description: "Canonical local run and issue state",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              run: await client.runs.get(String(id)),
              issues: await client.runs.issues(String(id)),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "marketingovo-run-report",
    new ResourceTemplate("marketingovo://runs/{id}/report", {
      list: undefined,
    }),
    {
      title: "Marketingovo run report",
      description: "Agent-ready run summary with top issues",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const run = await client.runs.get(String(id));
      const issues = await client.runs.issues(String(id));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              { run, topIssues: issues.slice(0, 25) },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "marketingovo-project-overview",
    new ResourceTemplate("marketingovo://projects/{id}/overview", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/overview`,
          name: project.name,
        })),
      }),
    }),
    {
      title: "Marketingovo project overview",
      description: "Marketer overview and prioritized actions",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.projects.overview(String(id)),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "marketingovo-project-issues",
    new ResourceTemplate("marketingovo://projects/{id}/issues", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/issues`,
          name: `${project.name} — issue review`,
        })),
      }),
    }),
    {
      title: "Marketingovo project issue review",
      description:
        "Latest project findings with evidence, occurrence counts, and marketer adjudications",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.issues.list(String(id), { limit: 250, offset: 0 }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "marketingovo-project-context",
    new ResourceTemplate("marketingovo://projects/{id}/context", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/context`,
          name: `${project.name} — business and SEO context`,
        })),
      }),
    }),
    {
      title: "Marketingovo project context",
      description:
        "Versioned business profile and append-only marketer decision journal",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await client.context.get(String(id)), null, 2),
        },
      ],
    }),
  );

  return server;
}
