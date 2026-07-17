import { Type, type Static, type TSchema } from "@sinclair/typebox";

/**
 * Agent adapters deliberately expose workflow-level operations only. This is
 * the single source of truth for their names, descriptions, input validation,
 * and safety annotations. MCP and OpenClaw project these JSON Schemas into
 * their native validator formats at runtime.
 */

const strictObject = <Properties extends Record<string, TSchema>>(
  properties: Properties,
) => Type.Object(properties, { additionalProperties: false });

export const AgentAuditStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  goal: Type.Optional(Type.String({ maxLength: 240 })),
  render_mode: Type.Optional(
    Type.Union([Type.Literal("static"), Type.Literal("js")], {
      default: "static",
    }),
  ),
  collect_vitals: Type.Optional(Type.Boolean({ default: false })),
  max_urls: Type.Optional(Type.Integer({ minimum: 1, maximum: 100_000 })),
});

export const AgentRunGetInputSchema = strictObject({
  run_id: Type.String({ minLength: 1 }),
  include_issues: Type.Optional(Type.Boolean({ default: true })),
});

export const AgentCompareStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  competitor_urls: Type.Array(
    Type.String({ format: "uri", pattern: "^https?://" }),
    { minItems: 1, maxItems: 5 },
  ),
  max_urls: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 1_000, default: 30 }),
  ),
});

export const AgentKeywordResearchStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  seed: Type.String({ minLength: 1, maxLength: 240 }),
});

export const AgentContentPlanStartInputSchema = strictObject({
  project_id: Type.String({ minLength: 1 }),
  seeds: Type.Array(Type.String({ minLength: 1, maxLength: 240 }), {
    minItems: 1,
    maxItems: 10,
  }),
});

export const AgentMonitoringStatusInputSchema = strictObject({
  project_id: Type.Optional(Type.String({ minLength: 1 })),
});

export type AgentAuditStartInput = Static<typeof AgentAuditStartInputSchema>;
export type AgentRunGetInput = Static<typeof AgentRunGetInputSchema>;
export type AgentCompareStartInput = Static<
  typeof AgentCompareStartInputSchema
>;
export type AgentKeywordResearchStartInput = Static<
  typeof AgentKeywordResearchStartInputSchema
>;
export type AgentContentPlanStartInput = Static<
  typeof AgentContentPlanStartInputSchema
>;
export type AgentMonitoringStatusInput = Static<
  typeof AgentMonitoringStatusInputSchema
>;

export interface AgentToolSafetyAnnotations {
  readonly readOnlyHint?: boolean;
  readonly destructiveHint: false;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

interface AgentToolContract<Schema extends TSchema = TSchema> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly optional: boolean;
  readonly inputSchema: Schema;
  readonly annotations: AgentToolSafetyAnnotations;
}

const agentTool = <const Contract extends AgentToolContract>(
  contract: Contract,
): Contract => contract;

export const AgentAuditStartTool = agentTool({
  name: "agentseo_audit_start",
  title: "Start SEO audit",
  description:
    "Start a static or JavaScript audit for an existing local project. Returns immediately with a run id.",
  optional: true,
  inputSchema: AgentAuditStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentRunGetTool = agentTool({
  name: "agentseo_run_get",
  title: "Get SEO run",
  description:
    "Read current run state and, when finished, its canonical issues. Safe to replay.",
  optional: false,
  inputSchema: AgentRunGetInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const AgentCompareStartTool = agentTool({
  name: "agentseo_compare_start",
  title: "Start competitor comparison",
  description:
    "Compare a project to one or more public competitor URLs using the same bounded crawl settings.",
  optional: true,
  inputSchema: AgentCompareStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentKeywordResearchStartTool = agentTool({
  name: "agentseo_keyword_research_start",
  title: "Start keyword research",
  description:
    "Expand a seed across configured sources, classify intent, and evaluate momentum. Returns a run id.",
  optional: true,
  inputSchema: AgentKeywordResearchStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentContentPlanStartTool = agentTool({
  name: "agentseo_content_plan_start",
  title: "Start content plan",
  description:
    "Build keyword profiles and topic clusters for up to ten seed topics. Returns a run id.",
  optional: true,
  inputSchema: AgentContentPlanStartInputSchema,
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const);

export const AgentMonitoringStatusTool = agentTool({
  name: "agentseo_monitoring_status",
  title: "Read monitoring status",
  description:
    "Read schedules, recent runs, and runtime health without changing configuration.",
  optional: false,
  inputSchema: AgentMonitoringStatusInputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const);

export const PUBLIC_AGENT_TOOL_CONTRACTS = [
  AgentAuditStartTool,
  AgentRunGetTool,
  AgentCompareStartTool,
  AgentKeywordResearchStartTool,
  AgentContentPlanStartTool,
  AgentMonitoringStatusTool,
] as const;

export type PublicAgentToolContract =
  (typeof PUBLIC_AGENT_TOOL_CONTRACTS)[number];
export type PublicAgentToolName = PublicAgentToolContract["name"];

export const PUBLIC_AGENT_TOOL_NAMES: readonly PublicAgentToolName[] =
  PUBLIC_AGENT_TOOL_CONTRACTS.map((contract) => contract.name);
