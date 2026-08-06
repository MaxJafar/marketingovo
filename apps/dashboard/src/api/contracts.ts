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
  /** Brand-owned public profiles checked against the crawl for linkage. */
  brandProfiles: BrandProfile[];
  constraints: string[];
}

export interface BrandProfile {
  label: string;
  url: string;
}

/** One brand profile as the audit found it. */
export interface BrandProfilePresence {
  id: string;
  label: string;
  url: string;
  linkingPageCount: number;
  linkedFrom: string[];
  declaredInSameAs: boolean;
  reachability: "reachable" | "unreachable" | "unchecked";
  reachabilityDetail?: string | null;
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
  /** `null` when this workspace has no website. */
  url: string | null;
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
    | "queued"
    | "running"
    | "succeeded"
    | "completed"
    | "partial"
    | "failed"
    | "cancelled";
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

export type OsintEvidenceState =
  "available" | "missing" | "insufficient" | "contradictory";

export type OsintSourceClass =
  "public_web" | "first_party" | "licensed_provider" | "user_import";

export type OsintEntityType =
  "organization" | "domain" | "page" | "profile" | "feed";

export type OsintRelationshipType =
  "owns" | "links_to" | "same_as" | "publishes_via";

export interface OsintEvidence {
  id: string;
  kind: string;
  label: string;
  value: unknown;
  state: OsintEvidenceState;
  sourceUrl: string | null;
  sourceClass: OsintSourceClass;
  observedAt: string;
  confidence: number;
  claimHash?: string;
}

export interface OsintEntity {
  id: string;
  type: OsintEntityType;
  label: string;
  url: string | null;
  exactMatch: boolean;
}

export interface OsintRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: OsintRelationshipType;
  evidenceIds: string[];
}

export interface OsintPublishingCadence {
  feedUrl: string;
  itemsInFeed: number;
  datedItems: number;
  freshnessSeconds: number | null;
  cadenceDays: number | null;
  spanDays: number | null;
  intervals: number | null;
  newestPublishedAt: string | null;
  oldestPublishedAt: string | null;
}

export interface OsintTargetDossier {
  targetUrl: string;
  finalUrl: string | null;
  host: string | null;
  status: "available" | "partial" | "failed";
  pagesObserved: number;
  evidence: OsintEvidence[];
  entities: OsintEntity[];
  relationships: OsintRelationship[];
  publishingCadence: {
    target: string;
    cadence: OsintPublishingCadence | null;
    unavailable: string | null;
    detail?: string;
  } | null;
  error: string | null;
}

export interface OsintFinding {
  id: string;
  severity: "info" | "low" | "medium";
  title: string;
  statement: string;
  evidenceIds: string[];
  confidence: number;
  actionable: boolean;
}

export interface OsintProvenance {
  captureMethod: "same_origin_public_crawl";
  claimHashAlgorithm: "sha256";
  evidenceDigest: string;
  evidenceCount: number;
  sourceCount: number;
}

export interface OsintDossier {
  schemaVersion: "osint-dossier.v1";
  workflow: "osint-research";
  generatedAt: string;
  sourceBudget: number;
  provenance?: OsintProvenance;
  targets: OsintTargetDossier[];
  findings: OsintFinding[];
  coverage: {
    state: OsintEvidenceState;
    targetsRequested: number;
    targetsCompleted: number;
    pagesObserved: number;
    evidenceAvailable: number;
  };
  policy: {
    collection: "public_web_only";
    personalData: "disabled";
    identityResolution: "disabled";
    authenticatedCollection: "disabled";
    darkWebCollection: "disabled";
  };
  limitations: string[];
}

export interface OsintChange {
  id: string;
  targetUrl: string;
  change: "added" | "removed" | "changed";
  category: string;
  label: string;
  before: OsintEvidence | null;
  after: OsintEvidence | null;
  sourceUrl: string | null;
  evidenceIds: string[];
  confidence: number;
}

export interface OsintWorkspace {
  dossier: OsintDossier | null;
  previousGeneratedAt: string | null;
  compared: boolean;
  changes: OsintChange[];
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
  /** Mean days between posts, from the site's own feed. Null when unmeasurable. */
  cadenceDays?: number | null;
  /** Seconds since their newest post. Null when unmeasurable. */
  freshnessSeconds?: number | null;
  lastUpdatedAt?: string | null;
}

/** A topic the reference sites cover that this site does not. */
export interface ContentGapTerm {
  term: string;
  referencesCovering: number;
  referenceDensity?: number | null;
  targetDensity?: number | null;
}

export interface CompetitorWorkspace {
  items: Competitor[];
  total?: number | null;
  contentGapTerms: ContentGapTerm[];
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
  /**
   * When this credential stops working, or null for one that does not expire.
   *
   * A pasted long-lived token — Meta's System User token, for instance — has a
   * fixed lifetime and no refresh path, so this date is the difference between
   * a planned rotation and a surface that goes quiet without explanation.
   */
  expiresAt?: string | null;
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
  /** Optional: a workspace can be created now and given a website later. */
  url?: string;
}

/**
 * What a workspace can currently do. `ads` and `social` are named ahead of the
 * channel layer so surfaces can be written against the final vocabulary.
 */
export type WorkspaceCapability =
  "website" | "search-console" | "analytics" | "serp" | "ads" | "social";

export interface WorkspaceCapabilityState {
  capability: WorkspaceCapability;
  available: boolean;
  reason: string;
  remedy: { label: string; href: string } | null;
}

export interface WorkspaceCapabilities {
  projectId: string;
  available: WorkspaceCapability[];
  states: WorkspaceCapabilityState[];
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

/* ------------------------------------------------------------------ */
/* Ad cabinets                                                         */
/*                                                                     */
/* "Cabinet" is what a marketer calls an ad account, and it is the word */
/* the surface uses. The API calls the same row a channel account,      */
/* because the table also holds analytics properties and social         */
/* profiles.                                                            */
/* ------------------------------------------------------------------ */

export type ChannelKind = "search" | "analytics" | "ads" | "social";

export type AdPlatform =
  | "all"
  | "facebook"
  | "instagram"
  | "messenger"
  | "audience_network"
  // Google's networks. Search and Search Partners stay separate because
  // partner traffic converts differently and is switched off separately.
  // Performance Max is its own value: Google reports it as one opaque surface,
  // so filing it under Search would claim a breakdown that does not exist.
  | "google_search"
  | "google_search_partners"
  | "google_display"
  | "google_youtube"
  | "google_performance_max"
  | "unknown";

/**
 * `available` carries a number. Everything else does not, and the surface must
 * render the reason rather than a zero — the whole point of paid reporting is
 * that "we spent nothing" and "we could not ask" stay distinguishable.
 */
export type ChannelMetricState =
  "available" | "partial" | "unavailable" | "failed";

export interface ChannelAccount {
  id: string;
  workspaceId: string;
  provider: string;
  account: string;
  kind: ChannelKind;
  externalId: string;
  displayName: string;
  currency: string | null;
  dailySpendCap: number | null;
  totalSpendCap: number | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface DiscoveredChannelAccount {
  provider: string;
  account: string;
  kind: ChannelKind;
  externalId: string;
  displayName: string;
  currency: string | null;
  status: string | null;
  linked: boolean;
}

export interface ChannelMetricSummary {
  metricKey: string;
  platform: AdPlatform;
  value: number | null;
  state: ChannelMetricState;
  currency: string | null;
  observedDays: number;
  requestedDays: number;
  note: string | null;
}

export interface ChannelPerformance {
  account: ChannelAccount;
  start: string;
  end: string;
  lastSyncedAt: string | null;
  summaries: ChannelMetricSummary[];
}

export interface LinkChannelAccountInput {
  projectId: string;
  provider: string;
  account?: string;
  kind: ChannelKind;
  externalId: string;
  displayName: string;
  currency?: string | null;
  dailySpendCap?: number | null;
  totalSpendCap?: number | null;
}

export interface UpdateChannelAccountInput {
  displayName?: string;
  dailySpendCap?: number | null;
  totalSpendCap?: number | null;
  archived?: boolean;
}

/* ------------------------------------------------------------------ */
/* Campaign staging                                                    */
/* ------------------------------------------------------------------ */

export type CampaignBriefStatus = "draft" | "in_review" | "archived";

export type DeliverableChannel =
  | "facebook-ad"
  | "instagram-ad"
  | "instagram-post"
  | "instagram-reel"
  | "facebook-post"
  | "seo-article";

export interface CampaignBrief {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  audience: string | null;
  keyMessage: string | null;
  constraints: string | null;
  status: CampaignBriefStatus;
  /** `agent` or `operator`, decided by transport rather than by the caller. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDeliverable {
  id: string;
  briefId: string;
  channel: DeliverableChannel;
  headline: string | null;
  body: string;
  callToAction: string | null;
  destinationUrl: string | null;
  creativeNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type PublishIntentState = "staged" | "approved" | "void" | "withdrawn";

export interface PublishIntent {
  id: string;
  projectId: string;
  deliverableId: string;
  channelAccountId: string;
  state: PublishIntentState;
  payload: Record<string, unknown>;
  /** Approval binds to this exact value; a changed payload voids consent. */
  payloadHash: string;
  budget: {
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    currency: string | null;
  };
  stagedBy: string;
  stagedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedPayloadHash: string | null;
  note: string | null;
}

export interface CampaignWorkspace {
  brief: CampaignBrief;
  deliverables: CampaignDeliverable[];
  intents: PublishIntent[];
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

export type SocialPlatform = "telegram" | "x" | "facebook-page" | "instagram";

export type MediaKind = "image" | "video";

export interface MediaAsset {
  id: string;
  projectId: string;
  filename: string;
  /** Decided by sniffing the bytes, not by the upload's declared type. */
  mediaType: string;
  kind: MediaKind;
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  /** Null means the bytes have never left this machine. */
  publicUrl: string | null;
  publicUrlSource: string | null;
  publicUrlAt: string | null;
}

export type PublishAttemptState =
  "attempting" | "published" | "failed" | "indeterminate";

export interface PublishRecord {
  id: string;
  intentId: string;
  projectId: string;
  channelAccountId: string;
  platform: SocialPlatform;
  state: PublishAttemptState;
  request: Record<string, unknown>;
  idempotencyKey: string;
  providerId: string | null;
  permalink: string | null;
  error: string | null;
  attemptedAt: string;
  completedAt: string | null;
}

export interface CalendarEntry {
  intentId: string;
  deliverableId: string;
  briefId: string;
  briefTitle: string;
  channelAccountId: string;
  platform: SocialPlatform;
  accountName: string;
  state: string;
  scheduledAt: string | null;
  timezone: string | null;
  preview: string;
  attachmentCount: number;
  record: PublishRecord | null;
}

export interface ContentCalendar {
  projectId: string;
  start: string;
  end: string;
  entries: CalendarEntry[];
  /** Approved with no time, and past-due but unsent. Both need attention. */
  unscheduled: CalendarEntry[];
  overdue: CalendarEntry[];
}

export interface PublishOutcome {
  state: "published" | "failed" | "indeterminate" | "skipped";
  reason: string | null;
  record: PublishRecord | null;
}

/* ------------------------------------------------------------------ */
/* Email builder                                                       */
/* ------------------------------------------------------------------ */

export interface BrandColor {
  name: string;
  value: string;
  usage: string | null;
}

export interface BrandTypeface {
  role: "heading" | "body" | "mono";
  stack: string;
  sizePx: number;
  lineHeight: number;
  weight: number;
}

export interface BrandFooter {
  companyName: string;
  postalAddress: string;
  /** The merge tag the operator's ESP substitutes at send time. */
  unsubscribePlaceholder: string;
  legalNotes: string | null;
}

export interface BrandKitProfile {
  colors: BrandColor[];
  typefaces: BrandTypeface[];
  logoMediaId: string | null;
  logoAltText: string | null;
  contentWidthPx: number;
  buttonRadiusPx: number;
  voice: string | null;
  prohibitions: string[];
  footer: BrandFooter;
  /** Reference material only. A token that matters is entered above. */
  referenceMediaId: string | null;
  referenceNotes: string | null;
}

export interface BrandKitVersion {
  projectId: string;
  revision: number;
  profile: BrandKitProfile;
  changeSummary: string;
  actor: string;
  createdAt: string;
}

export interface BrandKitWorkspace {
  projectId: string;
  current: BrandKitVersion | null;
  history: BrandKitVersion[];
}

export type EmailFindingSeverity = "blocking" | "error" | "warning" | "info";

export interface EmailFinding {
  rule: string;
  severity: EmailFindingSeverity;
  message: string;
  where: string | null;
  remedy: string | null;
  /** Clients this actually affects, named rather than implied. */
  affects: string[];
}

export interface EmailValidationReport {
  ok: boolean;
  findings: EmailFinding[];
  sizeBytes: number;
  gmailClips: boolean;
  counts: {
    blocking: number;
    error: number;
    warning: number;
    info: number;
  };
}

export interface EmailTemplate {
  id: string;
  projectId: string;
  name: string;
  purpose: string | null;
  latestRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateVersion {
  templateId: string;
  revision: number;
  subject: string;
  preheader: string;
  sourceHtml: string;
  compiledHtml: string;
  plainText: string;
  report: EmailValidationReport;
  brandRevision: number | null;
  createdBy: string;
  createdAt: string;
}

export interface EmailTemplateWorkspace {
  template: EmailTemplate;
  current: EmailTemplateVersion | null;
  history: EmailTemplateVersion[];
}

export interface EmailPreview {
  subject: string;
  preheader: string;
  compiledHtml: string;
  plainText: string;
  report: EmailValidationReport;
}

/* ------------------------------------------------------------------ */
/* Cross-channel reports                                               */
/* ------------------------------------------------------------------ */

export type ReportAvailability =
  "available" | "partial" | "unavailable" | "failed";

export interface ReportMetric {
  key: string;
  label: string;
  /** Null unless actually measured. Rendered as its reason, never a dash. */
  value: number | null;
  unit: string;
  currency: string | null;
  state: ReportAvailability;
  /** Only set when both periods were measured. */
  change: number | null;
  note: string | null;
}

export interface ReportSource {
  id: string;
  label: string;
  state: ReportAvailability;
  reason: string;
  observedAt: string | null;
}

/** A total the report declines to compute, with the reason that replaces it. */
export interface ReportRefusal {
  expected: string;
  explanation: string;
}

export interface ReportSection {
  id: "paid" | "organic" | "social" | "email" | "actions";
  title: string;
  state: ReportAvailability;
  summary: string;
  metrics: ReportMetric[];
  sources: ReportSource[];
  refusals: ReportRefusal[];
  breakdown: Array<{ label: string; metrics: ReportMetric[] }>;
}

export interface MarketingReport {
  id: string;
  projectId: string;
  title: string;
  period: {
    start: string;
    end: string;
    comparisonStart: string | null;
    comparisonEnd: string | null;
    timezone: string;
  };
  narrative: string | null;
  sections: ReportSection[];
  coverageGaps: Array<{
    source: string;
    reason: string;
    remedy: string | null;
  }>;
  generatedAt: string;
  brandRevision: number | null;
}

export interface MarketingReportSummary {
  id: string;
  projectId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  state: ReportAvailability;
}

/* ------------------------------------------------------------------ */
/* Campaign links and QR codes                                         */
/* ------------------------------------------------------------------ */

export interface UtmParameters {
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
}

export type CampaignLinkFindingSeverity = "blocking" | "warning" | "advice";

export interface CampaignLinkFinding {
  rule: string;
  severity: CampaignLinkFindingSeverity;
  message: string;
  field: string | null;
  remedy: string | null;
}

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export type QrPlacement =
  "screen" | "print-handheld" | "print-poster" | "packaging" | "outdoor";

export interface QrStyle {
  errorCorrection: QrErrorCorrection;
  quietZone: number;
  darkColor: string;
  lightColor: string;
  transparent: boolean;
}

export type QrScanVerdict = "comfortable" | "tight" | "unscannable";

export interface QrPrintAdvice {
  version: number;
  moduleCount: number;
  errorCorrection: QrErrorCorrection;
  printedWidthMm: number;
  moduleSizeMm: number;
  verdict: QrScanVerdict;
  recommendedWidthMm: number;
  maxScanDistanceMm: number;
  contrastRatio: number;
  findings: CampaignLinkFinding[];
}

export interface CampaignLink {
  id: string;
  projectId: string;
  label: string;
  destinationUrl: string;
  utm: UtmParameters;
  taggedUrl: string;
  style: QrStyle;
  placement: QrPlacement;
  printedWidthMm: number | null;
  findings: CampaignLinkFinding[];
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignLinkPreview {
  taggedUrl: string;
  normalizedUtm: UtmParameters;
  findings: CampaignLinkFinding[];
  advice: QrPrintAdvice | null;
  svg: string | null;
}

export type RedirectTarget =
  "cloudflare-worker" | "netlify" | "vercel" | "nginx" | "apache";

export interface RedirectConfigResponse {
  filename: string;
  contents: string;
  enforcesExpiry: boolean;
  notes: string[];
  findings: CampaignLinkFinding[];
}

/* ------------------------------------------------------------------ */
/* Search terms — Google Ads only                                      */
/* ------------------------------------------------------------------ */

export type SearchTermMatchType =
  "exact" | "phrase" | "broad" | "near_exact" | "near_phrase" | "unknown";

export type SearchTermStatus =
  "added" | "excluded" | "added_excluded" | "none" | "unknown";

export interface SearchTermRecord {
  channelAccountId: string;
  campaignId: string;
  campaignName: string | null;
  adGroupId: string;
  adGroupName: string | null;
  query: string;
  matchedKeyword: string | null;
  matchType: SearchTermMatchType;
  status: SearchTermStatus;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
  conversionValue: number | null;
  currency: string | null;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}
