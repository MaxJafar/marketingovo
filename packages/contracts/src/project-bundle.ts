import { Type, type Static } from "@sinclair/typebox";
import {
  ActionSchema,
  IdentifierSchema,
  IsoDateTimeSchema,
  IssueInstanceSchema,
  IssueAdjudicationSchema,
  MetricValueSchema,
  ModuleStatusSchema,
  ProjectSchema,
  ProjectContextJournalEntrySchema,
  ProjectContextVersionSchema,
  ExtractionRuleSetVersionSchema,
  RunSchema,
  ScheduleSchema,
  UrlSchema,
} from "./index.js";

/**
 * Hard limits are part of the public transfer contract. They keep a local
 * import bounded before any rows or artifacts are written.
 */
export const AGENTSEO_PROJECT_BUNDLE_LIMITS = Object.freeze({
  maxBytes: 25 * 1024 * 1024,
  maxArtifactBytes: 4 * 1024 * 1024,
  maxEmbeddedArtifactBytes: 16 * 1024 * 1024,
  maxRuns: 2_000,
  maxRunConfigurations: 2_000,
  maxRunModules: 50_000,
  maxPages: 250_000,
  maxIssues: 250_000,
  maxIssueAdjudications: 250_000,
  maxContextVersions: 2_000,
  maxContextEntries: 10_000,
  maxExtractionRuleVersions: 2_000,
  maxActions: 100_000,
  maxMetrics: 250_000,
  maxSchedules: 10_000,
  maxConnectors: 100,
  maxArtifacts: 8_000,
} as const);

const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ProjectBundleSettingsSchema = Type.Object(
  {
    timezone: Type.Union([
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.Null(),
    ]),
    reportingCurrency: Type.Union([
      Type.String({ pattern: "^[A-Z]{3}$" }),
      Type.Null(),
    ]),
    weeklyDigest: Type.Boolean(),
    alertEmail: Type.Union([
      Type.String({ minLength: 3, maxLength: 320 }),
      Type.Null(),
    ]),
    dataRetentionDays: Type.Union([
      Type.Integer({ minimum: 1, maximum: 3_650 }),
      Type.Null(),
    ]),
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type ProjectBundleSettings = Static<typeof ProjectBundleSettingsSchema>;

export const ProjectBundleRunConfigurationSchema = Type.Object(
  {
    runId: IdentifierSchema,
    options: Type.Record(Type.String(), Type.Unknown(), {
      maxProperties: 100,
    }),
  },
  { additionalProperties: false },
);
export type ProjectBundleRunConfiguration = Static<
  typeof ProjectBundleRunConfigurationSchema
>;

export const ProjectBundleRunModuleSchema = Type.Object(
  {
    runId: IdentifierSchema,
    moduleId: IdentifierSchema,
    version: Type.String({ minLength: 1, maxLength: 80 }),
    status: ModuleStatusSchema,
    startedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    completedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    durationMs: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    coverage: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    error: Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ProjectBundleRunModule = Static<
  typeof ProjectBundleRunModuleSchema
>;

export const ProjectBundlePageSchema = Type.Object(
  {
    runId: IdentifierSchema,
    canonicalUrl: UrlSchema,
    statusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    title: Type.Union([Type.String({ maxLength: 4_000 }), Type.Null()]),
    indexable: Type.Union([Type.Boolean(), Type.Null()]),
    payload: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);
export type ProjectBundlePage = Static<typeof ProjectBundlePageSchema>;

export const ProjectBundleIssueSchema = Type.Object(
  {
    runId: IdentifierSchema,
    issue: IssueInstanceSchema,
  },
  { additionalProperties: false },
);
export type ProjectBundleIssue = Static<typeof ProjectBundleIssueSchema>;

export const ProjectBundleIssueAdjudicationSchema = IssueAdjudicationSchema;
export type ProjectBundleIssueAdjudication = Static<
  typeof ProjectBundleIssueAdjudicationSchema
>;

export const ProjectBundleContextSchema = Type.Object(
  {
    versions: Type.Array(ProjectContextVersionSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxContextVersions,
    }),
    journal: Type.Array(ProjectContextJournalEntrySchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxContextEntries,
    }),
  },
  { additionalProperties: false },
);
export type ProjectBundleContext = Static<typeof ProjectBundleContextSchema>;

export const ProjectBundleMetricSchema = Type.Object(
  {
    runId: Type.Union([IdentifierSchema, Type.Null()]),
    key: Type.String({ minLength: 1, maxLength: 160 }),
    metric: MetricValueSchema,
  },
  { additionalProperties: false },
);
export type ProjectBundleMetric = Static<typeof ProjectBundleMetricSchema>;

export const ProjectBundleConnectorSchema = Type.Object(
  {
    provider: IdentifierSchema,
    configuration: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);
export type ProjectBundleConnector = Static<
  typeof ProjectBundleConnectorSchema
>;

const EmbeddedArtifactSchema = Type.Object(
  {
    id: IdentifierSchema,
    runId: IdentifierSchema,
    kind: Type.Union([
      Type.Literal("report.json"),
      Type.Literal("report.html"),
      Type.Literal("report.csv"),
      Type.Literal("report.pdf"),
      Type.Literal("run-evidence.json"),
    ]),
    mediaType: Type.String({ minLength: 1, maxLength: 160 }),
    sizeBytes: Type.Integer({
      minimum: 0,
      maximum: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxArtifactBytes,
    }),
    sha256: Sha256Schema,
    contentIncluded: Type.Literal(true),
    contentBase64: Type.String({
      maxLength:
        Math.ceil(AGENTSEO_PROJECT_BUNDLE_LIMITS.maxArtifactBytes / 3) * 4,
      pattern: "^[A-Za-z0-9+/]*={0,2}$",
    }),
  },
  { additionalProperties: false },
);

const OmittedArtifactSchema = Type.Object(
  {
    id: IdentifierSchema,
    runId: IdentifierSchema,
    kind: Type.Union([
      Type.Literal("report.json"),
      Type.Literal("report.html"),
      Type.Literal("report.csv"),
      Type.Literal("report.pdf"),
      Type.Literal("run-evidence.json"),
    ]),
    mediaType: Type.String({ minLength: 1, maxLength: 160 }),
    sizeBytes: Type.Integer({ minimum: 0 }),
    sha256: Type.Union([Sha256Schema, Type.Null()]),
    contentIncluded: Type.Literal(false),
    omittedReason: Type.Union([
      Type.Literal("size_limit"),
      Type.Literal("missing"),
      Type.Literal("unsafe"),
      Type.Literal("checksum_mismatch"),
    ]),
  },
  { additionalProperties: false },
);

export const ProjectBundleArtifactSchema = Type.Union([
  EmbeddedArtifactSchema,
  OmittedArtifactSchema,
]);
export type ProjectBundleArtifact = Static<typeof ProjectBundleArtifactSchema>;

export const ProjectBundleCustomRuleSchema = Type.Object(
  {
    id: IdentifierSchema,
    name: Type.String({ minLength: 1, maxLength: 240 }),
    category: Type.String({ minLength: 1, maxLength: 120 }),
    priority: Type.Union([
      Type.Literal("High"),
      Type.Literal("Medium"),
      Type.Literal("Low"),
    ]),
    match: Type.Union([
      Type.Literal("contains"),
      Type.Literal("regex"),
      Type.Literal("css-exists"),
    ]),
    value: Type.Optional(Type.String({ maxLength: 4_000 })),
    pattern: Type.Optional(Type.String({ maxLength: 512 })),
    selector: Type.Optional(Type.String({ maxLength: 2_000 })),
    expect: Type.Optional(
      Type.Union([Type.Literal("present"), Type.Literal("absent")]),
    ),
    fix: Type.Optional(Type.String({ maxLength: 4_000 })),
  },
  { additionalProperties: false },
);
export type ProjectBundleCustomRule = Static<
  typeof ProjectBundleCustomRuleSchema
>;

export const AgentSeoProjectBundleV2Schema = Type.Object(
  {
    format: Type.Literal("agentseo-project"),
    version: Type.Literal(2),
    exportedAt: IsoDateTimeSchema,
    secretsIncluded: Type.Literal(false),
    project: ProjectSchema,
    settings: Type.Union([ProjectBundleSettingsSchema, Type.Null()]),
    runs: Type.Array(RunSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxRuns,
    }),
    runConfigurations: Type.Optional(
      Type.Array(ProjectBundleRunConfigurationSchema, {
        maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxRunConfigurations,
      }),
    ),
    runModules: Type.Array(ProjectBundleRunModuleSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxRunModules,
    }),
    pages: Type.Array(ProjectBundlePageSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxPages,
    }),
    issues: Type.Array(ProjectBundleIssueSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxIssues,
    }),
    issueAdjudications: Type.Optional(
      Type.Array(ProjectBundleIssueAdjudicationSchema, {
        maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxIssueAdjudications,
      }),
    ),
    projectContext: Type.Optional(ProjectBundleContextSchema),
    extractionRuleVersions: Type.Optional(
      Type.Array(ExtractionRuleSetVersionSchema, {
        maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxExtractionRuleVersions,
      }),
    ),
    actions: Type.Array(ActionSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxActions,
    }),
    metrics: Type.Array(ProjectBundleMetricSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxMetrics,
    }),
    schedules: Type.Array(ScheduleSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxSchedules,
    }),
    connectors: Type.Array(ProjectBundleConnectorSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxConnectors,
    }),
    customRules: Type.Array(ProjectBundleCustomRuleSchema, {
      maxItems: 500,
    }),
    artifacts: Type.Array(ProjectBundleArtifactSchema, {
      maxItems: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxArtifacts,
    }),
    integrity: Type.Object(
      {
        algorithm: Type.Literal("sha256"),
        bundleSha256: Sha256Schema,
        embeddedArtifactBytes: Type.Integer({
          minimum: 0,
          maximum: AGENTSEO_PROJECT_BUNDLE_LIMITS.maxEmbeddedArtifactBytes,
        }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "AgentSeoProjectBundleV2" },
);
export type AgentSeoProjectBundleV2 = Static<
  typeof AgentSeoProjectBundleV2Schema
>;

export const ProjectImportResultSchema = Type.Object(
  {
    project: ProjectSchema,
    sourceProjectId: IdentifierSchema,
    importedAt: IsoDateTimeSchema,
    counts: Type.Object(
      {
        runs: Type.Integer({ minimum: 0 }),
        runModules: Type.Integer({ minimum: 0 }),
        pages: Type.Integer({ minimum: 0 }),
        issues: Type.Integer({ minimum: 0 }),
        issueAdjudications: Type.Integer({ minimum: 0 }),
        contextVersions: Type.Integer({ minimum: 0 }),
        contextEntries: Type.Integer({ minimum: 0 }),
        extractionRuleVersions: Type.Integer({ minimum: 0 }),
        actions: Type.Integer({ minimum: 0 }),
        metrics: Type.Integer({ minimum: 0 }),
        schedules: Type.Integer({ minimum: 0 }),
        connectors: Type.Integer({ minimum: 0 }),
        customRules: Type.Integer({ minimum: 0 }),
        artifacts: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    schedulesDisabled: Type.Literal(true),
    reconnectProviders: Type.Array(IdentifierSchema),
    warnings: Type.Array(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);
export type ProjectImportResult = Static<typeof ProjectImportResultSchema>;
