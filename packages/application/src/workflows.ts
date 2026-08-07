import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { OsintDossierSchema } from "@marketingovo/contracts";
import type {
  ExecutionPlan,
  LeafModuleRegistry,
  Workflow,
  WorkflowRegistry,
} from "@marketingovo/contracts";

export const runtimeWorkflowIds = [
  "audit",
  "compare",
  "keyword-research",
  "content-plan",
  "osint-research",
  "ads-audit",
  "marketing-report",
] as const;
export type RuntimeWorkflowId = (typeof runtimeWorkflowIds)[number];

export const RuntimeWorkflowInputSchema = Type.Object(
  {
    options: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

const AuditWorkflowOutputSchema = Type.Object(
  {
    runId: Type.String({ minLength: 1 }),
    coverage: Type.Number({ minimum: 0, maximum: 1 }),
    report: Type.Object(
      {
        generatedAt: Type.String({ minLength: 1 }),
        startUrl: Type.String({ minLength: 1 }),
        durationMs: Type.Number({ minimum: 0 }),
        summary: Type.Object({}, { additionalProperties: true }),
        issues: Type.Array(Type.Object({}, { additionalProperties: true })),
        pages: Type.Array(
          Type.Object(
            { status: Type.Number() },
            { additionalProperties: true },
          ),
        ),
      },
      { additionalProperties: true },
    ),
  },
  { additionalProperties: true },
);

const CompareOutputSchema = Type.Object(
  {
    generatedAt: Type.String({ minLength: 1 }),
    sites: Type.Array(Type.Object({}, { additionalProperties: true })),
    winners: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: true },
);

const KeywordResearchOutputSchema = Type.Object(
  {
    profile: Type.Object({}, { additionalProperties: true }),
    issues: Type.Array(Type.Unknown()),
  },
  { additionalProperties: true },
);

const ContentPlanOutputSchema = Type.Object(
  {
    generatedAt: Type.String({ minLength: 1 }),
    seeds: Type.Array(Type.String({ minLength: 1 })),
    keywordProfiles: Type.Array(
      Type.Object({}, { additionalProperties: true }),
    ),
    clusters: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: true },
);

/**
 * One entry per cabinet the run touched, including the ones it could not read.
 *
 * A cabinet that failed is present with `state: "failed"` rather than absent.
 * Omitting it would make a partial sync indistinguishable from a workspace
 * that simply has fewer cabinets.
 */
const AdsAuditOutputSchema = Type.Object(
  {
    generatedAt: Type.String({ minLength: 1 }),
    start: Type.String({ minLength: 10, maxLength: 10 }),
    end: Type.String({ minLength: 10, maxLength: 10 }),
    cabinets: Type.Array(
      Type.Object(
        {
          channelAccountId: Type.String({ minLength: 1 }),
          externalId: Type.String({ minLength: 1 }),
          displayName: Type.String(),
          state: Type.Union([
            Type.Literal("available"),
            Type.Literal("partial"),
            Type.Literal("failed"),
          ]),
          reason: Type.Union([Type.String(), Type.Null()]),
          metricsWritten: Type.Integer({ minimum: 0 }),
          issueCount: Type.Integer({ minimum: 0 }),
        },
        { additionalProperties: true },
      ),
    ),
  },
  { additionalProperties: true },
);

/**
 * The stored report, kept loose here on purpose.
 *
 * The authority on a report's shape is `@marketingovo/contracts/reporting`,
 * and restating it in this registry would be a second definition to keep in
 * step. What this schema is for is catching a workflow that returned something
 * structurally wrong before it reaches storage.
 */
const MarketingReportOutputSchema = Type.Object(
  {
    reportId: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    periodStart: Type.String({ minLength: 10, maxLength: 10 }),
    periodEnd: Type.String({ minLength: 10, maxLength: 10 }),
    state: Type.Union([
      Type.Literal("available"),
      Type.Literal("partial"),
      Type.Literal("unavailable"),
      Type.Literal("failed"),
    ]),
    sections: Type.Array(Type.Object({}, { additionalProperties: true })),
    coverageGaps: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);

function researchWorkflowOutput(output: TSchema): TSchema {
  return Type.Object(
    {
      output,
      partial: Type.Boolean(),
    },
    { additionalProperties: false },
  );
}

function singleLeafWorkflow(
  id: RuntimeWorkflowId,
  moduleId: string,
  outputSchema: TSchema,
): Workflow<unknown, unknown> {
  return {
    kind: "workflow",
    id,
    inputSchema: RuntimeWorkflowInputSchema,
    outputSchema,
    createPlan(_input: unknown, registry: LeafModuleRegistry): ExecutionPlan {
      const module = registry.get(moduleId);
      if (!module || module.kind !== "leaf") {
        throw new Error(`Workflow '${id}' requires leaf module '${moduleId}'`);
      }
      return {
        workflowId: id,
        nodes: [{ id: moduleId, moduleId, dependsOn: [], input: {} }],
      };
    },
  };
}

/** Create the canonical, workflow-only runtime registry. */
export function createWorkflowRegistry(): WorkflowRegistry {
  const workflows = [
    singleLeafWorkflow("audit", "core-audit", AuditWorkflowOutputSchema),
    singleLeafWorkflow(
      "compare",
      "research-compare",
      researchWorkflowOutput(CompareOutputSchema),
    ),
    singleLeafWorkflow(
      "keyword-research",
      "research-keyword-research",
      researchWorkflowOutput(KeywordResearchOutputSchema),
    ),
    singleLeafWorkflow(
      "content-plan",
      "research-content-plan",
      researchWorkflowOutput(ContentPlanOutputSchema),
    ),
    singleLeafWorkflow(
      "osint-research",
      "research-osint-research",
      researchWorkflowOutput(OsintDossierSchema),
    ),
    singleLeafWorkflow(
      "ads-audit",
      "research-ads-audit",
      researchWorkflowOutput(AdsAuditOutputSchema),
    ),
    singleLeafWorkflow(
      "marketing-report",
      "research-marketing-report",
      researchWorkflowOutput(MarketingReportOutputSchema),
    ),
  ];
  return new Map(workflows.map((workflow) => [workflow.id, workflow]));
}

export function workflowById(
  registry: WorkflowRegistry,
  id: string,
): Workflow<unknown, unknown> {
  const workflow = registry.get(id);
  if (!workflow) throw new Error(`Unknown workflow '${id}'`);
  return workflow;
}

/** Validate workflow input before allowing createPlan to run. */
export function createWorkflowPlan(
  workflow: Workflow<unknown, unknown>,
  input: unknown,
  leafRegistry: LeafModuleRegistry,
): ExecutionPlan {
  if (!Value.Check(workflow.inputSchema, input)) {
    throw new TypeError(
      `Workflow '${workflow.id}' input failed runtime schema validation`,
    );
  }
  const plan = workflow.createPlan(input, leafRegistry);
  if (plan.workflowId !== workflow.id) {
    throw new Error(
      `Workflow '${workflow.id}' created a plan for '${plan.workflowId}'`,
    );
  }
  for (const node of plan.nodes) {
    const module = leafRegistry.get(node.moduleId);
    if (!module || module.kind !== "leaf") {
      throw new Error(
        `Workflow '${workflow.id}' scheduled unregistered leaf '${node.moduleId}'`,
      );
    }
  }
  return plan;
}

/** Validate the aggregate workflow output before persistence or publication. */
export function validateWorkflowOutput(
  workflow: Workflow<unknown, unknown>,
  output: unknown,
): void {
  if (!Value.Check(workflow.outputSchema, output)) {
    throw new TypeError(
      `Workflow '${workflow.id}' output failed runtime schema validation`,
    );
  }
}
