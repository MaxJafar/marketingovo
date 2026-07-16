import { homedir } from "node:os";
import { join } from "node:path";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type, type TSchema } from "typebox";
import {
  AgentAuditStartTool,
  AgentCompareStartTool,
  AgentContentPlanStartTool,
  AgentKeywordResearchStartTool,
  AgentMonitoringStatusTool,
  AgentRunGetTool,
  type AgentAuditStartInput,
  type AgentCompareStartInput,
  type AgentContentPlanStartInput,
  type AgentKeywordResearchStartInput,
  type AgentMonitoringStatusInput,
  type AgentRunGetInput,
} from "@agentseoapp/contracts/agent-tools";
import { GolemSeoClient } from "@agentseoapp/sdk";

const toOpenClawInputSchema = <Value>(schema: unknown) =>
  Type.Unsafe<Value>(schema as TSchema);

const auditStartInputSchema = toOpenClawInputSchema<AgentAuditStartInput>(
  AgentAuditStartTool.inputSchema,
);
const runGetInputSchema = toOpenClawInputSchema<AgentRunGetInput>(
  AgentRunGetTool.inputSchema,
);
const compareStartInputSchema = toOpenClawInputSchema<AgentCompareStartInput>(
  AgentCompareStartTool.inputSchema,
);
const keywordResearchStartInputSchema =
  toOpenClawInputSchema<AgentKeywordResearchStartInput>(
    AgentKeywordResearchStartTool.inputSchema,
  );
const contentPlanStartInputSchema =
  toOpenClawInputSchema<AgentContentPlanStartInput>(
    AgentContentPlanStartTool.inputSchema,
  );
const monitoringStatusInputSchema =
  toOpenClawInputSchema<AgentMonitoringStatusInput>(
    AgentMonitoringStatusTool.inputSchema,
  );

const configSchema = Type.Object(
  {
    serverUrl: Type.Optional(
      Type.String({
        default: "http://127.0.0.1:3210/api/v1",
        description: "Golem SEO loopback API URL.",
      }),
    ),
    tokenFile: Type.Optional(
      Type.String({
        description: "Path to the local Golem SEO service-token file.",
      }),
    ),
    timeoutMs: Type.Optional(
      Type.Number({
        minimum: 1000,
        maximum: 120000,
        default: 30000,
        description: "Request timeout in milliseconds.",
      }),
    ),
  },
  { additionalProperties: false },
);

function defaultTokenFile(): string {
  if (process.platform === "darwin")
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Golem SEO",
      "service-token",
    );
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "Golem SEO",
      "service-token",
    );
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "golem-seo",
    "service-token",
  );
}

type Config = { serverUrl?: string; tokenFile?: string; timeoutMs?: number };
function client(config: Config): Promise<GolemSeoClient> {
  const tokenFile = config.tokenFile ?? defaultTokenFile();
  const serverUrl = config.serverUrl ?? "http://127.0.0.1:3210/api/v1";
  // Read the service token for every invocation so rotation or deletion takes
  // effect without restarting the OpenClaw Gateway.
  return GolemSeoClient.fromTokenFile(tokenFile, {
    baseUrl: serverUrl,
    timeoutMs: config.timeoutMs,
  });
}

export default defineToolPlugin({
  id: "golem-seo",
  name: "Golem SEO",
  description:
    "Run local SEO audits, comparisons, keyword research, content plans, and monitoring through six workflow-level tools.",
  configSchema,
  tools: (tool) => [
    tool({
      name: AgentAuditStartTool.name,
      label: AgentAuditStartTool.title,
      description: AgentAuditStartTool.description,
      optional: AgentAuditStartTool.optional,
      parameters: auditStartInputSchema,
      async execute(params, config, context) {
        context.signal?.throwIfAborted();
        return (await client(config)).runs.start({
          projectId: params.project_id,
          workflowId: "audit",
          goal: params.goal,
          options: {
            renderMode: params.render_mode ?? "static",
            collectVitals: params.collect_vitals ?? false,
            ...(params.max_urls !== undefined
              ? { maxUrls: params.max_urls }
              : {}),
          },
        });
      },
    }),
    tool({
      name: AgentRunGetTool.name,
      label: AgentRunGetTool.title,
      description: AgentRunGetTool.description,
      optional: AgentRunGetTool.optional,
      parameters: runGetInputSchema,
      async execute(params, config) {
        const api = await client(config);
        const run = await api.runs.get(params.run_id);
        const includeIssues =
          params.include_issues !== false &&
          ["succeeded", "partial"].includes(run.status);
        return {
          run,
          issues: includeIssues ? await api.runs.issues(params.run_id) : [],
        };
      },
    }),
    tool({
      name: AgentCompareStartTool.name,
      label: AgentCompareStartTool.title,
      description: AgentCompareStartTool.description,
      optional: AgentCompareStartTool.optional,
      parameters: compareStartInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.start({
          projectId: params.project_id,
          workflowId: "compare",
          options: {
            competitorUrls: params.competitor_urls,
            maxUrls: params.max_urls ?? 30,
          },
        });
      },
    }),
    tool({
      name: AgentKeywordResearchStartTool.name,
      label: AgentKeywordResearchStartTool.title,
      description: AgentKeywordResearchStartTool.description,
      optional: AgentKeywordResearchStartTool.optional,
      parameters: keywordResearchStartInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.start({
          projectId: params.project_id,
          workflowId: "keyword-research",
          options: { seed: params.seed },
        });
      },
    }),
    tool({
      name: AgentContentPlanStartTool.name,
      label: AgentContentPlanStartTool.title,
      description: AgentContentPlanStartTool.description,
      optional: AgentContentPlanStartTool.optional,
      parameters: contentPlanStartInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.start({
          projectId: params.project_id,
          workflowId: "content-plan",
          options: { seeds: params.seeds },
        });
      },
    }),
    tool({
      name: AgentMonitoringStatusTool.name,
      label: AgentMonitoringStatusTool.title,
      description: AgentMonitoringStatusTool.description,
      optional: AgentMonitoringStatusTool.optional,
      parameters: monitoringStatusInputSchema,
      async execute(params, config) {
        const api = await client(config);
        return {
          health: await api.health(),
          schedules: await api.schedules.list(params.project_id),
          runs: (await api.runs.list(params.project_id)).slice(0, 10),
        };
      },
    }),
  ],
});
