import { join } from "node:path";
import { homedir } from "node:os";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type, type TSchema } from "typebox";
import {
  AgentAuditStartTool,
  AgentCompareStartTool,
  AgentContentPlanStartTool,
  AgentKeywordResearchStartTool,
  AgentMonitoringStatusTool,
  AgentOsintResearchStartTool,
  AgentRunCompareTool,
  AgentRunEvidenceTool,
  AgentRunGetTool,
  AgentRunLinksTool,
  type AgentAuditStartInput,
  type AgentCompareStartInput,
  type AgentContentPlanStartInput,
  type AgentKeywordResearchStartInput,
  type AgentMonitoringStatusInput,
  type AgentOsintResearchStartInput,
  type AgentRunCompareInput,
  type AgentRunEvidenceInput,
  type AgentRunGetInput,
  type AgentRunLinksInput,
} from "@marketingovo/contracts/agent-tools";
import { MarketingovoClient } from "@marketingovo/sdk";

const toOpenClawInputSchema = <Value>(schema: unknown) =>
  Type.Unsafe<Value>(schema as TSchema);

const auditStartInputSchema = toOpenClawInputSchema<AgentAuditStartInput>(
  AgentAuditStartTool.inputSchema,
);
const runGetInputSchema = toOpenClawInputSchema<AgentRunGetInput>(
  AgentRunGetTool.inputSchema,
);
const runEvidenceInputSchema = toOpenClawInputSchema<AgentRunEvidenceInput>(
  AgentRunEvidenceTool.inputSchema,
);
const runLinksInputSchema = toOpenClawInputSchema<AgentRunLinksInput>(
  AgentRunLinksTool.inputSchema,
);
const runCompareInputSchema = toOpenClawInputSchema<AgentRunCompareInput>(
  AgentRunCompareTool.inputSchema,
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
const osintResearchStartInputSchema =
  toOpenClawInputSchema<AgentOsintResearchStartInput>(
    AgentOsintResearchStartTool.inputSchema,
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
        description: "Marketingovo loopback API URL.",
      }),
    ),
    tokenFile: Type.Optional(
      Type.String({
        description: "Path to the local Marketingovo service-token file.",
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
  // Keep the durable 1.x root readable until the storage migration owns the
  // default-path cutover; the adapter's visible identity is Marketingovo.
  if (process.platform === "darwin")
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Marketingovo",
      "service-token",
    );
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "Marketingovo",
      "service-token",
    );
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "marketingovo",
    "service-token",
  );
}

type Config = { serverUrl?: string; tokenFile?: string; timeoutMs?: number };
function client(config: Config): Promise<MarketingovoClient> {
  const tokenFile = config.tokenFile ?? defaultTokenFile();
  const serverUrl = config.serverUrl ?? "http://127.0.0.1:3210/api/v1";
  // Read the service token for every invocation so rotation or deletion takes
  // effect without restarting the OpenClaw Gateway.
  return MarketingovoClient.fromTokenFile(tokenFile, {
    baseUrl: serverUrl,
    timeoutMs: config.timeoutMs,
  });
}

export default defineToolPlugin({
  id: "marketingovo",
  name: "Marketingovo",
  description:
    "Run local SEO audits, comparisons, keyword research, content plans, public-web OSINT research, evidence inspection, and monitoring through bounded workflow-level tools.",
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
      name: AgentRunEvidenceTool.name,
      label: AgentRunEvidenceTool.title,
      description: AgentRunEvidenceTool.description,
      optional: AgentRunEvidenceTool.optional,
      parameters: runEvidenceInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.evidence(params.run_id, {
          section: params.section ?? "crawl",
          ...(params.search === undefined ? {} : { search: params.search }),
          ...(params.limit === undefined ? {} : { limit: params.limit }),
          ...(params.offset === undefined ? {} : { offset: params.offset }),
        });
      },
    }),
    tool({
      name: AgentRunLinksTool.name,
      label: AgentRunLinksTool.title,
      description: AgentRunLinksTool.description,
      optional: AgentRunLinksTool.optional,
      parameters: runLinksInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.links(params.run_id, {
          pageUrl: params.page_url,
          direction: params.direction ?? "inlinks",
          ...(params.search === undefined ? {} : { search: params.search }),
          ...(params.limit === undefined ? {} : { limit: params.limit }),
          ...(params.offset === undefined ? {} : { offset: params.offset }),
        });
      },
    }),
    tool({
      name: AgentRunCompareTool.name,
      label: AgentRunCompareTool.title,
      description: AgentRunCompareTool.description,
      optional: AgentRunCompareTool.optional,
      parameters: runCompareInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.compare(
          params.run_id,
          params.baseline_run_id,
        );
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
      name: AgentOsintResearchStartTool.name,
      label: AgentOsintResearchStartTool.title,
      description: AgentOsintResearchStartTool.description,
      optional: AgentOsintResearchStartTool.optional,
      parameters: osintResearchStartInputSchema,
      async execute(params, config) {
        return (await client(config)).runs.start({
          projectId: params.project_id,
          workflowId: "osint-research",
          options: {
            ...(params.target_urls ? { targetUrls: params.target_urls } : {}),
            ...(params.max_urls !== undefined
              ? { maxUrls: params.max_urls }
              : {}),
          },
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
