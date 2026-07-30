import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type, type Static, type TSchema } from "typebox";
import {
  AgentCompareStartTool,
  AgentEntityGetTool,
  AgentMonitoringStatusTool,
  AgentResearchStartTool,
  AgentRunGetTool,
  AgentSearchTool,
  type CompareStartInput,
  type EntityGetInput,
  type MonitoringStatusInput,
  type ResearchStartInput,
  type RunGetInput,
  type SearchInput,
} from "@agentintel/contracts/agent-tools";
import type { AgentIntelClient } from "@agentintel/sdk";
import {
  clientFromTokenFile,
  defaultAgentIntelDataDirectory,
} from "@agentintel/sdk/node";
import { join } from "node:path";

const unsafeSchema = <Value>(schema: unknown) =>
  Type.Unsafe<Value>(schema as TSchema);

const configSchema = Type.Object(
  {
    serverUrl: Type.Optional(
      Type.String({
        default: "http://127.0.0.1:7465",
        description: "AGENTintel loopback API URL.",
      }),
    ),
    tokenFile: Type.Optional(
      Type.String({ description: "Path to the local service-token file." }),
    ),
    timeoutMs: Type.Optional(
      Type.Number({ minimum: 1000, maximum: 120000, default: 30000 }),
    ),
  },
  { additionalProperties: false },
);

export type AgentIntelOpenClawConfig = {
  serverUrl?: string;
  tokenFile?: string;
  timeoutMs?: number;
};

export interface AgentIntelOpenClawExecutionContext {
  signal?: AbortSignal;
}

export interface AgentIntelOpenClawToolBuilder {
  <ParametersSchema extends TSchema>(definition: {
    name: string;
    label?: string;
    description: string;
    optional?: boolean;
    parameters: ParametersSchema;
    execute(
      params: Static<ParametersSchema>,
      config: AgentIntelOpenClawConfig,
      context: AgentIntelOpenClawExecutionContext,
    ): unknown | Promise<unknown>;
  }): unknown;
}

export type AgentIntelOpenClawClientFactory = (
  config: AgentIntelOpenClawConfig,
) => Promise<AgentIntelClient>;

const defaultClient: AgentIntelOpenClawClientFactory = (config) =>
  clientFromTokenFile(
    config.tokenFile ?? join(defaultAgentIntelDataDirectory(), "service-token"),
    {
      baseUrl: config.serverUrl,
      timeoutMs: config.timeoutMs,
    },
  );

export function createAgentIntelOpenClawTools(
  tool: AgentIntelOpenClawToolBuilder,
  resolveClient: AgentIntelOpenClawClientFactory = defaultClient,
) {
  return [
    tool({
      name: AgentResearchStartTool.name,
      label: AgentResearchStartTool.title,
      description: AgentResearchStartTool.description,
      optional: true,
      parameters: unsafeSchema<ResearchStartInput>(
        AgentResearchStartTool.inputSchema,
      ),
      async execute(params, config, context) {
        context.signal?.throwIfAborted();
        return (await resolveClient(config)).research.start({
          project_id: params.project_id,
          question: params.question,
          target_ids: params.target_ids,
          source_budget: params.source_budget ?? 20,
        });
      },
    }),
    tool({
      name: AgentCompareStartTool.name,
      label: AgentCompareStartTool.title,
      description: AgentCompareStartTool.description,
      optional: true,
      parameters: unsafeSchema<CompareStartInput>(
        AgentCompareStartTool.inputSchema,
      ),
      async execute(params, config, context) {
        context.signal?.throwIfAborted();
        return (await resolveClient(config)).comparisons.start({
          project_id: params.project_id,
          target_ids: params.target_ids,
          ...(params.goal ? { goal: params.goal } : {}),
          connector_ids: params.connector_ids ?? ["fixture.competitive-pulse"],
          simulate: "none",
        });
      },
    }),
    tool({
      name: AgentRunGetTool.name,
      label: AgentRunGetTool.title,
      description: AgentRunGetTool.description,
      parameters: unsafeSchema<RunGetInput>(AgentRunGetTool.inputSchema),
      async execute(params, config) {
        const api = await resolveClient(config);
        const run = await api.runs.get(params.run_id);
        return {
          run,
          ...(params.include_report !== false && run.report_available
            ? { report: await api.runs.report(params.run_id) }
            : {}),
        };
      },
    }),
    tool({
      name: AgentSearchTool.name,
      label: AgentSearchTool.title,
      description: AgentSearchTool.description,
      parameters: unsafeSchema<SearchInput>(AgentSearchTool.inputSchema),
      async execute(params, config) {
        return (await resolveClient(config)).search(params.q, params.limit);
      },
    }),
    tool({
      name: AgentEntityGetTool.name,
      label: AgentEntityGetTool.title,
      description: AgentEntityGetTool.description,
      parameters: unsafeSchema<EntityGetInput>(AgentEntityGetTool.inputSchema),
      async execute(params, config) {
        return (await resolveClient(config)).entity(params.entity_id);
      },
    }),
    tool({
      name: AgentMonitoringStatusTool.name,
      label: AgentMonitoringStatusTool.title,
      description: AgentMonitoringStatusTool.description,
      parameters: unsafeSchema<MonitoringStatusInput>(
        AgentMonitoringStatusTool.inputSchema,
      ),
      async execute(_params, config) {
        return (await resolveClient(config)).monitoringStatus();
      },
    }),
  ];
}

export default defineToolPlugin({
  id: "agentintel",
  name: "AGENTintel",
  description:
    "Run evidence-backed competitive research through six safe workflow-level tools.",
  configSchema,
  tools: (tool) => createAgentIntelOpenClawTools(tool),
});
