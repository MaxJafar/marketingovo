import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  AgentCompareStartTool,
  AgentEntityGetTool,
  AgentMonitoringStatusTool,
  AgentResearchStartTool,
  AgentRunGetTool,
  AgentSearchTool,
  PUBLIC_AGENT_TOOL_NAMES,
  type CompareStartInput,
  type EntityGetInput,
  type MonitoringStatusInput,
  type ResearchStartInput,
  type RunGetInput,
  type SearchInput,
} from "@golem-intel/contracts/agent-tools";
import { type GolemIntelClient } from "@golem-intel/sdk";
import { clientFromTokenFile } from "@golem-intel/sdk/node";

export const PUBLIC_TOOL_NAMES = PUBLIC_AGENT_TOOL_NAMES;

const toZod = <Value>(schema: unknown): z.ZodType<Value> =>
  z.fromJSONSchema(
    schema as Parameters<typeof z.fromJSONSchema>[0],
  ) as z.ZodType<Value>;

const researchSchema = toZod<ResearchStartInput>(
  AgentResearchStartTool.inputSchema,
);
const compareSchema = toZod<CompareStartInput>(
  AgentCompareStartTool.inputSchema,
);
const runSchema = toZod<RunGetInput>(AgentRunGetTool.inputSchema);
const searchSchema = toZod<SearchInput>(AgentSearchTool.inputSchema);
const entitySchema = toZod<EntityGetInput>(AgentEntityGetTool.inputSchema);
const monitoringSchema = toZod<MonitoringStatusInput>(
  AgentMonitoringStatusTool.inputSchema,
);

export interface GolemIntelMcpOptions {
  client?: GolemIntelClient;
  baseUrl?: string;
  tokenFile?: string;
}

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export function createGolemIntelMcpToolHandlers(client: GolemIntelClient) {
  return {
    researchStart: async ({
      project_id,
      question,
      target_ids,
      source_budget,
    }: ResearchStartInput) =>
      textResult(
        await client.research.start({
          project_id,
          question,
          target_ids,
          source_budget: source_budget ?? 20,
        }),
      ),

    compareStart: async ({
      project_id,
      target_ids,
      goal,
      connector_ids,
    }: CompareStartInput) =>
      textResult(
        await client.comparisons.start({
          project_id,
          target_ids,
          ...(goal ? { goal } : {}),
          connector_ids: connector_ids ?? ["fixture.competitive-pulse"],
          simulate: "none",
        }),
      ),

    runGet: async ({ run_id, include_report }: RunGetInput) => {
      const run = await client.runs.get(run_id);
      const report =
        include_report !== false && run.report_available
          ? await client.runs.report(run_id)
          : undefined;
      return textResult({ run, ...(report ? { report } : {}) });
    },

    search: async ({ q, limit }: SearchInput) =>
      textResult(await client.search(q, limit)),

    entityGet: async ({ entity_id }: EntityGetInput) =>
      textResult(await client.entity(entity_id)),

    monitoringStatus: async (_input: MonitoringStatusInput) =>
      textResult(await client.monitoringStatus()),
  };
}

export async function createGolemIntelMcpServer(
  options: GolemIntelMcpOptions = {},
): Promise<McpServer> {
  const client =
    options.client ??
    (await clientFromTokenFile(options.tokenFile, {
      baseUrl: options.baseUrl ?? process.env.GOLEM_INTEL_API_URL,
    }));

  const server = new McpServer(
    { name: "golem-intel", version: "0.1.0-alpha.0" },
    {
      instructions:
        "Golem Intel is an evidence system. Start collection only for public, user-authorized, or licensed business sources. Poll asynchronous runs until terminal. Distinguish observed, derived, estimated, unavailable, and contradictory evidence; cite source records and exact metric definitions. Never request credentials, reveal contacts, change policy, perform outreach, merge people by name, or make employment decisions through these tools.",
    },
  );
  const handlers = createGolemIntelMcpToolHandlers(client);

  server.registerTool(
    AgentResearchStartTool.name,
    {
      title: AgentResearchStartTool.title,
      description: AgentResearchStartTool.description,
      inputSchema: researchSchema,
      annotations: AgentResearchStartTool.annotations,
    },
    handlers.researchStart,
  );

  server.registerTool(
    AgentCompareStartTool.name,
    {
      title: AgentCompareStartTool.title,
      description: AgentCompareStartTool.description,
      inputSchema: compareSchema,
      annotations: AgentCompareStartTool.annotations,
    },
    handlers.compareStart,
  );

  server.registerTool(
    AgentRunGetTool.name,
    {
      title: AgentRunGetTool.title,
      description: AgentRunGetTool.description,
      inputSchema: runSchema,
      annotations: AgentRunGetTool.annotations,
    },
    handlers.runGet,
  );

  server.registerTool(
    AgentSearchTool.name,
    {
      title: AgentSearchTool.title,
      description: AgentSearchTool.description,
      inputSchema: searchSchema,
      annotations: AgentSearchTool.annotations,
    },
    handlers.search,
  );

  server.registerTool(
    AgentEntityGetTool.name,
    {
      title: AgentEntityGetTool.title,
      description: AgentEntityGetTool.description,
      inputSchema: entitySchema,
      annotations: AgentEntityGetTool.annotations,
    },
    handlers.entityGet,
  );

  server.registerTool(
    AgentMonitoringStatusTool.name,
    {
      title: AgentMonitoringStatusTool.title,
      description: AgentMonitoringStatusTool.description,
      inputSchema: monitoringSchema,
      annotations: AgentMonitoringStatusTool.annotations,
    },
    handlers.monitoringStatus,
  );

  server.registerResource(
    "golem-intel-run",
    new ResourceTemplate("golem-intel://runs/{id}", {
      list: async () => ({
        resources: (await client.runs.list()).slice(0, 100).map((run) => ({
          uri: `golem-intel://runs/${run.id}`,
          name: `${run.workflow} — ${run.status}`,
        })),
      }),
    }),
    {
      title: "Golem Intel run",
      description: "Durable run state and committed evidence inventory",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await client.runs.get(String(id)), null, 2),
        },
      ],
    }),
  );

  return server;
}
