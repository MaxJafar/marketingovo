import { Type } from "@sinclair/typebox";
import type {
  Action,
  ActionCheckpoint,
  ActionEvidenceWorkspace,
  ActionOutcomeObservation,
  Evidence,
  MetricValue,
} from "@marketingovo/contracts";

const IdentifierSchema = Type.String({ minLength: 1, maxLength: 160 });
const DateTimeSchema = Type.String({ format: "date-time" });
const UrlSchema = Type.String({ format: "uri", pattern: "^https?://" });

const DataAvailabilitySchema = Type.Union([
  Type.Literal("fresh"),
  Type.Literal("stale"),
  Type.Literal("missing"),
  Type.Literal("unavailable"),
  Type.Literal("unknown"),
  Type.Literal("available"),
  Type.Literal("failed"),
]);

const ActionScoreInputsSchema = Type.Object(
  {
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
  },
  { additionalProperties: false },
);

const DashboardActionEvidenceSchema = Type.Object(
  {
    id: IdentifierSchema,
    title: Type.String(),
    summary: Type.String(),
    moduleId: IdentifierSchema,
    ruleId: IdentifierSchema,
    status: Type.Union([
      Type.Literal("open"),
      Type.Literal("acknowledged"),
      Type.Literal("in_progress"),
      Type.Literal("resolved"),
    ]),
    verification: Type.Union([
      Type.Literal("pending"),
      Type.Literal("verified"),
      Type.Literal("regressed"),
    ]),
    priority: Type.Union([
      Type.Literal("critical"),
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
    ]),
    priorityScore: Type.Number({ minimum: 0, maximum: 100 }),
    priorityExplanation: Type.String(),
    impact: Type.Union([
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
    ]),
    effort: Type.Union([
      Type.Literal("small"),
      Type.Literal("medium"),
      Type.Literal("large"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    whyNow: Type.String(),
    affectedUrls: Type.Integer({ minimum: 0 }),
    affectedUrlList: Type.Array(UrlSchema),
    owner: Type.Union([Type.String(), Type.Null()]),
    scoreVersion: Type.Literal("priority-v1"),
    scoreInputs: ActionScoreInputsSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    evidence: Type.Array(
      Type.Object(
        {
          label: Type.String(),
          value: UrlSchema,
          source: Type.Literal("crawl"),
          url: UrlSchema,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const RawIssueEvidenceSchema = Type.Object(
  {
    kind: Type.Optional(Type.String()),
    label: Type.String(),
    value: Type.Optional(Type.Unknown()),
    source: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    observedAt: Type.Optional(Type.Union([DateTimeSchema, Type.Null()])),
    url: Type.Optional(Type.Union([UrlSchema, Type.Null()])),
  },
  { additionalProperties: false },
);

const DashboardIssueSchema = Type.Object(
  {
    fingerprint: Type.String({ minLength: 16, maxLength: 128 }),
    severity: Type.Union([
      Type.Literal("critical"),
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
      Type.Literal("info"),
    ]),
    title: Type.String(),
    description: Type.String(),
    firstSeenAt: DateTimeSchema,
    lastSeenAt: DateTimeSchema,
    evidence: Type.Array(RawIssueEvidenceSchema),
  },
  { additionalProperties: false },
);

const DashboardSearchEvidenceSchema = Type.Object(
  {
    clicks: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    impressions: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    ctr: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]),
    position: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    state: DataAvailabilitySchema,
    periodStart: Type.Union([Type.String({ format: "date" }), Type.Null()]),
    periodEnd: Type.Union([Type.String({ format: "date" }), Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardAnalyticsEvidenceSchema = Type.Object(
  {
    sessions: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    keyEvents: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    state: DataAvailabilitySchema,
    periodStart: Type.Union([Type.String({ format: "date" }), Type.Null()]),
    periodEnd: Type.Union([Type.String({ format: "date" }), Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardCwvEvidenceSchema = Type.Object(
  {
    lcp: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    cls: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    ttfb: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    state: DataAvailabilitySchema,
  },
  { additionalProperties: false },
);

const DashboardUrlEvidenceSchema = Type.Object(
  {
    url: UrlSchema,
    title: Type.Union([Type.String(), Type.Null()]),
    statusCode: Type.Union([Type.Integer(), Type.Null()]),
    indexable: Type.Union([Type.Boolean(), Type.Null()]),
    lifecycle: Type.Union([
      Type.Literal("new"),
      Type.Literal("persistent"),
      Type.Literal("resolved"),
      Type.Literal("reappeared"),
    ]),
    issue: Type.Union([DashboardIssueSchema, Type.Null()]),
    gsc: Type.Union([DashboardSearchEvidenceSchema, Type.Null()]),
    ga4: Type.Union([DashboardAnalyticsEvidenceSchema, Type.Null()]),
    cwv: Type.Union([DashboardCwvEvidenceSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

const DashboardSourceSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    status: Type.Union([
      Type.Literal("healthy"),
      Type.Literal("degraded"),
      Type.Literal("offline"),
      Type.Literal("unknown"),
    ]),
    availability: Type.Union([
      Type.Literal("fresh"),
      Type.Literal("stale"),
      Type.Literal("missing"),
      Type.Literal("unavailable"),
      Type.Literal("unknown"),
    ]),
    updatedAt: Type.Union([DateTimeSchema, Type.Null()]),
    message: Type.Union([Type.String(), Type.Null()]),
    coverage: Type.Union([
      Type.Number({ minimum: 0, maximum: 100 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

const DashboardVerificationSchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("not_started"),
      Type.Literal("queued"),
      Type.Literal("running"),
      Type.Literal("verified"),
      Type.Literal("regressed"),
      Type.Literal("inconclusive"),
    ]),
    checkpointId: Type.Union([IdentifierSchema, Type.Null()]),
    runId: Type.Union([IdentifierSchema, Type.Null()]),
    coverage: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    checkedAt: Type.Union([DateTimeSchema, Type.Null()]),
    reason: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const ActionEvidenceQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
  },
  { additionalProperties: false },
);

export const DashboardActionEvidenceResponseSchema = Type.Object(
  {
    action: DashboardActionEvidenceSchema,
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
    urls: Type.Array(DashboardUrlEvidenceSchema),
    history: Type.Array(
      Type.Object(
        {
          runId: IdentifierSchema,
          observedAt: DateTimeSchema,
          status: Type.String(),
          affectedCount: Type.Integer({ minimum: 0 }),
        },
        { additionalProperties: false },
      ),
    ),
    sources: Type.Array(DashboardSourceSchema),
    verification: DashboardVerificationSchema,
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

export const ActionCheckpointInputSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const DashboardActionCheckpointSchema = Type.Object(
  {
    id: IdentifierSchema,
    state: Type.Literal("active"),
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

export const ActionVerificationInputSchema = Type.Object(
  { checkpointId: IdentifierSchema },
  { additionalProperties: false },
);

const OutcomePeriodSchema = Type.Object(
  {
    start: Type.String({ format: "date" }),
    end: Type.String({ format: "date" }),
  },
  { additionalProperties: false },
);

export const DashboardActionOutcomeSchema = Type.Object(
  {
    id: IdentifierSchema,
    checkpointId: IdentifierSchema,
    windowDays: Type.Union([
      Type.Literal(7),
      Type.Literal(14),
      Type.Literal(28),
    ]),
    state: Type.Union([
      Type.Literal("pending"),
      Type.Literal("observed"),
      Type.Literal("inconclusive"),
      Type.Literal("unavailable"),
    ]),
    period: Type.Union([OutcomePeriodSchema, Type.Null()]),
    targetChange: Type.Union([Type.Number(), Type.Null()]),
    controlChange: Type.Union([Type.Number(), Type.Null()]),
    controlAdjustedChange: Type.Union([Type.Number(), Type.Null()]),
    confidence: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    limitations: Type.Array(Type.String()),
    observedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const DashboardActionOutcomesSchema = Type.Object(
  {
    items: Type.Array(DashboardActionOutcomeSchema),
    total: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

function priorityLabel(score: number) {
  return score >= 80
    ? ("critical" as const)
    : score >= 60
      ? ("high" as const)
      : score >= 35
        ? ("medium" as const)
        : ("low" as const);
}

function impactLabel(impact: number) {
  return impact >= 0.7
    ? ("high" as const)
    : impact >= 0.4
      ? ("medium" as const)
      : ("low" as const);
}

function effortLabel(effort: Action["effort"]) {
  return effort === "low"
    ? ("small" as const)
    : effort === "high"
      ? ("large" as const)
      : ("medium" as const);
}

function dashboardDetailedAction(action: Action) {
  if (!action.ruleId || !action.moduleId) {
    throw new Error(
      `Action evidence ${action.id} is missing its rule or module identity`,
    );
  }
  return {
    id: action.id,
    title: action.title,
    summary: action.whyNow,
    moduleId: action.moduleId,
    ruleId: action.ruleId,
    status: action.status,
    verification: action.verification,
    priority: priorityLabel(action.priorityScore),
    priorityScore: action.priorityScore,
    priorityExplanation: `priority-v1: severity ${action.scoreInputs.severity.toFixed(2)}, organic ${action.scoreInputs.organicExposure?.toFixed(2) ?? "unavailable"}, conversion ${action.scoreInputs.conversionExposure?.toFixed(2) ?? "unavailable"}, reach ${action.scoreInputs.urlReach.toFixed(2)}, confidence ${action.scoreInputs.confidence.toFixed(2)}.`,
    impact: impactLabel(action.impact),
    effort: effortLabel(action.effort),
    confidence: action.confidence,
    whyNow: action.whyNow,
    affectedUrls: action.affectedUrls.length,
    affectedUrlList: [...action.affectedUrls],
    owner: action.owner,
    scoreVersion: action.scoreVersion,
    scoreInputs: action.scoreInputs,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    evidence: action.affectedUrls.slice(0, 5).map((url) => ({
      label: "Affected URL",
      value: url,
      source: "crawl" as const,
      url,
    })),
  };
}

function dashboardRawEvidence(evidence: Evidence) {
  return {
    kind: evidence.kind,
    label: evidence.label,
    ...(evidence.value !== undefined ? { value: evidence.value } : {}),
    ...(evidence.source !== undefined ? { source: evidence.source } : {}),
    ...(evidence.observedAt !== undefined
      ? { observedAt: evidence.observedAt }
      : {}),
  };
}

const sourceLabels: Readonly<Record<string, string>> = {
  crawl: "Crawl",
  gsc: "Google Search Console",
  "google-search-console": "Google Search Console",
  ga4: "Google Analytics 4",
  "google-analytics-4": "Google Analytics 4",
  lighthouse: "Lighthouse",
  psi: "PageSpeed Insights",
  "pagespeed-insights": "PageSpeed Insights",
};

function dashboardSource(source: MetricValue) {
  const status =
    source.state === "available"
      ? ("healthy" as const)
      : source.state === "stale"
        ? ("degraded" as const)
        : source.state === "failed" || source.state === "unavailable"
          ? ("offline" as const)
          : ("unknown" as const);
  const availability =
    source.state === "available"
      ? ("fresh" as const)
      : source.state === "stale"
        ? ("stale" as const)
        : source.state === "failed" || source.state === "unavailable"
          ? ("unavailable" as const)
          : ("unknown" as const);
  return {
    id: source.source,
    name: sourceLabels[source.source] ?? source.source,
    status,
    availability,
    updatedAt: source.observedAt,
    message: source.note ?? null,
    coverage: source.coverage === null ? null : source.coverage * 100,
  };
}

export function dashboardActionEvidence(workspace: ActionEvidenceWorkspace) {
  return {
    action: dashboardDetailedAction(workspace.action),
    summary: workspace.summary,
    urls: workspace.urls.map((item) => ({
      url: item.url,
      title: item.title,
      statusCode: item.statusCode,
      indexable: item.indexable,
      lifecycle: item.lifecycle,
      issue: item.issue
        ? {
            fingerprint: item.issue.fingerprint,
            severity: item.issue.severity,
            title: item.issue.title,
            description: item.issue.description,
            firstSeenAt: item.issue.firstSeenAt,
            lastSeenAt: item.issue.lastSeenAt,
            evidence: item.issue.evidence.map(dashboardRawEvidence),
          }
        : null,
      gsc: item.gsc
        ? {
            clicks: item.gsc.clicks,
            impressions: item.gsc.impressions,
            ctr: item.gsc.ctr,
            position: item.gsc.position,
            state: item.gsc.state,
            periodStart: item.gsc.period.start,
            periodEnd: item.gsc.period.end,
          }
        : null,
      ga4: item.ga4
        ? {
            sessions: item.ga4.sessions,
            keyEvents: item.ga4.keyEvents,
            state: item.ga4.state,
            periodStart: item.ga4.period.start,
            periodEnd: item.ga4.period.end,
          }
        : null,
      cwv: item.cwv,
    })),
    history: workspace.history,
    sources: workspace.sources.map(dashboardSource),
    verification: workspace.verification,
    pageInfo: workspace.pageInfo,
  };
}

export function dashboardActionCheckpoint(checkpoint: ActionCheckpoint) {
  if (checkpoint.state !== "active") {
    throw new Error(
      `New action checkpoint ${checkpoint.id} has unexpected state ${checkpoint.state}`,
    );
  }
  return {
    id: checkpoint.id,
    state: checkpoint.state,
    createdAt: checkpoint.createdAt,
  };
}

export function dashboardActionOutcomes(
  outcomes: readonly ActionOutcomeObservation[],
) {
  return { items: [...outcomes], total: outcomes.length };
}
