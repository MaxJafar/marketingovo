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
  AgentRunGetTool,
  PUBLIC_AGENT_TOOL_NAMES,
  type AgentAuditStartInput,
  type AgentCompareStartInput,
  type AgentContentPlanStartInput,
  type AgentKeywordResearchStartInput,
  type AgentMonitoringStatusInput,
  type AgentRunGetInput,
} from "@agentseoapp/contracts/agent-tools";
import { AgentSeoClient } from "@agentseoapp/sdk";
import { resolveMcpConnectionEnvironment } from "./compatibility.js";

export const PUBLIC_TOOL_NAMES = PUBLIC_AGENT_TOOL_NAMES;

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

export interface AgentSeoMcpOptions {
  client?: AgentSeoClient;
  baseUrl?: string;
  tokenFile?: string;
}

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

function defaultAgentSeoDataDirectory(): string {
  // Preserve the persisted 1.x data root until the storage migration owns the
  // default-path cutover. Connection environment variables remain canonical.
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "AGENTseo");
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "AGENTseo",
    );
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "agentseo",
  );
}

export async function createAgentSeoMcpServer(
  options: AgentSeoMcpOptions = {},
): Promise<McpServer> {
  let client = options.client;
  if (!client) {
    const connectionEnvironment = resolveMcpConnectionEnvironment();
    client = await AgentSeoClient.fromTokenFile(
      options.tokenFile ??
        connectionEnvironment.tokenFile ??
        join(defaultAgentSeoDataDirectory(), "service-token"),
      { baseUrl: options.baseUrl ?? connectionEnvironment.baseUrl },
    );
  }
  const server = new McpServer(
    { name: "agentseo", version: "0.12.0-alpha.0" },
    {
      instructions:
        "Use start tools only after identifying the project and reading its context resource. Runs are asynchronous: call agentseo_run_get until terminal, then summarize evidence, confidence, effort, and the five highest-value actions. Respect ignored and false-positive classifications exposed by the project issue-review resource. Never ask for or transmit credentials through tools.",
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

  server.registerResource(
    "agentseo-run",
    new ResourceTemplate("agentseo://runs/{id}", {
      list: async () => ({
        resources: (await client.runs.list()).slice(0, 100).map((run) => ({
          uri: `agentseo://runs/${run.id}`,
          name: `${run.workflowId} — ${run.status}`,
        })),
      }),
    }),
    {
      title: "AGENTseo run",
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
    "agentseo-run-report",
    new ResourceTemplate("agentseo://runs/{id}/report", { list: undefined }),
    {
      title: "AGENTseo run report",
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
    "agentseo-project-overview",
    new ResourceTemplate("agentseo://projects/{id}/overview", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `agentseo://projects/${project.id}/overview`,
          name: project.name,
        })),
      }),
    }),
    {
      title: "AGENTseo project overview",
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
    "agentseo-project-issues",
    new ResourceTemplate("agentseo://projects/{id}/issues", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `agentseo://projects/${project.id}/issues`,
          name: `${project.name} — issue review`,
        })),
      }),
    }),
    {
      title: "AGENTseo project issue review",
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
    "agentseo-project-context",
    new ResourceTemplate("agentseo://projects/{id}/context", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `agentseo://projects/${project.id}/context`,
          name: `${project.name} — business and SEO context`,
        })),
      }),
    }),
    {
      title: "AGENTseo project context",
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
