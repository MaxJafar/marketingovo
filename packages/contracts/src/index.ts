import { Type, type Static, type TSchema } from "@sinclair/typebox";

export const IsoDateTimeSchema = Type.String({ format: "date-time" });
export const IdentifierSchema = Type.String({ minLength: 1, maxLength: 160 });
export const UrlSchema = Type.String({ format: "uri", pattern: "^https?://" });

export const RunStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("succeeded"),
  Type.Literal("partial"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
]);
export type RunStatus = Static<typeof RunStatusSchema>;

export const ModuleStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("succeeded"),
  Type.Literal("skipped"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
]);
export type ModuleStatus = Static<typeof ModuleStatusSchema>;

export const SeveritySchema = Type.Union([
  Type.Literal("critical"),
  Type.Literal("high"),
  Type.Literal("medium"),
  Type.Literal("low"),
  Type.Literal("info"),
]);
export type Severity = Static<typeof SeveritySchema>;

export const EvidenceSchema = Type.Object(
  {
    kind: Type.String({ minLength: 1, maxLength: 80 }),
    label: Type.String({ minLength: 1, maxLength: 240 }),
    value: Type.Optional(Type.Unknown()),
    source: Type.Optional(Type.String({ maxLength: 120 })),
    observedAt: Type.Optional(IsoDateTimeSchema),
  },
  { additionalProperties: false },
);
export type Evidence = Static<typeof EvidenceSchema>;

export const IssueInstanceSchema = Type.Object(
  {
    fingerprint: Type.String({ minLength: 16, maxLength: 128 }),
    ruleId: IdentifierSchema,
    moduleId: IdentifierSchema,
    canonicalUrl: Type.Union([UrlSchema, Type.Null()]),
    severity: SeveritySchema,
    title: Type.String({ minLength: 1, maxLength: 240 }),
    description: Type.String({ minLength: 1, maxLength: 4000 }),
    evidence: Type.Array(EvidenceSchema),
    firstSeenAt: IsoDateTimeSchema,
    lastSeenAt: IsoDateTimeSchema,
    status: Type.Union([
      Type.Literal("open"),
      Type.Literal("resolved"),
      Type.Literal("ignored"),
      Type.Literal("false_positive"),
    ]),
  },
  { additionalProperties: false },
);
export type IssueInstance = Static<typeof IssueInstanceSchema>;

export const IssueAdjudicationStatusSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("ignored"),
  Type.Literal("false_positive"),
]);
export type IssueAdjudicationStatus = Static<
  typeof IssueAdjudicationStatusSchema
>;

export const IssueAdjudicationSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    fingerprint: Type.String({ minLength: 16, maxLength: 128 }),
    status: Type.Union([
      Type.Literal("ignored"),
      Type.Literal("false_positive"),
    ]),
    note: Type.Union([
      Type.String({ minLength: 3, maxLength: 2_000 }),
      Type.Null(),
    ]),
    actor: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type IssueAdjudication = Static<typeof IssueAdjudicationSchema>;

export const IssueReviewItemSchema = Type.Object(
  {
    issue: IssueInstanceSchema,
    latestRunId: IdentifierSchema,
    occurrenceCount: Type.Integer({ minimum: 1 }),
    adjudication: Type.Union([IssueAdjudicationSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type IssueReviewItem = Static<typeof IssueReviewItemSchema>;

export const IssueReviewPageSchema = Type.Object(
  {
    items: Type.Array(IssueReviewItemSchema),
    total: Type.Integer({ minimum: 0 }),
    offset: Type.Integer({ minimum: 0 }),
    limit: Type.Integer({ minimum: 1, maximum: 250 }),
  },
  { additionalProperties: false },
);
export type IssueReviewPage = Static<typeof IssueReviewPageSchema>;

export const UpdateIssueAdjudicationInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    status: IssueAdjudicationStatusSchema,
    note: Type.Optional(
      Type.Union([
        Type.String({ minLength: 3, maxLength: 2_000 }),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type UpdateIssueAdjudicationInput = Static<
  typeof UpdateIssueAdjudicationInputSchema
>;

export interface IssueReviewListOptions {
  limit?: number;
  offset?: number;
  status?: IssueInstance["status"];
  severity?: Severity;
  search?: string;
}

export const EffortSchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);
export type Effort = Static<typeof EffortSchema>;

export const ActionStatusSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("acknowledged"),
  Type.Literal("in_progress"),
  Type.Literal("resolved"),
]);
export type ActionStatus = Static<typeof ActionStatusSchema>;

export const SourceStateSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("unavailable"),
  Type.Literal("stale"),
  Type.Literal("failed"),
]);
export type SourceState = Static<typeof SourceStateSchema>;

export const MetricValueSchema = Type.Object({
  value: Type.Union([Type.Number(), Type.Null()]),
  state: SourceStateSchema,
  source: Type.String(),
  observedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  coverage: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]),
  note: Type.Optional(Type.String()),
});
export type MetricValue = Static<typeof MetricValueSchema>;

export const ActionSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    /** Stable rule identity for grouped evidence and targeted verification. */
    ruleId: Type.Optional(IdentifierSchema),
    /** Stable module identity for grouped evidence and targeted verification. */
    moduleId: Type.Optional(IdentifierSchema),
    issueFingerprint: Type.Optional(Type.String()),
    title: Type.String({ minLength: 1, maxLength: 240 }),
    whyNow: Type.String({ minLength: 1, maxLength: 2000 }),
    impact: Type.Number({ minimum: 0, maximum: 1 }),
    effort: EffortSchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    priorityScore: Type.Number({ minimum: 0, maximum: 100 }),
    scoreVersion: Type.Literal("priority-v1"),
    scoreInputs: Type.Object({
      severity: Type.Number({ minimum: 0, maximum: 1 }),
      organicExposure: Type.Union([
        Type.Number({ minimum: 0, maximum: 1 }),
        Type.Null(),
      ]),
      conversionExposure: Type.Union([
        Type.Number({ minimum: 0, maximum: 1 }),
        Type.Null(),
      ]),
      urlReach: Type.Number({ minimum: 0, maximum: 1 }),
      confidence: Type.Number({ minimum: 0, maximum: 1 }),
      unavailable: Type.Array(Type.String()),
    }),
    affectedUrls: Type.Array(UrlSchema),
    owner: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    status: ActionStatusSchema,
    verification: Type.Union([
      Type.Literal("pending"),
      Type.Literal("verified"),
      Type.Literal("regressed"),
    ]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type Action = Static<typeof ActionSchema>;

export const ActionOccurrenceLifecycleSchema = Type.Union([
  Type.Literal("new"),
  Type.Literal("persistent"),
  Type.Literal("resolved"),
  Type.Literal("reappeared"),
]);
export type ActionOccurrenceLifecycle = Static<
  typeof ActionOccurrenceLifecycleSchema
>;

export const ActionCheckpointStateSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("verification_queued"),
  Type.Literal("technically_verified"),
  Type.Literal("regressed"),
  Type.Literal("inconclusive"),
]);
export type ActionCheckpointState = Static<typeof ActionCheckpointStateSchema>;

export const TechnicalVerificationStateSchema = Type.Union([
  Type.Literal("not_started"),
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("verified"),
  Type.Literal("regressed"),
  Type.Literal("inconclusive"),
]);
export type TechnicalVerificationState = Static<
  typeof TechnicalVerificationStateSchema
>;

export const BusinessOutcomeStateSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("observed"),
  Type.Literal("inconclusive"),
  Type.Literal("unavailable"),
]);
export type BusinessOutcomeState = Static<typeof BusinessOutcomeStateSchema>;

const EvidencePeriodSchema = Type.Object(
  {
    start: Type.String({ format: "date" }),
    end: Type.String({ format: "date" }),
  },
  { additionalProperties: false },
);

export const ActionPageSearchEvidenceSchema = Type.Object(
  {
    clicks: Type.Number({ minimum: 0 }),
    impressions: Type.Number({ minimum: 0 }),
    ctr: Type.Number({ minimum: 0, maximum: 1 }),
    position: Type.Number({ minimum: 0 }),
    state: SourceStateSchema,
    period: EvidencePeriodSchema,
  },
  { additionalProperties: false },
);
export type ActionPageSearchEvidence = Static<
  typeof ActionPageSearchEvidenceSchema
>;

export const ActionPageAnalyticsEvidenceSchema = Type.Object(
  {
    sessions: Type.Number({ minimum: 0 }),
    keyEvents: Type.Number({ minimum: 0 }),
    state: SourceStateSchema,
    period: EvidencePeriodSchema,
  },
  { additionalProperties: false },
);
export type ActionPageAnalyticsEvidence = Static<
  typeof ActionPageAnalyticsEvidenceSchema
>;

export const ActionPageCwvEvidenceSchema = Type.Object(
  {
    lcp: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    cls: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    ttfb: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    state: SourceStateSchema,
  },
  { additionalProperties: false },
);
export type ActionPageCwvEvidence = Static<typeof ActionPageCwvEvidenceSchema>;

export const ActionEvidenceUrlSchema = Type.Object(
  {
    url: UrlSchema,
    title: Type.Union([Type.String(), Type.Null()]),
    statusCode: Type.Union([Type.Integer(), Type.Null()]),
    indexable: Type.Union([Type.Boolean(), Type.Null()]),
    lifecycle: ActionOccurrenceLifecycleSchema,
    issue: Type.Union([IssueInstanceSchema, Type.Null()]),
    gsc: Type.Union([ActionPageSearchEvidenceSchema, Type.Null()]),
    ga4: Type.Union([ActionPageAnalyticsEvidenceSchema, Type.Null()]),
    cwv: Type.Union([ActionPageCwvEvidenceSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type ActionEvidenceUrl = Static<typeof ActionEvidenceUrlSchema>;

export const ActionEvidenceHistorySchema = Type.Object(
  {
    runId: IdentifierSchema,
    observedAt: IsoDateTimeSchema,
    status: Type.Union([
      Type.Literal("present"),
      Type.Literal("resolved"),
      Type.Literal("reappeared"),
    ]),
    affectedCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type ActionEvidenceHistory = Static<typeof ActionEvidenceHistorySchema>;

export const ActionCheckpointSchema = Type.Object(
  {
    id: IdentifierSchema,
    actionId: IdentifierSchema,
    projectId: IdentifierSchema,
    baselineRunId: IdentifierSchema,
    state: ActionCheckpointStateSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type ActionCheckpoint = Static<typeof ActionCheckpointSchema>;

export const ActionVerificationSchema = Type.Object(
  {
    state: TechnicalVerificationStateSchema,
    checkpointId: Type.Union([IdentifierSchema, Type.Null()]),
    runId: Type.Union([IdentifierSchema, Type.Null()]),
    coverage: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    checkedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    reason: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ActionVerification = Static<typeof ActionVerificationSchema>;

export const ActionVerificationStartSchema = Type.Object(
  {
    runId: IdentifierSchema,
    verificationState: Type.Literal("queued"),
  },
  { additionalProperties: false },
);
export type ActionVerificationStart = Static<
  typeof ActionVerificationStartSchema
>;

export const ActionOutcomeObservationSchema = Type.Object(
  {
    id: IdentifierSchema,
    checkpointId: IdentifierSchema,
    windowDays: Type.Union([
      Type.Literal(7),
      Type.Literal(14),
      Type.Literal(28),
    ]),
    state: BusinessOutcomeStateSchema,
    period: Type.Union([EvidencePeriodSchema, Type.Null()]),
    targetChange: Type.Union([Type.Number(), Type.Null()]),
    controlChange: Type.Union([Type.Number(), Type.Null()]),
    controlAdjustedChange: Type.Union([Type.Number(), Type.Null()]),
    confidence: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    limitations: Type.Array(Type.String({ maxLength: 1000 })),
    observedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type ActionOutcomeObservation = Static<
  typeof ActionOutcomeObservationSchema
>;

export const ActionEvidenceWorkspaceSchema = Type.Object(
  {
    action: ActionSchema,
    summary: Type.Object(
      {
        totalUrls: Type.Integer({ minimum: 0 }),
        issueOccurrences: Type.Integer({ minimum: 0 }),
        newOccurrences: Type.Integer({ minimum: 0 }),
        persistentOccurrences: Type.Integer({ minimum: 0 }),
        resolvedOccurrences: Type.Integer({ minimum: 0 }),
        reappearedOccurrences: Type.Integer({ minimum: 0 }),
        clicks: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
        impressions: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
        keyEvents: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    urls: Type.Array(ActionEvidenceUrlSchema),
    history: Type.Array(ActionEvidenceHistorySchema),
    sources: Type.Array(MetricValueSchema),
    verification: ActionVerificationSchema,
    outcomes: Type.Array(ActionOutcomeObservationSchema),
    pageInfo: Type.Object(
      {
        nextCursor: Type.Union([Type.String(), Type.Null()]),
        total: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type ActionEvidenceWorkspace = Static<
  typeof ActionEvidenceWorkspaceSchema
>;

export const ProjectSchema = Type.Object(
  {
    id: IdentifierSchema,
    name: Type.String({ minLength: 1, maxLength: 160 }),
    /**
     * `null` when the workspace has no website. Widening this from a bare URL
     * is observable only for workspaces created without one, which cannot
     * exist in a database written before this field became optional.
     */
    canonicalUrl: Type.Union([UrlSchema, Type.Null()]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type Project = Static<typeof ProjectSchema>;

export const RunSchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    workflowId: IdentifierSchema,
    status: RunStatusSchema,
    requestedAt: IsoDateTimeSchema,
    startedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    completedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    progress: Type.Number({ minimum: 0, maximum: 1 }),
    issueCount: Type.Number({ minimum: 0 }),
    error: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false, $id: "Run" },
);
export type Run = Static<typeof RunSchema>;

export const RunReplaySchema = Type.Object(
  {
    sourceRunId: IdentifierSchema,
    configurationVersion: Type.Literal(1),
    configurationHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    run: RunSchema,
  },
  { additionalProperties: false, $id: "RunReplay" },
);
export type RunReplay = Static<typeof RunReplaySchema>;

export const RunComparisonStateSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("partial"),
  Type.Literal("unavailable"),
]);
export type RunComparisonState = Static<typeof RunComparisonStateSchema>;

export const RunComparisonConfigurationSchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("matched"),
      Type.Literal("different"),
      Type.Literal("unavailable"),
    ]),
    baselineHash: Type.Union([
      Type.String({ pattern: "^[a-f0-9]{64}$" }),
      Type.Null(),
    ]),
    currentHash: Type.Union([
      Type.String({ pattern: "^[a-f0-9]{64}$" }),
      Type.Null(),
    ]),
    differences: Type.Array(Type.String({ minLength: 1, maxLength: 160 }), {
      maxItems: 16,
    }),
  },
  { additionalProperties: false },
);
export type RunComparisonConfiguration = Static<
  typeof RunComparisonConfigurationSchema
>;

export const RunComparisonIssueChangeSchema = Type.Object(
  {
    fingerprint: Type.String({ minLength: 16, maxLength: 128 }),
    ruleId: IdentifierSchema,
    moduleId: IdentifierSchema,
    canonicalUrl: Type.Union([UrlSchema, Type.Null()]),
    title: Type.String({ minLength: 1, maxLength: 240 }),
    change: Type.Union([
      Type.Literal("new"),
      Type.Literal("resolved"),
      Type.Literal("severity_increased"),
      Type.Literal("severity_decreased"),
    ]),
    baselineSeverity: Type.Union([SeveritySchema, Type.Null()]),
    currentSeverity: Type.Union([SeveritySchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type RunComparisonIssueChange = Static<
  typeof RunComparisonIssueChangeSchema
>;

export const RunComparisonPageSnapshotSchema = Type.Object(
  {
    statusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    title: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    indexable: Type.Union([Type.Boolean(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type RunComparisonPageSnapshot = Static<
  typeof RunComparisonPageSnapshotSchema
>;

export const RunComparisonPageChangeSchema = Type.Object(
  {
    canonicalUrl: UrlSchema,
    kind: Type.Union([
      Type.Literal("added"),
      Type.Literal("removed"),
      Type.Literal("status_changed"),
      Type.Literal("indexability_changed"),
    ]),
    impact: Type.Union([
      Type.Literal("regression"),
      Type.Literal("improvement"),
      Type.Literal("neutral"),
    ]),
    before: Type.Union([RunComparisonPageSnapshotSchema, Type.Null()]),
    after: Type.Union([RunComparisonPageSnapshotSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type RunComparisonPageChange = Static<
  typeof RunComparisonPageChangeSchema
>;

export const RunComparisonLinkSnapshotSchema = Type.Object(
  {
    targetPageUrl: Type.Union([UrlSchema, Type.Null()]),
    targetStatusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    targetIndexable: Type.Union([Type.Boolean(), Type.Null()]),
    targetState: Type.Union([
      Type.Literal("direct"),
      Type.Literal("redirected"),
      Type.Literal("broken"),
      Type.Literal("uncrawled"),
    ]),
    occurrences: Type.Integer({ minimum: 1 }),
    followOccurrences: Type.Integer({ minimum: 0 }),
    nofollowOccurrences: Type.Integer({ minimum: 0 }),
    anchorTexts: Type.Array(Type.String({ maxLength: 500 }), { maxItems: 10 }),
    placements: Type.Array(
      Type.Union([
        Type.Literal("header"),
        Type.Literal("navigation"),
        Type.Literal("main"),
        Type.Literal("aside"),
        Type.Literal("footer"),
        Type.Literal("body"),
      ]),
      { maxItems: 6 },
    ),
  },
  { additionalProperties: false },
);
export type RunComparisonLinkSnapshot = Static<
  typeof RunComparisonLinkSnapshotSchema
>;

export const RunComparisonLinkChangeSchema = Type.Object(
  {
    sourceUrl: UrlSchema,
    targetUrl: UrlSchema,
    change: Type.Union([
      Type.Literal("added"),
      Type.Literal("removed"),
      Type.Literal("changed"),
    ]),
    impact: Type.Union([
      Type.Literal("regression"),
      Type.Literal("improvement"),
      Type.Literal("neutral"),
    ]),
    reasons: Type.Array(
      Type.Union([
        Type.Literal("target_resolution"),
        Type.Literal("target_indexability"),
        Type.Literal("follow_policy"),
        Type.Literal("occurrences"),
        Type.Literal("anchor_text"),
        Type.Literal("placement"),
      ]),
      { minItems: 1, maxItems: 6 },
    ),
    before: Type.Union([RunComparisonLinkSnapshotSchema, Type.Null()]),
    after: Type.Union([RunComparisonLinkSnapshotSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type RunComparisonLinkChange = Static<
  typeof RunComparisonLinkChangeSchema
>;

const RunComparisonLinkCoverageSchema = Type.Object(
  {
    pageCount: Type.Integer({ minimum: 0 }),
    graphPageCount: Type.Integer({ minimum: 0 }),
    edgeCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const RunComparisonLinkGraphSchema = Type.Object(
  {
    version: Type.Literal("link-delta-v1"),
    state: RunComparisonStateSchema,
    baseline: RunComparisonLinkCoverageSchema,
    current: RunComparisonLinkCoverageSchema,
    summary: Type.Object(
      {
        addedEdges: Type.Integer({ minimum: 0 }),
        removedEdges: Type.Integer({ minimum: 0 }),
        changedEdges: Type.Integer({ minimum: 0 }),
        regressions: Type.Integer({ minimum: 0 }),
        improvements: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    changes: Type.Array(RunComparisonLinkChangeSchema, { maxItems: 200 }),
    truncated: Type.Boolean(),
    warnings: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), {
      maxItems: 8,
    }),
  },
  { additionalProperties: false },
);
export type RunComparisonLinkGraph = Static<
  typeof RunComparisonLinkGraphSchema
>;

export const RunComparisonSummarySchema = Type.Object(
  {
    baselinePages: Type.Integer({ minimum: 0 }),
    currentPages: Type.Integer({ minimum: 0 }),
    addedPages: Type.Integer({ minimum: 0 }),
    removedPages: Type.Integer({ minimum: 0 }),
    statusChanges: Type.Integer({ minimum: 0 }),
    indexabilityChanges: Type.Integer({ minimum: 0 }),
    baselineIssues: Type.Integer({ minimum: 0 }),
    currentIssues: Type.Integer({ minimum: 0 }),
    newIssues: Type.Integer({ minimum: 0 }),
    resolvedIssues: Type.Integer({ minimum: 0 }),
    persistentIssues: Type.Integer({ minimum: 0 }),
    severityIncreases: Type.Integer({ minimum: 0 }),
    severityDecreases: Type.Integer({ minimum: 0 }),
    reviewedExcludedBaseline: Type.Integer({ minimum: 0 }),
    reviewedExcludedCurrent: Type.Integer({ minimum: 0 }),
    baselineHealth: Type.Union([Type.Number(), Type.Null()]),
    currentHealth: Type.Union([Type.Number(), Type.Null()]),
    healthDelta: Type.Union([Type.Number(), Type.Null()]),
    regressionScore: Type.Number(),
  },
  { additionalProperties: false },
);
export type RunComparisonSummary = Static<typeof RunComparisonSummarySchema>;

const RunComparisonRunSchema = Type.Object(
  { ...RunSchema.properties },
  { additionalProperties: false },
);

export const RunComparisonSchema = Type.Object(
  {
    scoreVersion: Type.Literal("regression-v1"),
    generatedAt: IsoDateTimeSchema,
    state: RunComparisonStateSchema,
    projectId: IdentifierSchema,
    baselineRun: RunComparisonRunSchema,
    currentRun: RunComparisonRunSchema,
    configuration: RunComparisonConfigurationSchema,
    summary: RunComparisonSummarySchema,
    issueRegressions: Type.Array(RunComparisonIssueChangeSchema, {
      maxItems: 100,
    }),
    issueImprovements: Type.Array(RunComparisonIssueChangeSchema, {
      maxItems: 100,
    }),
    pageChanges: Type.Array(RunComparisonPageChangeSchema, { maxItems: 200 }),
    linkGraph: RunComparisonLinkGraphSchema,
    truncated: Type.Object(
      {
        issueRegressions: Type.Boolean(),
        issueImprovements: Type.Boolean(),
        pageChanges: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    warnings: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), {
      maxItems: 16,
    }),
  },
  { additionalProperties: false },
);
export type RunComparison = Static<typeof RunComparisonSchema>;

export const ProjectOverviewSchema = Type.Object({
  project: ProjectSchema,
  seoHealth: MetricValueSchema,
  healthChange: MetricValueSchema,
  gscClicks: MetricValueSchema,
  gscImpressions: MetricValueSchema,
  organicKeyEvents: MetricValueSchema,
  indexableCoverage: MetricValueSchema,
  cwvPassRate: MetricValueSchema,
  criticalRegressions: MetricValueSchema,
  topActions: Type.Array(ActionSchema, { maxItems: 5 }),
  lastRun: Type.Union([RunSchema, Type.Null()]),
});
export type ProjectOverview = Static<typeof ProjectOverviewSchema>;

export const RunEventSchema = Type.Object({
  id: Type.Integer({ minimum: 0 }),
  runId: IdentifierSchema,
  type: Type.String({ minLength: 1, maxLength: 80 }),
  at: IsoDateTimeSchema,
  payload: Type.Record(Type.String(), Type.Unknown()),
});
export type RunEvent = Static<typeof RunEventSchema>;

export const RunEvidenceSectionSchema = Type.Union([
  Type.Literal("crawl"),
  Type.Literal("redirects"),
  Type.Literal("hreflang"),
  Type.Literal("extractions"),
]);
export type RunEvidenceSection = Static<typeof RunEvidenceSectionSchema>;

export const RunEvidenceStateSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("partial"),
  Type.Literal("unavailable"),
]);
export type RunEvidenceState = Static<typeof RunEvidenceStateSchema>;

export const CrawlPathEvidenceSchema = Type.Object(
  {
    kind: Type.Literal("crawl"),
    sourceUrl: UrlSchema,
    finalUrl: UrlSchema,
    title: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    statusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    indexable: Type.Union([Type.Boolean(), Type.Null()]),
    crawlDepth: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    discoveredFrom: Type.Union([UrlSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type CrawlPathEvidence = Static<typeof CrawlPathEvidenceSchema>;

export const RedirectPathEvidenceSchema = Type.Object(
  {
    kind: Type.Literal("redirect"),
    sourceUrl: UrlSchema,
    finalUrl: UrlSchema,
    finalStatusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    hopCount: Type.Integer({ minimum: 1 }),
    chain: Type.Array(UrlSchema, { minItems: 2 }),
  },
  { additionalProperties: false },
);
export type RedirectPathEvidence = Static<typeof RedirectPathEvidenceSchema>;

export const HreflangAlternateEvidenceSchema = Type.Object(
  {
    lang: Type.String({ minLength: 1, maxLength: 80 }),
    declaredUrl: Type.String({ minLength: 1, maxLength: 4_000 }),
    resolvedUrl: Type.Union([UrlSchema, Type.Null()]),
    selfReference: Type.Boolean(),
    targetState: Type.Union([
      Type.Literal("self"),
      Type.Literal("crawled"),
      Type.Literal("not_crawled"),
      Type.Literal("invalid"),
    ]),
    targetStatusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    reciprocal: Type.Union([
      Type.Literal("matched"),
      Type.Literal("missing"),
      Type.Literal("language_mismatch"),
      Type.Literal("not_applicable"),
      Type.Literal("unavailable"),
    ]),
    expectedReturnLanguage: Type.Union([
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.Null(),
    ]),
    observedReturnLanguages: Type.Array(
      Type.String({ minLength: 1, maxLength: 80 }),
    ),
  },
  { additionalProperties: false },
);
export type HreflangAlternateEvidence = Static<
  typeof HreflangAlternateEvidenceSchema
>;

export const HreflangPageEvidenceSchema = Type.Object(
  {
    kind: Type.Literal("hreflang"),
    sourceUrl: UrlSchema,
    finalUrl: UrlSchema,
    htmlLang: Type.Union([
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.Null(),
    ]),
    selfLanguage: Type.Union([
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.Null(),
    ]),
    hasXDefault: Type.Boolean(),
    alternates: Type.Array(HreflangAlternateEvidenceSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);
export type HreflangPageEvidence = Static<typeof HreflangPageEvidenceSchema>;

export const ExtractionFieldEvidenceSchema = Type.Object(
  {
    label: Type.String({ minLength: 1, maxLength: 240 }),
    value: Type.Union([Type.String({ maxLength: 20_000 }), Type.Null()]),
    truncated: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type ExtractionFieldEvidence = Static<
  typeof ExtractionFieldEvidenceSchema
>;

export const ExtractionPageEvidenceSchema = Type.Object(
  {
    kind: Type.Literal("extraction"),
    sourceUrl: UrlSchema,
    finalUrl: UrlSchema,
    fields: Type.Array(ExtractionFieldEvidenceSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);
export type ExtractionPageEvidence = Static<
  typeof ExtractionPageEvidenceSchema
>;

export const RunEvidenceItemSchema = Type.Union([
  CrawlPathEvidenceSchema,
  RedirectPathEvidenceSchema,
  HreflangPageEvidenceSchema,
  ExtractionPageEvidenceSchema,
]);
export type RunEvidenceItem = Static<typeof RunEvidenceItemSchema>;

export const SitemapUrlSampleSchema = Type.Object(
  {
    total: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    urls: Type.Array(UrlSchema),
    complete: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type SitemapUrlSample = Static<typeof SitemapUrlSampleSchema>;

export const SitemapEvidenceSchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("available"),
      Type.Literal("not_found"),
      Type.Literal("fetch_failed"),
      Type.Literal("invalid"),
      Type.Literal("not_captured"),
    ]),
    sourceUrl: Type.Union([UrlSchema, Type.Null()]),
    fetchStatusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    files: Type.Array(
      Type.Object(
        {
          url: UrlSchema,
          kind: Type.Union([
            Type.Literal("urlset"),
            Type.Literal("sitemapindex"),
            Type.Literal("unknown"),
          ]),
          statusCode: Type.Union([
            Type.Integer({ minimum: 0, maximum: 999 }),
            Type.Null(),
          ]),
          locCount: Type.Integer({ minimum: 0 }),
        },
        { additionalProperties: false },
      ),
    ),
    declaredUrls: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    discoveredIndexableUrls: Type.Union([
      Type.Integer({ minimum: 0 }),
      Type.Null(),
    ]),
    matchedIndexableUrls: Type.Union([
      Type.Integer({ minimum: 0 }),
      Type.Null(),
    ]),
    coverage: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    missingIndexable: SitemapUrlSampleSchema,
    declaredNotCrawled: SitemapUrlSampleSchema,
    brokenDeclared: SitemapUrlSampleSchema,
    warnings: Type.Array(Type.String({ maxLength: 1_000 })),
  },
  { additionalProperties: false },
);
export type SitemapEvidence = Static<typeof SitemapEvidenceSchema>;

export const RunEvidencePageSchema = Type.Object(
  {
    runId: IdentifierSchema,
    generatedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    state: RunEvidenceStateSchema,
    section: RunEvidenceSectionSchema,
    items: Type.Array(RunEvidenceItemSchema),
    pageInfo: Type.Object(
      {
        total: Type.Integer({ minimum: 0 }),
        offset: Type.Integer({ minimum: 0 }),
        limit: Type.Integer({ minimum: 1, maximum: 250 }),
        nextOffset: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    sitemap: SitemapEvidenceSchema,
    warnings: Type.Array(Type.String({ maxLength: 1_000 })),
  },
  { additionalProperties: false },
);
export type RunEvidencePage = Static<typeof RunEvidencePageSchema>;

export const InternalLinkDirectionSchema = Type.Union([
  Type.Literal("inlinks"),
  Type.Literal("outlinks"),
]);
export type InternalLinkDirection = Static<typeof InternalLinkDirectionSchema>;

export const InternalLinkPlacementSchema = Type.Union([
  Type.Literal("header"),
  Type.Literal("navigation"),
  Type.Literal("main"),
  Type.Literal("aside"),
  Type.Literal("footer"),
  Type.Literal("body"),
]);
export type InternalLinkPlacement = Static<typeof InternalLinkPlacementSchema>;

export const InternalLinkEdgeSchema = Type.Object(
  {
    sourceUrl: UrlSchema,
    sourceTitle: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    targetUrl: UrlSchema,
    targetPageUrl: Type.Union([UrlSchema, Type.Null()]),
    targetTitle: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
    targetStatusCode: Type.Union([
      Type.Integer({ minimum: 0, maximum: 999 }),
      Type.Null(),
    ]),
    targetIndexable: Type.Union([Type.Boolean(), Type.Null()]),
    targetState: Type.Union([
      Type.Literal("direct"),
      Type.Literal("redirected"),
      Type.Literal("broken"),
      Type.Literal("uncrawled"),
    ]),
    occurrences: Type.Integer({ minimum: 1 }),
    followOccurrences: Type.Integer({ minimum: 0 }),
    nofollowOccurrences: Type.Integer({ minimum: 0 }),
    anchorTexts: Type.Array(Type.String({ maxLength: 500 }), {
      maxItems: 10,
    }),
    placements: Type.Array(InternalLinkPlacementSchema, { maxItems: 6 }),
  },
  { additionalProperties: false },
);
export type InternalLinkEdge = Static<typeof InternalLinkEdgeSchema>;

export const RunLinkExplorerSchema = Type.Object(
  {
    version: Type.Literal("link-graph-v1"),
    runId: IdentifierSchema,
    generatedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    state: RunEvidenceStateSchema,
    page: Type.Object(
      {
        url: UrlSchema,
        title: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
        statusCode: Type.Union([
          Type.Integer({ minimum: 0, maximum: 999 }),
          Type.Null(),
        ]),
        indexable: Type.Union([Type.Boolean(), Type.Null()]),
        crawlDepth: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    direction: InternalLinkDirectionSchema,
    summary: Type.Object(
      {
        inlinkSources: Type.Integer({ minimum: 0 }),
        inlinkOccurrences: Type.Integer({ minimum: 0 }),
        outlinkTargets: Type.Integer({ minimum: 0 }),
        outlinkOccurrences: Type.Integer({ minimum: 0 }),
        followedInlinkOccurrences: Type.Integer({ minimum: 0 }),
        nofollowInlinkOccurrences: Type.Integer({ minimum: 0 }),
        followedOutlinkOccurrences: Type.Integer({ minimum: 0 }),
        nofollowOutlinkOccurrences: Type.Integer({ minimum: 0 }),
        brokenOutlinkTargets: Type.Integer({ minimum: 0 }),
        redirectedOutlinkTargets: Type.Integer({ minimum: 0 }),
        uncrawledOutlinkTargets: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    items: Type.Array(InternalLinkEdgeSchema),
    pageInfo: Type.Object(
      {
        total: Type.Integer({ minimum: 0 }),
        offset: Type.Integer({ minimum: 0 }),
        limit: Type.Integer({ minimum: 1, maximum: 250 }),
        nextOffset: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    warnings: Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
      maxItems: 16,
    }),
  },
  { additionalProperties: false },
);
export type RunLinkExplorer = Static<typeof RunLinkExplorerSchema>;

export const IntegrationStatusSchema = Type.Union([
  Type.Literal("connected"),
  Type.Literal("degraded"),
  Type.Literal("expired"),
  Type.Literal("rate_limited"),
  Type.Literal("failed"),
  Type.Literal("not_configured"),
]);
export type IntegrationStatus = Static<typeof IntegrationStatusSchema>;

/**
 * What a workspace can currently do, derived from what it actually holds.
 *
 * A workspace is not required to have a website. Most of this product works
 * without one, and the surfaces that genuinely cannot — anything that starts by
 * crawling the site — should say which input they are missing rather than
 * refusing the whole workspace. Capabilities are the vocabulary for that: each
 * surface declares what it needs, and a missing capability carries the reason
 * and the one step that supplies it.
 *
 * `ads` and `social` are reserved for the channel layer and are never reported
 * as present yet; they are named here so surfaces can be written against the
 * final vocabulary rather than being renamed later.
 */
export const WorkspaceCapabilitySchema = Type.Union([
  Type.Literal("website"),
  Type.Literal("search-console"),
  Type.Literal("analytics"),
  Type.Literal("serp"),
  Type.Literal("ads"),
  Type.Literal("social"),
]);
export type WorkspaceCapability = Static<typeof WorkspaceCapabilitySchema>;

export const WorkspaceCapabilityStateSchema = Type.Object(
  {
    capability: WorkspaceCapabilitySchema,
    available: Type.Boolean(),
    /** Why it is unavailable, in the operator's terms. Empty when available. */
    reason: Type.String(),
    /** The single next step that supplies it, or `null` when there is none. */
    remedy: Type.Union([
      Type.Object(
        {
          label: Type.String(),
          href: Type.String(),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export type WorkspaceCapabilityState = Static<
  typeof WorkspaceCapabilityStateSchema
>;

export const WorkspaceCapabilitiesSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    available: Type.Array(WorkspaceCapabilitySchema),
    states: Type.Array(WorkspaceCapabilityStateSchema),
  },
  { additionalProperties: false },
);
export type WorkspaceCapabilities = Static<typeof WorkspaceCapabilitiesSchema>;

export const IntegrationSchema = Type.Object({
  provider: IdentifierSchema,
  /**
   * Which credential under this provider. One Meta login reaches many ad
   * cabinets and an agency needs a different login per client, so a connection
   * is `(provider, account)` rather than one row per provider.
   *
   * Optional in the contract and omitted for `default`, so every request and
   * response written against the single-account API stays valid.
   */
  account: Type.Optional(IdentifierSchema),
  label: Type.String(),
  status: IntegrationStatusSchema,
  secretRef: Type.Optional(Type.String()),
  maskedIdentifier: Type.Union([Type.String(), Type.Null()]),
  scopes: Type.Array(Type.String()),
  lastSyncAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  nextSyncAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  expiresAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  quota: Type.Union([
    Type.Object({
      remaining: Type.Number(),
      limit: Type.Union([Type.Number(), Type.Null()]),
      resetsAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    }),
    Type.Null(),
  ]),
  /** Non-secret connector settings validated against the connector manifest. */
  configuration: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type Integration = Static<typeof IntegrationSchema>;

export const ScheduleSchema = Type.Object({
  id: IdentifierSchema,
  projectId: IdentifierSchema,
  cron: Type.String({ minLength: 5, maxLength: 120 }),
  timezone: Type.String({ minLength: 1, maxLength: 80 }),
  enabled: Type.Boolean(),
  nextRunAt: IsoDateTimeSchema,
  /**
   * What this schedule runs.
   *
   * Optional and defaulting to `audit`, because until the reporting layer a
   * schedule could only ever start an audit — the worker had the workflow
   * hardcoded. Every request written against that behaviour stays valid.
   */
  workflowId: Type.Optional(IdentifierSchema),
  options: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Schedule = Static<typeof ScheduleSchema>;

export const CapabilitiesSchema = Type.Object({
  edition: Type.Literal("community"),
  version: Type.String(),
  apiVersion: Type.Literal("v1"),
  telemetry: Type.Literal("disabled_by_default"),
  limits: Type.Object({ projects: Type.Null(), audits: Type.Null() }),
  features: Type.Array(Type.String()),
  hosted: Type.Object({
    available: Type.Boolean(),
    url: Type.String({ format: "uri" }),
    message: Type.String(),
  }),
});
export type Capabilities = Static<typeof CapabilitiesSchema>;

export const ProblemDetailsSchema = Type.Object({
  type: Type.String({ format: "uri-reference" }),
  title: Type.String(),
  status: Type.Integer({ minimum: 400, maximum: 599 }),
  detail: Type.Optional(Type.String()),
  instance: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
});
export type ProblemDetails = Static<typeof ProblemDetailsSchema>;

export const CreateProjectInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 160 }),
    /** Optional: a workspace can be created first and given a website later. */
    canonicalUrl: Type.Optional(UrlSchema),
  },
  { additionalProperties: false },
);
export type CreateProjectInput = Static<typeof CreateProjectInputSchema>;

export const DeleteProjectInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    /** Must exactly match the current project name. */
    confirmation: Type.String({ minLength: 1, maxLength: 160 }),
  },
  { additionalProperties: false },
);
export type DeleteProjectInput = Static<typeof DeleteProjectInputSchema>;

export const ProjectDeletionCountsSchema = Type.Object(
  {
    runs: Type.Integer({ minimum: 0 }),
    pages: Type.Integer({ minimum: 0 }),
    issueInstances: Type.Integer({ minimum: 0 }),
    actions: Type.Integer({ minimum: 0 }),
    schedules: Type.Integer({ minimum: 0 }),
    artifacts: Type.Integer({ minimum: 0 }),
    contextVersions: Type.Integer({ minimum: 0 }),
    contextEntries: Type.Integer({ minimum: 0 }),
    extractionRuleVersions: Type.Integer({ minimum: 0 }),
    /**
     * Channel-layer records. A receipt that omitted them would under-report
     * what a deletion removed, and the point of the receipt is that it does
     * not.
     */
    channelAccounts: Type.Integer({ minimum: 0 }),
    channelMetrics: Type.Integer({ minimum: 0 }),
    campaignBriefs: Type.Integer({ minimum: 0 }),
    publishIntents: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type ProjectDeletionCounts = Static<typeof ProjectDeletionCountsSchema>;

export const ProjectDeletionReceiptSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    deletedAt: IsoDateTimeSchema,
    counts: ProjectDeletionCountsSchema,
    artifactCleanup: Type.Union([
      Type.Literal("complete"),
      Type.Literal("scheduled"),
    ]),
    /** Provider credentials are global BYOK records and may serve other projects. */
    globalCredentialsRetained: Type.Literal(true),
  },
  { additionalProperties: false },
);
export type ProjectDeletionReceipt = Static<
  typeof ProjectDeletionReceiptSchema
>;

const ProjectContextListItemSchema = Type.String({
  minLength: 1,
  maxLength: 240,
});

/**
 * A public presence the brand owns: a social profile, a marketplace listing, a
 * review page. Stored with the workspace context because "where does this brand
 * exist" is the same class of fact as "who are its competitors".
 */
export const BrandProfileSchema = Type.Object(
  {
    label: Type.String({ minLength: 1, maxLength: 60 }),
    url: Type.String({ minLength: 1, maxLength: 2_000, format: "uri" }),
  },
  { additionalProperties: false },
);
export type BrandProfile = Static<typeof BrandProfileSchema>;

export const ProjectContextProfileSchema = Type.Object(
  {
    summary: Type.Union([
      Type.String({ minLength: 1, maxLength: 4_000 }),
      Type.Null(),
    ]),
    audiences: Type.Array(ProjectContextListItemSchema, { maxItems: 30 }),
    markets: Type.Array(ProjectContextListItemSchema, { maxItems: 40 }),
    languages: Type.Array(ProjectContextListItemSchema, { maxItems: 30 }),
    conversionGoals: Type.Array(ProjectContextListItemSchema, {
      maxItems: 30,
    }),
    priorityTopics: Type.Array(ProjectContextListItemSchema, { maxItems: 80 }),
    competitors: Type.Array(ProjectContextListItemSchema, { maxItems: 50 }),
    brandProfiles: Type.Array(BrandProfileSchema, { maxItems: 30 }),
    constraints: Type.Array(ProjectContextListItemSchema, { maxItems: 50 }),
  },
  { additionalProperties: false },
);
export type ProjectContextProfile = Static<typeof ProjectContextProfileSchema>;

export const ProjectContextVersionSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    revision: Type.Integer({ minimum: 1 }),
    profile: ProjectContextProfileSchema,
    changeSummary: Type.String({ minLength: 3, maxLength: 240 }),
    actor: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type ProjectContextVersion = Static<typeof ProjectContextVersionSchema>;

export const ProjectContextJournalKindSchema = Type.Union([
  Type.Literal("observation"),
  Type.Literal("decision"),
  Type.Literal("constraint"),
  Type.Literal("experiment"),
]);
export type ProjectContextJournalKind = Static<
  typeof ProjectContextJournalKindSchema
>;

export const ProjectContextJournalEntrySchema = Type.Object(
  {
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    sequence: Type.Integer({ minimum: 1 }),
    kind: ProjectContextJournalKindSchema,
    title: Type.String({ minLength: 3, maxLength: 160 }),
    detail: Type.String({ minLength: 3, maxLength: 2_000 }),
    sourceRunId: Type.Union([IdentifierSchema, Type.Null()]),
    actor: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type ProjectContextJournalEntry = Static<
  typeof ProjectContextJournalEntrySchema
>;

export const ProjectContextWorkspaceSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    current: Type.Union([ProjectContextVersionSchema, Type.Null()]),
    history: Type.Array(ProjectContextVersionSchema, { maxItems: 100 }),
    journal: Type.Array(ProjectContextJournalEntrySchema, { maxItems: 500 }),
  },
  { additionalProperties: false },
);
export type ProjectContextWorkspace = Static<
  typeof ProjectContextWorkspaceSchema
>;

export const UpdateProjectContextInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    profile: ProjectContextProfileSchema,
    changeSummary: Type.String({ minLength: 3, maxLength: 240 }),
  },
  { additionalProperties: false },
);
export type UpdateProjectContextInput = Static<
  typeof UpdateProjectContextInputSchema
>;

export const AppendProjectContextJournalInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    kind: ProjectContextJournalKindSchema,
    title: Type.String({ minLength: 3, maxLength: 160 }),
    detail: Type.String({ minLength: 3, maxLength: 2_000 }),
    sourceRunId: Type.Optional(Type.Union([IdentifierSchema, Type.Null()])),
  },
  { additionalProperties: false },
);
export type AppendProjectContextJournalInput = Static<
  typeof AppendProjectContextJournalInputSchema
>;

export const ExtractionRuleTypeSchema = Type.Union([
  Type.Literal("text"),
  Type.Literal("html"),
  Type.Literal("attribute"),
]);
export type ExtractionRuleType = Static<typeof ExtractionRuleTypeSchema>;

export const ExtractionRuleSchema = Type.Object(
  {
    id: IdentifierSchema,
    label: Type.String({ minLength: 1, maxLength: 240 }),
    selector: Type.String({ minLength: 1, maxLength: 2_000 }),
    type: ExtractionRuleTypeSchema,
    attribute: Type.Union([
      Type.String({ minLength: 1, maxLength: 256 }),
      Type.Null(),
    ]),
    regex: Type.Union([
      Type.String({ minLength: 1, maxLength: 512 }),
      Type.Null(),
    ]),
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type ExtractionRule = Static<typeof ExtractionRuleSchema>;

export const ExtractionRuleTemplateCategorySchema = Type.Union([
  Type.Literal("social"),
  Type.Literal("editorial"),
  Type.Literal("commerce"),
  Type.Literal("migration"),
]);
export type ExtractionRuleTemplateCategory = Static<
  typeof ExtractionRuleTemplateCategorySchema
>;

export const ExtractionRuleTemplateSchema = Type.Object(
  {
    id: IdentifierSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    category: ExtractionRuleTemplateCategorySchema,
    description: Type.String({ minLength: 1, maxLength: 500 }),
    recommendedPage: Type.String({ minLength: 1, maxLength: 240 }),
    assumptions: Type.Array(Type.String({ minLength: 1, maxLength: 300 }), {
      minItems: 1,
      maxItems: 8,
    }),
    rules: Type.Array(ExtractionRuleSchema, {
      minItems: 1,
      maxItems: 10,
    }),
  },
  { additionalProperties: false },
);
export type ExtractionRuleTemplate = Static<
  typeof ExtractionRuleTemplateSchema
>;

export const ExtractionRuleTemplateCatalogSchema = Type.Object(
  {
    version: Type.Literal("extraction-template-catalog-v1"),
    importMode: Type.Literal("review_required"),
    templates: Type.Array(ExtractionRuleTemplateSchema, {
      minItems: 1,
      maxItems: 20,
    }),
  },
  { additionalProperties: false },
);
export type ExtractionRuleTemplateCatalog = Static<
  typeof ExtractionRuleTemplateCatalogSchema
>;

export { BUILT_IN_EXTRACTION_RULE_TEMPLATE_CATALOG } from "./extraction-rule-templates.js";

export const ExtractionRuleSetVersionSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    revision: Type.Integer({ minimum: 1 }),
    configurationHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    rules: Type.Array(ExtractionRuleSchema, { maxItems: 50 }),
    changeSummary: Type.String({ minLength: 3, maxLength: 240 }),
    actor: Type.String({ minLength: 1, maxLength: 160 }),
    createdAt: IsoDateTimeSchema,
  },
  { additionalProperties: false },
);
export type ExtractionRuleSetVersion = Static<
  typeof ExtractionRuleSetVersionSchema
>;

export const ExtractionRuleWorkspaceSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    current: Type.Union([ExtractionRuleSetVersionSchema, Type.Null()]),
    history: Type.Array(ExtractionRuleSetVersionSchema, { maxItems: 100 }),
  },
  { additionalProperties: false },
);
export type ExtractionRuleWorkspace = Static<
  typeof ExtractionRuleWorkspaceSchema
>;

export const UpdateExtractionRulesInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    rules: Type.Array(ExtractionRuleSchema, { maxItems: 50 }),
    changeSummary: Type.String({ minLength: 3, maxLength: 240 }),
  },
  { additionalProperties: false },
);
export type UpdateExtractionRulesInput = Static<
  typeof UpdateExtractionRulesInputSchema
>;

export const PreviewExtractionRulesInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    url: UrlSchema,
    renderMode: Type.Optional(
      Type.Union([Type.Literal("static"), Type.Literal("js")]),
    ),
    allowPrivateHost: Type.Optional(Type.Boolean()),
    rules: Type.Array(ExtractionRuleSchema, { maxItems: 50 }),
  },
  { additionalProperties: false },
);
export type PreviewExtractionRulesInput = Static<
  typeof PreviewExtractionRulesInputSchema
>;

export const ExtractionPreviewFieldSchema = Type.Object(
  {
    ruleId: IdentifierSchema,
    label: Type.String({ minLength: 1, maxLength: 240 }),
    value: Type.Union([Type.String({ maxLength: 20_000 }), Type.Null()]),
    truncated: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type ExtractionPreviewField = Static<
  typeof ExtractionPreviewFieldSchema
>;

export const ExtractionPreviewSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    requestedUrl: UrlSchema,
    finalUrl: UrlSchema,
    statusCode: Type.Integer({ minimum: 0, maximum: 999 }),
    contentType: Type.String({ maxLength: 500 }),
    renderMode: Type.Union([Type.Literal("static"), Type.Literal("js")]),
    responseTimeMs: Type.Number({ minimum: 0 }),
    configurationHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    fields: Type.Array(ExtractionPreviewFieldSchema, { maxItems: 50 }),
  },
  { additionalProperties: false },
);
export type ExtractionPreview = Static<typeof ExtractionPreviewSchema>;

export const OsintEvidenceStateSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("missing"),
  Type.Literal("insufficient"),
  Type.Literal("contradictory"),
]);
export type OsintEvidenceState = Static<typeof OsintEvidenceStateSchema>;

export const OsintEvidenceSchema = Type.Object(
  {
    id: IdentifierSchema,
    kind: IdentifierSchema,
    label: Type.String({ minLength: 1, maxLength: 240 }),
    value: Type.Unknown(),
    state: OsintEvidenceStateSchema,
    sourceUrl: Type.Union([UrlSchema, Type.Null()]),
    sourceClass: Type.Union([
      Type.Literal("public_web"),
      Type.Literal("first_party"),
      Type.Literal("licensed_provider"),
      Type.Literal("user_import"),
    ]),
    observedAt: IsoDateTimeSchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    claimHash: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
  },
  { additionalProperties: false },
);
export type OsintEvidence = Static<typeof OsintEvidenceSchema>;

export const OsintEntitySchema = Type.Object(
  {
    id: IdentifierSchema,
    type: Type.Union([
      Type.Literal("organization"),
      Type.Literal("domain"),
      Type.Literal("page"),
      Type.Literal("profile"),
      Type.Literal("feed"),
    ]),
    label: Type.String({ minLength: 1, maxLength: 240 }),
    url: Type.Union([UrlSchema, Type.Null()]),
    exactMatch: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type OsintEntity = Static<typeof OsintEntitySchema>;

export const OsintRelationshipSchema = Type.Object(
  {
    id: IdentifierSchema,
    fromEntityId: IdentifierSchema,
    toEntityId: IdentifierSchema,
    type: Type.Union([
      Type.Literal("owns"),
      Type.Literal("links_to"),
      Type.Literal("same_as"),
      Type.Literal("publishes_via"),
    ]),
    evidenceIds: Type.Array(IdentifierSchema, { maxItems: 200 }),
  },
  { additionalProperties: false },
);
export type OsintRelationship = Static<typeof OsintRelationshipSchema>;

export const OsintPublishingCadenceSchema = Type.Object(
  {
    feedUrl: UrlSchema,
    itemsInFeed: Type.Integer({ minimum: 0 }),
    datedItems: Type.Integer({ minimum: 0 }),
    freshnessSeconds: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    cadenceDays: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    spanDays: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    intervals: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    newestPublishedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
    oldestPublishedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type OsintPublishingCadence = Static<
  typeof OsintPublishingCadenceSchema
>;

export const OsintFeedOutcomeSchema = Type.Object(
  {
    target: UrlSchema,
    cadence: Type.Union([OsintPublishingCadenceSchema, Type.Null()]),
    unavailable: Type.Union([
      Type.Literal("no-feed-discovered"),
      Type.Literal("blocked-by-robots"),
      Type.Literal("unsafe-url"),
      Type.Literal("fetch-failed"),
      Type.Literal("unparseable"),
      Type.Null(),
    ]),
    detail: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);
export type OsintFeedOutcome = Static<typeof OsintFeedOutcomeSchema>;

export const OsintTargetDossierSchema = Type.Object(
  {
    targetUrl: Type.String({ minLength: 1, maxLength: 2048 }),
    finalUrl: Type.Union([UrlSchema, Type.Null()]),
    host: Type.Union([
      Type.String({ minLength: 1, maxLength: 253 }),
      Type.Null(),
    ]),
    status: Type.Union([
      Type.Literal("available"),
      Type.Literal("partial"),
      Type.Literal("failed"),
    ]),
    pagesObserved: Type.Integer({ minimum: 0 }),
    evidence: Type.Array(OsintEvidenceSchema, { maxItems: 200 }),
    entities: Type.Array(OsintEntitySchema, { maxItems: 500 }),
    relationships: Type.Array(OsintRelationshipSchema, { maxItems: 500 }),
    publishingCadence: Type.Union([OsintFeedOutcomeSchema, Type.Null()]),
    error: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type OsintTargetDossier = Static<typeof OsintTargetDossierSchema>;

export const OsintFindingSchema = Type.Object(
  {
    id: IdentifierSchema,
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("low"),
      Type.Literal("medium"),
    ]),
    title: Type.String({ minLength: 1, maxLength: 240 }),
    statement: Type.String({ minLength: 1, maxLength: 2_000 }),
    evidenceIds: Type.Array(IdentifierSchema, { maxItems: 200 }),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    actionable: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type OsintFinding = Static<typeof OsintFindingSchema>;

export const OsintProvenanceSchema = Type.Object(
  {
    captureMethod: Type.Literal("same_origin_public_crawl"),
    claimHashAlgorithm: Type.Literal("sha256"),
    evidenceDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    evidenceCount: Type.Integer({ minimum: 0 }),
    sourceCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type OsintProvenance = Static<typeof OsintProvenanceSchema>;

export const OsintDossierSchema = Type.Object(
  {
    schemaVersion: Type.Literal("osint-dossier.v1"),
    workflow: Type.Literal("osint-research"),
    generatedAt: IsoDateTimeSchema,
    sourceBudget: Type.Integer({ minimum: 1, maximum: 5 }),
    provenance: Type.Optional(OsintProvenanceSchema),
    targets: Type.Array(OsintTargetDossierSchema, {
      minItems: 1,
      maxItems: 5,
    }),
    findings: Type.Array(OsintFindingSchema, { maxItems: 1_000 }),
    coverage: Type.Object(
      {
        state: OsintEvidenceStateSchema,
        targetsRequested: Type.Integer({ minimum: 1, maximum: 5 }),
        targetsCompleted: Type.Integer({ minimum: 0, maximum: 5 }),
        pagesObserved: Type.Integer({ minimum: 0 }),
        evidenceAvailable: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    policy: Type.Object(
      {
        collection: Type.Literal("public_web_only"),
        personalData: Type.Literal("disabled"),
        identityResolution: Type.Literal("disabled"),
        authenticatedCollection: Type.Literal("disabled"),
        darkWebCollection: Type.Literal("disabled"),
      },
      { additionalProperties: false },
    ),
    limitations: Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
      maxItems: 50,
    }),
  },
  { additionalProperties: false },
);
export type OsintDossier = Static<typeof OsintDossierSchema>;

/**
 * Every workflow a run can execute. Shared by StartRunInput and the schedule
 * surfaces so a schedule can only name a workflow the runtime actually has.
 */
export const WorkflowIdSchema = Type.Union([
  Type.Literal("audit"),
  Type.Literal("compare"),
  Type.Literal("keyword-research"),
  Type.Literal("content-plan"),
  Type.Literal("osint-research"),
  Type.Literal("ads-audit"),
  Type.Literal("marketing-report"),
]);
export type WorkflowId = Static<typeof WorkflowIdSchema>;

export const StartRunInputSchema = Type.Object(
  {
    projectId: IdentifierSchema,
    workflowId: Type.Optional(WorkflowIdSchema),
    goal: Type.Optional(Type.String({ maxLength: 240 })),
    options: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);
export type StartRunInput = Static<typeof StartRunInputSchema>;

export const UpdateActionInputSchema = Type.Partial(
  Type.Object({
    owner: Type.Union([Type.String({ maxLength: 240 }), Type.Null()]),
    status: ActionStatusSchema,
    verification: Type.Union([
      Type.Literal("pending"),
      Type.Literal("verified"),
      Type.Literal("regressed"),
    ]),
  }),
);
export type UpdateActionInput = Static<typeof UpdateActionInputSchema>;

export interface Requirement {
  id: string;
  kind: "module" | "integration" | "capability";
  optional?: boolean;
}

export interface ModuleContext {
  runId: string;
  signal: AbortSignal;
  pass: number;
  isFollowUp: boolean;
  getResult<T>(moduleId: string): T | undefined;
}

export interface SeoModule<I, O> {
  readonly kind: "leaf";
  readonly id: string;
  readonly version: string;
  readonly inputSchema: TSchema;
  readonly outputSchema: TSchema;
  readonly requirements: readonly Requirement[];
  run(input: I, context: ModuleContext): Promise<O>;
}

export interface ExecutionNode {
  id: string;
  moduleId: string;
  dependsOn: readonly string[];
  input: unknown;
}

export interface ExecutionPlan {
  workflowId: string;
  nodes: readonly ExecutionNode[];
}

export type LeafModuleRegistry = ReadonlyMap<
  string,
  SeoModule<unknown, unknown>
>;

export interface Workflow<I, O> {
  readonly kind: "workflow";
  readonly id: string;
  readonly inputSchema: TSchema;
  readonly outputSchema: TSchema;
  createPlan(input: I, registry: LeafModuleRegistry): ExecutionPlan;
}

/** Workflows are registered separately from executable leaf modules. */
export type WorkflowRegistry = ReadonlyMap<string, Workflow<unknown, unknown>>;

export interface ProjectService {
  list(): Promise<Project[]>;
  create(input: CreateProjectInput): Promise<Project>;
  overview(projectId: string): Promise<ProjectOverview>;
  delete(input: DeleteProjectInput): Promise<ProjectDeletionReceipt>;
}

export interface RunEvidenceListOptions {
  section: RunEvidenceSection;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface RunLinkExplorerOptions {
  pageUrl: string;
  direction: InternalLinkDirection;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface RunService {
  start(input: StartRunInput, idempotencyKey?: string): Promise<Run>;
  replay(runId: string, idempotencyKey: string): Promise<RunReplay | null>;
  compare(currentRunId: string, baselineRunId: string): Promise<RunComparison>;
  list(projectId?: string): Promise<Run[]>;
  get(runId: string): Promise<Run | null>;
  cancel(runId: string): Promise<Run | null>;
  issues(runId: string): Promise<IssueInstance[]>;
  evidence(
    runId: string,
    options: RunEvidenceListOptions,
  ): Promise<RunEvidencePage | null>;
  links(
    runId: string,
    options: RunLinkExplorerOptions,
  ): Promise<RunLinkExplorer | null>;
}

export interface ActionService {
  list(projectId?: string): Promise<Action[]>;
  update(actionId: string, input: UpdateActionInput): Promise<Action | null>;
  evidence(
    actionId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<ActionEvidenceWorkspace | null>;
  createCheckpoint(actionId: string): Promise<ActionCheckpoint | null>;
  verify(
    actionId: string,
    checkpointId: string,
    idempotencyKey: string,
  ): Promise<ActionVerificationStart | null>;
  outcomes(actionId: string): Promise<ActionOutcomeObservation[]>;
}

export interface IssueService {
  list(
    projectId: string,
    options?: IssueReviewListOptions,
  ): Promise<IssueReviewPage>;
  update(
    fingerprint: string,
    input: UpdateIssueAdjudicationInput,
  ): Promise<IssueReviewItem | null>;
}

export interface ProjectContextService {
  get(projectId: string): Promise<ProjectContextWorkspace | null>;
  update(
    input: UpdateProjectContextInput,
  ): Promise<ProjectContextWorkspace | null>;
  append(
    input: AppendProjectContextJournalInput,
  ): Promise<ProjectContextJournalEntry | null>;
}

export interface ExtractionRuleService {
  templates(): Promise<ExtractionRuleTemplateCatalog>;
  get(projectId: string): Promise<ExtractionRuleWorkspace | null>;
  update(
    input: UpdateExtractionRulesInput,
  ): Promise<ExtractionRuleWorkspace | null>;
  preview(input: PreviewExtractionRulesInput): Promise<ExtractionPreview>;
}

export interface IntegrationService {
  list(projectId?: string): Promise<Integration[]>;
  configure(
    provider: string,
    projectId: string,
    configuration: Record<string, unknown>,
  ): Promise<Integration>;
  test(provider: string, projectId?: string): Promise<Integration>;
}

export interface ScheduleService {
  list(projectId?: string): Promise<Schedule[]>;
}

export interface ReportService {
  get(
    runId: string,
    format: "html" | "pdf" | "csv" | "json",
  ): Promise<Uint8Array | null>;
}

export interface SystemService {
  health(): Promise<{
    status: "ok" | "degraded";
    database: string;
    queue: string;
    version: string;
  }>;
  capabilities(): Promise<Capabilities>;
}

export interface MarketingovoRuntime {
  projects: ProjectService;
  context: ProjectContextService;
  extractionRules: ExtractionRuleService;
  runs: RunService;
  issues: IssueService;
  actions: ActionService;
  integrations: IntegrationService;
  schedules: ScheduleService;
  reports: ReportService;
  system: SystemService;
}
