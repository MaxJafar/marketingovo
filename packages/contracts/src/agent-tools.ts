type JsonSchema = Readonly<Record<string, unknown>>;

export interface AgentTool<Input> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
  };
  readonly optional?: boolean;
  readonly _input?: Input;
}

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const startsRun = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export interface ResearchStartInput {
  project_id: string;
  question: string;
  target_ids: string[];
  source_budget?: number;
}

export interface CompareStartInput {
  project_id: string;
  target_ids: string[];
  dataset_id?: string;
  goal?: string;
  connector_ids?: string[];
}

export interface RunGetInput {
  run_id: string;
  include_report?: boolean;
}

export interface SearchInput {
  q: string;
  limit?: number;
}

export interface EntityGetInput {
  entity_id: string;
}

export type MonitoringStatusInput = Record<string, never>;

export const AgentResearchStartTool: AgentTool<ResearchStartInput> = {
  name: "agentintel_research_start",
  title: "Start cited research",
  description:
    "Start an asynchronous public-source research run. Returns immediately with a run id; retrieve it until terminal.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["project_id", "question", "target_ids"],
    properties: {
      project_id: { type: "string", minLength: 1, maxLength: 100 },
      question: { type: "string", minLength: 3, maxLength: 2000 },
      target_ids: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        uniqueItems: true,
        items: { type: "string", minLength: 1, maxLength: 100 },
      },
      source_budget: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  annotations: startsRun,
  optional: true,
};

export const AgentCompareStartTool: AgentTool<CompareStartInput> = {
  name: "agentintel_compare_start",
  title: "Start competitive comparison",
  description:
    "Compare approved fixture evidence or an opaque human-approved imported dataset and return a durable run id.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["project_id", "target_ids"],
    properties: {
      project_id: { type: "string", minLength: 1, maxLength: 100 },
      target_ids: {
        type: "array",
        minItems: 2,
        maxItems: 50,
        uniqueItems: true,
        items: { type: "string", minLength: 1, maxLength: 100 },
      },
      goal: { type: "string", maxLength: 1000 },
      dataset_id: { type: "string", minLength: 1, maxLength: 200 },
      connector_ids: {
        type: "array",
        maxItems: 20,
        uniqueItems: true,
        items: { type: "string" },
      },
    },
  },
  annotations: startsRun,
  optional: true,
};

export const AgentRunGetTool: AgentTool<RunGetInput> = {
  name: "agentintel_run_get",
  title: "Get research run",
  description:
    "Read durable run state, ordered progress events, committed artifacts, and the cited report when available.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["run_id"],
    properties: {
      run_id: { type: "string", minLength: 1 },
      include_report: { type: "boolean", default: true },
    },
  },
  annotations: readOnly,
};

export const AgentSearchTool: AgentTool<SearchInput> = {
  name: "agentintel_search",
  title: "Search local intelligence",
  description:
    "Search committed entities, observations, claims, and reports. Results do not trigger new collection.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["q"],
    properties: {
      q: { type: "string", minLength: 2, maxLength: 200 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  annotations: readOnly,
};

export const AgentEntityGetTool: AgentTool<EntityGetInput> = {
  name: "agentintel_entity_get",
  title: "Get evidence-backed entity",
  description:
    "Read an entity header and its observed identifiers without resolving or merging identities.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["entity_id"],
    properties: { entity_id: { type: "string", minLength: 1 } },
  },
  annotations: readOnly,
};

export const AgentMonitoringStatusTool: AgentTool<MonitoringStatusInput> = {
  name: "agentintel_monitoring_status",
  title: "Inspect collection health",
  description:
    "Read daemon, worker, queue, and connector availability. Missing providers remain unavailable, never zero.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  annotations: readOnly,
};

export const PUBLIC_AGENT_TOOLS = [
  AgentResearchStartTool,
  AgentCompareStartTool,
  AgentRunGetTool,
  AgentSearchTool,
  AgentEntityGetTool,
  AgentMonitoringStatusTool,
] as const;

export const PUBLIC_AGENT_TOOL_NAMES = PUBLIC_AGENT_TOOLS.map(
  (tool) => tool.name,
);
