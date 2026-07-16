export type DataAvailability =
  "fresh" | "stale" | "missing" | "unavailable" | "unknown";

export type ServiceStatus = "healthy" | "degraded" | "offline" | "unknown";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type PriorityLevel = "critical" | "high" | "medium" | "low";
export type ActionStatus = "open" | "acknowledged" | "in_progress" | "resolved";
export type ActionVerification = "pending" | "verified" | "regressed";
export type ActionEffort = "low" | "medium" | "high" | "small" | "large";
export type IssueStatus = "open" | "resolved" | "ignored" | "false_positive";

export interface IssueReviewItem {
  issue: {
    fingerprint: string;
    ruleId: string;
    moduleId: string;
    canonicalUrl: string | null;
    severity: Severity;
    title: string;
    description: string;
    evidence: Array<{
      kind: string;
      label: string;
      value?: unknown;
      source?: string;
      observedAt?: string;
    }>;
    firstSeenAt: string;
    lastSeenAt: string;
    status: IssueStatus;
  };
  latestRunId: string;
  occurrenceCount: number;
  adjudication: {
    projectId: string;
    fingerprint: string;
    status: "ignored" | "false_positive";
    note: string | null;
    actor: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface IssueReviewPage {
  items: IssueReviewItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface ProjectContextProfile {
  summary: string | null;
  audiences: string[];
  markets: string[];
  languages: string[];
  conversionGoals: string[];
  priorityTopics: string[];
  competitors: string[];
  constraints: string[];
}

export interface ProjectContextVersion {
  projectId: string;
  revision: number;
  profile: ProjectContextProfile;
  changeSummary: string;
  actor: string;
  createdAt: string;
}

export interface ProjectContextJournalEntry {
  id: string;
  projectId: string;
  sequence: number;
  kind: "observation" | "decision" | "constraint" | "experiment";
  title: string;
  detail: string;
  sourceRunId: string | null;
  actor: string;
  createdAt: string;
}

export interface ProjectContextWorkspace {
  projectId: string;
  current: ProjectContextVersion | null;
  history: ProjectContextVersion[];
  journal: ProjectContextJournalEntry[];
}

export interface ActionScoreInputs {
  severity: number;
  organicExposure: number | null;
  conversionExposure: number | null;
  urlReach: number;
  confidence: number;
  unavailable: string[];
}

export interface DataMeta {
  state?: DataAvailability;
  generatedAt?: string | null;
  lastUpdatedAt?: string | null;
  warnings?: string[];
  sources?: SourceState[];
  requestId?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: DataMeta;
}

export interface SourceState {
  id: string;
  name: string;
  status: ServiceStatus;
  availability?: DataAvailability;
  updatedAt?: string | null;
  message?: string | null;
  coverage?: number | null;
}

export interface Site {
  id: string;
  name: string;
  url: string;
  status?: "active" | "paused" | "setup";
  lastAuditAt?: string | null;
}

export interface MetricValue {
  value?: number | null;
  unit?: "number" | "percent" | "milliseconds" | "seconds" | "currency";
  currency?: string;
  change?: number | null;
  status?: DataAvailability;
  updatedAt?: string | null;
  coverage?: number | null;
  note?: string | null;
}

export interface Evidence {
  label: string;
  value?: string | number | null;
  source?: string | null;
  url?: string | null;
}

export interface SeoAction {
  id: string;
  title: string;
  summary: string;
  moduleId?: string | null;
  ruleId?: string | null;
  category?: string | null;
  status?: ActionStatus;
  verification?: ActionVerification;
  priority?: PriorityLevel | null;
  priorityScore?: number | null;
  priorityExplanation?: string | null;
  impact?: "high" | "medium" | "low" | null;
  effort?: ActionEffort | null;
  confidence?: number | null;
  whyNow?: string | null;
  affectedUrls?: number | null;
  affectedUrlList?: string[];
  trafficAtRisk?: number | null;
  owner?: string | null;
  dueAt?: string | null;
  scoreVersion?: "priority-v1" | string;
  scoreInputs?: ActionScoreInputs;
  createdAt?: string | null;
  updatedAt?: string | null;
  evidence?: Evidence[];
}

export type ActionLifecycle = "new" | "persistent" | "resolved" | "reappeared";

export type VerificationRunState =
  | "not_started"
  | "queued"
  | "running"
  | "verified"
  | "regressed"
  | "inconclusive";

export interface ActionIssueEvidence {
  kind?: string;
  label: string;
  value?: unknown;
  source?: string | null;
  observedAt?: string | null;
  url?: string | null;
}

export interface ActionEvidenceUrl {
  url: string;
  title: string | null;
  statusCode: number | null;
  indexable: boolean | null;
  lifecycle: ActionLifecycle;
  issue: {
    fingerprint: string;
    severity: Severity;
    title: string;
    description: string;
    firstSeenAt: string;
    lastSeenAt: string;
    evidence: ActionIssueEvidence[];
  } | null;
  gsc: {
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
    state: DataAvailability | "available" | "failed";
    periodStart: string | null;
    periodEnd: string | null;
  } | null;
  ga4: {
    sessions: number | null;
    keyEvents: number | null;
    state: DataAvailability | "available" | "failed";
    periodStart: string | null;
    periodEnd: string | null;
  } | null;
  cwv: {
    lcp: number | null;
    cls: number | null;
    ttfb: number | null;
    state: DataAvailability | "available" | "failed";
  } | null;
}

export interface ActionEvidenceResponse {
  action: SeoAction & {
    moduleId: string;
    ruleId: string;
    verification: ActionVerification;
    scoreVersion: "priority-v1" | string;
    scoreInputs: ActionScoreInputs;
    affectedUrlList: string[];
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalUrls: number;
    issueOccurrences: number;
    newOccurrences: number;
    persistentOccurrences: number;
    resolvedOccurrences: number;
    reappearedOccurrences: number;
    clicks: number | null;
    impressions: number | null;
    keyEvents: number | null;
  };
  urls: ActionEvidenceUrl[];
  history: Array<{
    runId: string;
    observedAt: string;
    status: string;
    affectedCount: number;
  }>;
  sources: SourceState[];
  verification: {
    state: VerificationRunState;
    checkpointId: string | null;
    runId: string | null;
    coverage: number | null;
    checkedAt: string | null;
    reason: string | null;
  };
  pageInfo: { nextCursor: string | null; total: number };
}

export interface ActionCheckpoint {
  id: string;
  state: "active";
  createdAt: string;
}

export interface ActionVerificationRun {
  runId: string;
  verificationState: "queued";
}

export interface TrendPoint {
  date: string;
  value?: number | null;
}

export interface Overview {
  siteHealth: MetricValue;
  organicClicks: MetricValue;
  organicKeyEvents: MetricValue;
  indexableCoverage: MetricValue;
  coreWebVitalsPassRate: MetricValue;
  criticalRegressions: MetricValue;
  topActions?: SeoAction[];
  healthTrend?: TrendPoint[];
  sources?: SourceState[];
}

export interface AuditRun {
  id: string;
  workflowId: string;
  startedAt: string;
  completedAt?: string | null;
  status:
    "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
  progress?: number | null;
  trigger?: "manual" | "scheduled" | "webhook" | string;
  pagesCrawled?: number | null;
  issuesFound?: number | null;
  healthScore?: number | null;
  initiatedBy?: string | null;
  message?: string | null;
}

export interface AuditRunDetail extends AuditRun {
  summary?: string | null;
  issueBreakdown?: Array<{ severity: Severity; count?: number | null }>;
  sources?: SourceState[];
  log?: Array<{
    at: string;
    message: string;
    level?: "info" | "warning" | "error";
  }>;
}

export interface RunReplay {
  sourceRunId: string;
  configurationVersion: 1;
  configurationHash: string;
  run: AuditRun;
}

export interface RunComparisonIssueChange {
  fingerprint: string;
  ruleId: string;
  moduleId: string;
  canonicalUrl: string | null;
  title: string;
  change: "new" | "resolved" | "severity_increased" | "severity_decreased";
  baselineSeverity: Severity | null;
  currentSeverity: Severity | null;
}

export interface RunComparisonPageSnapshot {
  statusCode: number | null;
  title: string | null;
  indexable: boolean | null;
}

export interface RunComparisonPageChange {
  canonicalUrl: string;
  kind: "added" | "removed" | "status_changed" | "indexability_changed";
  impact: "regression" | "improvement" | "neutral";
  before: RunComparisonPageSnapshot | null;
  after: RunComparisonPageSnapshot | null;
}

export interface RunComparisonLinkSnapshot {
  targetPageUrl: string | null;
  targetStatusCode: number | null;
  targetIndexable: boolean | null;
  targetState: "direct" | "redirected" | "broken" | "uncrawled";
  occurrences: number;
  followOccurrences: number;
  nofollowOccurrences: number;
  anchorTexts: string[];
  placements: Array<
    "header" | "navigation" | "main" | "aside" | "footer" | "body"
  >;
}

export interface RunComparisonLinkChange {
  sourceUrl: string;
  targetUrl: string;
  change: "added" | "removed" | "changed";
  impact: "regression" | "improvement" | "neutral";
  reasons: Array<
    | "target_resolution"
    | "target_indexability"
    | "follow_policy"
    | "occurrences"
    | "anchor_text"
    | "placement"
  >;
  before: RunComparisonLinkSnapshot | null;
  after: RunComparisonLinkSnapshot | null;
}

export interface RunComparison {
  scoreVersion: "regression-v1";
  generatedAt: string;
  state: "available" | "partial" | "unavailable";
  projectId: string;
  baselineRun: {
    id: string;
    requestedAt: string;
    status: "succeeded" | "partial";
  };
  currentRun: {
    id: string;
    requestedAt: string;
    status: "succeeded" | "partial";
  };
  configuration: {
    state: "matched" | "different" | "unavailable";
    baselineHash: string | null;
    currentHash: string | null;
    differences: string[];
  };
  summary: {
    baselinePages: number;
    currentPages: number;
    addedPages: number;
    removedPages: number;
    statusChanges: number;
    indexabilityChanges: number;
    baselineIssues: number;
    currentIssues: number;
    newIssues: number;
    resolvedIssues: number;
    persistentIssues: number;
    severityIncreases: number;
    severityDecreases: number;
    reviewedExcludedBaseline: number;
    reviewedExcludedCurrent: number;
    baselineHealth: number | null;
    currentHealth: number | null;
    healthDelta: number | null;
    regressionScore: number;
  };
  issueRegressions: RunComparisonIssueChange[];
  issueImprovements: RunComparisonIssueChange[];
  pageChanges: RunComparisonPageChange[];
  linkGraph: {
    version: "link-delta-v1";
    state: "available" | "partial" | "unavailable";
    baseline: { pageCount: number; graphPageCount: number; edgeCount: number };
    current: { pageCount: number; graphPageCount: number; edgeCount: number };
    summary: {
      addedEdges: number;
      removedEdges: number;
      changedEdges: number;
      regressions: number;
      improvements: number;
    };
    changes: RunComparisonLinkChange[];
    truncated: boolean;
    warnings: string[];
  };
  truncated: {
    issueRegressions: boolean;
    issueImprovements: boolean;
    pageChanges: boolean;
  };
  warnings: string[];
}

export type RunEvidenceSection =
  "crawl" | "redirects" | "hreflang" | "extractions";

export interface CrawlPathEvidence {
  kind: "crawl";
  sourceUrl: string;
  finalUrl: string;
  title: string | null;
  statusCode: number | null;
  indexable: boolean | null;
  crawlDepth: number | null;
  discoveredFrom: string | null;
}

export interface RedirectPathEvidence {
  kind: "redirect";
  sourceUrl: string;
  finalUrl: string;
  finalStatusCode: number | null;
  hopCount: number;
  chain: string[];
}

export interface HreflangPageEvidence {
  kind: "hreflang";
  sourceUrl: string;
  finalUrl: string;
  htmlLang: string | null;
  selfLanguage: string | null;
  hasXDefault: boolean;
  alternates: Array<{
    lang: string;
    declaredUrl: string;
    resolvedUrl: string | null;
    selfReference: boolean;
    targetState: "self" | "crawled" | "not_crawled" | "invalid";
    targetStatusCode: number | null;
    reciprocal:
      | "matched"
      | "missing"
      | "language_mismatch"
      | "not_applicable"
      | "unavailable";
    expectedReturnLanguage: string | null;
    observedReturnLanguages: string[];
  }>;
}

export interface ExtractionPageEvidence {
  kind: "extraction";
  sourceUrl: string;
  finalUrl: string;
  fields: Array<{
    label: string;
    value: string | null;
    truncated: boolean;
  }>;
}

export type RunEvidenceItem =
  | CrawlPathEvidence
  | RedirectPathEvidence
  | HreflangPageEvidence
  | ExtractionPageEvidence;

export interface SitemapEvidence {
  state:
    "available" | "not_found" | "fetch_failed" | "invalid" | "not_captured";
  sourceUrl: string | null;
  fetchStatusCode: number | null;
  files: Array<{
    url: string;
    kind: "urlset" | "sitemapindex" | "unknown";
    statusCode: number | null;
    locCount: number;
  }>;
  declaredUrls: number | null;
  discoveredIndexableUrls: number | null;
  matchedIndexableUrls: number | null;
  coverage: number | null;
  missingIndexable: {
    total: number | null;
    urls: string[];
    complete: boolean;
  };
  declaredNotCrawled: {
    total: number | null;
    urls: string[];
    complete: boolean;
  };
  brokenDeclared: {
    total: number | null;
    urls: string[];
    complete: boolean;
  };
  warnings: string[];
}

export interface RunEvidencePage {
  runId: string;
  generatedAt: string | null;
  state: "available" | "partial" | "unavailable";
  section: RunEvidenceSection;
  items: RunEvidenceItem[];
  pageInfo: {
    total: number;
    offset: number;
    limit: number;
    nextOffset: number | null;
  };
  sitemap: SitemapEvidence;
  warnings: string[];
}

export type InternalLinkDirection = "inlinks" | "outlinks";

export interface InternalLinkEdge {
  sourceUrl: string;
  sourceTitle: string | null;
  targetUrl: string;
  targetPageUrl: string | null;
  targetTitle: string | null;
  targetStatusCode: number | null;
  targetIndexable: boolean | null;
  targetState: "direct" | "redirected" | "broken" | "uncrawled";
  occurrences: number;
  followOccurrences: number;
  nofollowOccurrences: number;
  anchorTexts: string[];
  placements: Array<
    "header" | "navigation" | "main" | "aside" | "footer" | "body"
  >;
}

export interface RunLinkExplorer {
  version: "link-graph-v1";
  runId: string;
  generatedAt: string | null;
  state: "available" | "partial" | "unavailable";
  page: {
    url: string;
    title: string | null;
    statusCode: number | null;
    indexable: boolean | null;
    crawlDepth: number | null;
  };
  direction: InternalLinkDirection;
  summary: {
    inlinkSources: number;
    inlinkOccurrences: number;
    outlinkTargets: number;
    outlinkOccurrences: number;
    followedInlinkOccurrences: number;
    nofollowInlinkOccurrences: number;
    followedOutlinkOccurrences: number;
    nofollowOutlinkOccurrences: number;
    brokenOutlinkTargets: number;
    redirectedOutlinkTargets: number;
    uncrawledOutlinkTargets: number;
  };
  items: InternalLinkEdge[];
  pageInfo: {
    total: number;
    offset: number;
    limit: number;
    nextOffset: number | null;
  };
  warnings: string[];
}

export interface PageRecord {
  id?: string;
  runId?: string;
  url: string;
  title?: string | null;
  statusCode?: number | null;
  indexability?:
    "indexable" | "blocked" | "noindex" | "canonicalized" | "unknown";
  indexabilityReason?:
    | "indexable"
    | "robots_blocked"
    | "meta_noindex"
    | "x_robots_noindex"
    | "canonicalized"
    | "non_html"
    | "redirect"
    | "http_error"
    | "no_content"
    | "fetch_error"
    | "missing_status"
    | "unexpected_status"
    | "missing_content_type"
    | "robots_unknown"
    | "parse_failed"
    | string
    | null;
  crawlDepth?: number | null;
  linkGraphState?: "available" | "unavailable";
  inlinkSources?: number | null;
  inlinkOccurrences?: number | null;
  outlinkTargets?: number | null;
  outlinkOccurrences?: number | null;
  organicClicks?: number | null;
  organicKeyEvents?: number | null;
  issues?: number | null;
  coreWebVitals?: "pass" | "needs_improvement" | "fail" | "unavailable";
  lastCrawledAt?: string | null;
}

export interface KeywordOpportunity {
  id: string;
  keyword: string;
  intent?:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational"
    | "unknown";
  position?: number | null;
  clicks?: number | null;
  impressions?: number | null;
  volume?: number | null;
  difficulty?: number | null;
  opportunityScore?: number | null;
  targetUrl?: string | null;
  cluster?: string | null;
}

export interface KeywordWorkspace {
  opportunities?: KeywordOpportunity[];
  clusters?: Array<{
    id: string;
    name: string;
    keywords?: number | null;
    contentCoverage?: number | null;
    recommendedBrief?: string | null;
  }>;
  providerUsage?: {
    actualCostUsd: number;
    billableRequests: number;
    unreportedBillableRequests: number;
    freeRequests: number;
  } | null;
}

export interface Competitor {
  id: string;
  domain: string;
  technicalHealth?: number | null;
  technicalHealthChange?: number | null;
  sharedKeywords?: number | null;
  keywordGaps?: number | null;
  contentGaps?: number | null;
  lastUpdatedAt?: string | null;
}

export interface MonitoringSchedule {
  id: string;
  name: string;
  cadence: string;
  cron?: string;
  timezone?: string;
  enabled: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  status?: ServiceStatus;
}

export interface MonitoringAlert {
  id: string;
  title: string;
  severity: Severity;
  createdAt: string;
  status?: "open" | "acknowledged" | "resolved";
  detail?: string | null;
}

export interface MonitoringWorkspace {
  schedules?: MonitoringSchedule[];
  alerts?: MonitoringAlert[];
}

export interface Report {
  id: string;
  name: string;
  type?: string;
  status?: "ready" | "generating" | "failed" | "scheduled";
  generatedAt?: string | null;
  scheduledFor?: string | null;
  downloadUrl?: string | null;
  recipients?: string[];
}

export interface Integration {
  id: string;
  name: string;
  category?: string;
  status:
    | "connected"
    | "degraded"
    | "expired"
    | "rate_limited"
    | "failed"
    | "not_configured"
    | "checking";
  description?: string | null;
  accountLabel?: string | null;
  lastSyncAt?: string | null;
  quota?: {
    remaining: number;
    limit: number | null;
    resetsAt: string | null;
  } | null;
  lastError?: string | null;
  permissions?: string[];
  supportsApiKey?: boolean;
  setupUrl?: string | null;
  credentialFields?: Array<{
    key: string;
    label: string;
    type?: "secret" | "text";
    required?: boolean;
    help?: string | null;
  }>;
  configuration?: Record<string, unknown>;
  configurationFields?: Array<{
    key: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    help?: string | null;
  }>;
}

export interface DashboardSettings {
  siteName?: string | null;
  siteUrl?: string | null;
  timezone?: string | null;
  reportingCurrency?: string | null;
  weeklyDigest?: boolean;
  alertEmail?: string | null;
  dataRetentionDays?: number | null;
}

export type ExtractionRuleType = "text" | "html" | "attribute";

export interface ExtractionRule {
  id: string;
  label: string;
  selector: string;
  type: ExtractionRuleType;
  attribute: string | null;
  regex: string | null;
  enabled: boolean;
}

export type ExtractionRuleTemplateCategory =
  "social" | "editorial" | "commerce" | "migration";

export interface ExtractionRuleTemplate {
  id: string;
  name: string;
  category: ExtractionRuleTemplateCategory;
  description: string;
  recommendedPage: string;
  assumptions: string[];
  rules: ExtractionRule[];
}

export interface ExtractionRuleTemplateCatalog {
  version: "extraction-template-catalog-v1";
  importMode: "review_required";
  templates: ExtractionRuleTemplate[];
}

export interface ExtractionRuleSetVersion {
  projectId: string;
  revision: number;
  configurationHash: string;
  rules: ExtractionRule[];
  changeSummary: string;
  actor: string;
  createdAt: string;
}

export interface ExtractionRuleWorkspace {
  projectId: string;
  current: ExtractionRuleSetVersion | null;
  history: ExtractionRuleSetVersion[];
}

export interface ExtractionPreview {
  projectId: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  renderMode: "static" | "js";
  responseTimeMs: number;
  configurationHash: string;
  fields: Array<{
    ruleId: string;
    label: string;
    value: string | null;
    truncated: boolean;
  }>;
}

export interface ProjectImportResult {
  project: { id: string; name: string; canonicalUrl: string };
  sourceProjectId: string;
  importedAt: string;
  counts: {
    runs: number;
    runModules: number;
    pages: number;
    issues: number;
    issueAdjudications: number;
    contextVersions: number;
    contextEntries: number;
    extractionRuleVersions: number;
    actions: number;
    metrics: number;
    schedules: number;
    connectors: number;
    customRules: number;
    artifacts: number;
  };
  schedulesDisabled: true;
  reconnectProviders: string[];
  warnings: string[];
}

export interface ProjectDeletionReceipt {
  projectId: string;
  deletedAt: string;
  counts: {
    runs: number;
    pages: number;
    issueInstances: number;
    actions: number;
    schedules: number;
    artifacts: number;
    contextVersions: number;
    contextEntries: number;
    extractionRuleVersions: number;
  };
  artifactCleanup: "complete" | "scheduled";
  globalCredentialsRetained: true;
}

export interface HealthCheck {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs?: number | null;
  checkedAt?: string | null;
  message?: string | null;
}

export interface SystemHealth {
  status: ServiceStatus;
  version?: string | null;
  uptimeSeconds?: number | null;
  checkedAt?: string | null;
  checks?: HealthCheck[];
}

export interface ListResponse<T> {
  items: T[];
  total?: number | null;
}

export interface CreateSiteInput {
  name: string;
  url: string;
}

export interface StartAuditInput {
  siteId: string;
  mode?: "full" | "incremental";
  /** Plain-language outcome selected during guided setup and stored with the run. */
  goal?: string;
  /** Exact hostnames explicitly approved for private-network crawling on this run. */
  privateHostAllowlist?: string[];
  /** Exact URL cohort for list-mode audits; secrets and headers are forbidden. */
  exactUrls?: string[];
}
