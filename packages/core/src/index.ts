// Public package entry point. Re-exports the orchestrator and report
// helpers. The CLI lives in `src/cli.ts`.

export { crawl } from "./orchestrator.js";
export type { CrawlOptions, CrawlOutcome } from "./orchestrator.js";
export {
  buildReport,
  reportToJson,
  reportToMarkdown,
  reportToHtml,
  reportToCsv,
} from "./core/report/index.js";
export type {
  Ga4PageStat,
  GscPageStat,
  GscQueryPageStat,
  GscQueryStat,
  PerformanceComparisonSummary,
  PerformancePeriodSummary,
  RealDataSummary,
  Report,
} from "./core/report/index.js";
export {
  buildComparablePerformanceWindows,
  PERFORMANCE_COMPLETE_DATA_LAG_DAYS,
  PERFORMANCE_WINDOW_DAYS,
} from "./integrations/google/analytics-window.js";
export type {
  ComparablePerformanceWindows,
  PerformanceDateWindow,
} from "./integrations/google/analytics-window.js";
export type {
  Issue,
  Priority,
  CrawledPage,
  CrawlIndex,
} from "./checks/index.js";
export {
  assessPageIndexability,
  dashboardIndexabilityStatus,
} from "./indexability.js";
export type {
  PageIndexabilityAssessment,
  PageIndexabilityEvidence,
  PageIndexabilityReason,
} from "./indexability.js";
export { loadLimits } from "./core/limits.js";
export type { Limits } from "./core/limits.js";
export { ProjectStore, diffResultToMarkdown } from "./core/store.js";
export type { DiffResult, ProjectStoreOptions } from "./core/store.js";
export {
  loadCrawlConfig,
  buildAuthHeader,
  buildCookieHeader,
  buildUserAgent,
} from "./core/config.js";
export {
  EXTRACTION_LIMITS,
  ExtractorRuleError,
  loadExtractors,
  applyExtraction,
  previewExtraction,
  validateExtractorRules,
} from "./extraction.js";
export type {
  ExtractedField,
  ExtractionPreviewOptions,
  ExtractionPreviewResult,
  ExtractorRule,
} from "./extraction.js";
export {
  createRenderer,
  StaticRenderer,
  JsRenderer,
  FetchError,
} from "./renderer.js";
export type { Renderer, RenderOptions, RenderedPage } from "./renderer.js";
export { withRecommendations, recommend } from "./core/recommendations.js";
export {
  CUSTOM_RULE_REGEX_LIMITS,
  compileSafeCustomRuleRegex,
  limitCustomRuleRegexInput,
  validateCustomRuleRegex,
} from "./custom-rule-regex.js";
export type {
  CustomRuleRegexRejectionCode,
  CustomRuleRegexValidation,
} from "./custom-rule-regex.js";
// Module system (Sprint 2+)
export type {
  Module,
  ModuleId,
  Workflow,
  WorkflowId,
  WorkflowExecutionPlan,
  LeafModuleRegistry,
  ModuleCategory,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
  ModuleSignalContext,
  JSONSchemaSubset,
  ModuleRequirement,
} from "./modules/types.js";
export { runComposer } from "./core/composer.js";
export type {
  ComposerOptions,
  ComposerResult,
  RunStatus,
  ModuleExecutionStatus,
  ModuleExecutionState,
} from "./core/composer.js";
export {
  canonicalizeIssueUrl,
  issueFingerprint,
  issueToInstances,
  scorePriorityV1,
} from "./core/entities.js";
export type {
  Action,
  Evidence,
  IssueInstance,
  IssueSeverity,
  PriorityV1Input,
} from "./core/entities.js";
export { ConsoleLogger, SilentLogger } from "./core/logger.js";
export type { Logger, LogLevel } from "./core/logger.js";
export { redactSecrets } from "./core/audit.js";
export type { RedactSecretsOptions } from "./core/audit.js";
export { compareSites } from "./compare.js";
export type { CompareOptions, ComparisonResult } from "./compare.js";
export {
  runContentGap,
  contentGapToJson,
  contentGapToMarkdown,
} from "./content-gap.js";
export { keywordResearchModule } from "./modules/keyword-research/index.js";
export { topicClustersModule } from "./modules/topic-clusters/index.js";
export { metaAdsModule } from "./modules/integrations/meta-ads/index.js";

// Paid media. Facebook and Instagram are one API behind one credential; what
// separates them is a breakdown dimension, which is why both arrive here.
export {
  MetaAdsClient,
  type MetaAdAccount,
  type MetaDeliveryRecord,
  type MetaInsightLevel,
  type MetaInsightRow,
} from "./integrations/meta/client.js";
export {
  adsManagerUrl,
  auditMetaCabinet,
  META_ADS_MODULE_ID,
  META_AUDIT_THRESHOLDS,
  type MetaAuditInput,
} from "./integrations/meta/audit.js";
export {
  datesInRange,
  markMetaWindowUnavailable,
  META_SOURCE,
  normalizeMetaInsights,
  toAdPlatform,
  toEntityKind,
  type NormalizeMetaInsightsOptions,
} from "./integrations/meta/normalize.js";
export {
  syncMetaCabinet,
  type MetaCabinetSyncInput,
  type MetaCabinetSyncResult,
} from "./integrations/meta/sync.js";
export type {
  AdPlatform,
  ChannelEntityKind,
  ChannelMetric,
  ChannelMetricKey,
  ChannelMetricState,
  SearchTermCoverage,
  SearchTermMatchType,
  SearchTermRecord,
  SearchTermStatus,
} from "./integrations/channel-vocabulary.js";

// Google Ads. Read and audit only: a campaign here is a tree rather than a
// flat object, and the value in an account review is finding where money
// leaks, not composing new work. See ADR 0008.
export {
  GoogleAdsClient,
  type GoogleAdsAdRecord,
  type GoogleAdsCampaignRecord,
  type GoogleAdsCustomer,
  type GoogleAdsKeywordRecord,
  type GoogleAdsLevel,
  type GoogleAdsMetricRow,
  type GoogleAdsSearchTermRow,
} from "./integrations/google-ads/client.js";
export {
  auditGoogleAdsAccount,
  GOOGLE_ADS_AUDIT_THRESHOLDS,
  GOOGLE_ADS_MODULE_ID,
  googleAdsUrl,
  type GoogleAdsAuditInput,
} from "./integrations/google-ads/audit.js";
export {
  GOOGLE_ADS_SOURCE,
  markGoogleAdsWindowUnavailable,
  normalizeGoogleAdsMetrics,
  normalizeSearchTerms,
  OPAQUE_CHANNEL_TYPES,
  toGoogleAdPlatform,
  toGoogleEntityKind,
  toSearchTermMatchType,
  toSearchTermStatus,
  type NormalizeGoogleAdsOptions,
} from "./integrations/google-ads/normalize.js";
export {
  syncGoogleAdsAccount,
  type GoogleAdsAccountSyncInput,
  type GoogleAdsAccountSyncResult,
} from "./integrations/google-ads/sync.js";

// Where paid spend meets the page it buys. Every rule here needs the crawl and
// an ad account at once, which is why none of them exists in a tool that holds
// only one of the two.
export {
  auditLandingAlignment,
  LANDING_MODULE_ID,
  LANDING_THRESHOLDS,
} from "./landing/align.js";
export {
  MAX_PROBES,
  probeDestinations,
  type ProbeOptions,
} from "./landing/probe.js";
export type {
  AdDestination,
  DestinationOrigin,
  LandingAlignmentInput,
  PageSnapshot,
} from "./landing/types.js";

// Organic publishing. One interface, four platforms, and every difference
// between them lives in an implementation rather than in the caller.
export {
  failureFromStatus,
  multipartBody,
  PublishFailure,
  type PublishOutcome,
  type PublishRequest,
  type PublishFailureCode,
  type ResolvedAttachment,
  type SocialPublisher,
} from "./integrations/social/publisher.js";
// The cross-channel report. What it refuses to compute is as much the product
// as what it does — see ADR 0007.
export {
  composeReport,
  metric as reportMetric,
  reportState,
  worstState,
  type ActionsInput,
  type ComposeReportInput,
  type EmailInput,
  type OrganicInput,
  type PaidCabinetInput,
  type PeriodTotals,
  type SocialInput,
} from "./reporting/compose.js";
export {
  DEFAULT_REPORT_BRAND,
  formatMetricValue,
  renderReportHtml,
  renderReportText,
  type ReportBrand,
} from "./reporting/render.js";
export type {
  MarketingReport,
  ReportAvailability,
  ReportMetric,
  ReportPeriod,
  ReportRefusal,
  ReportSection,
  ReportSource,
} from "./reporting/types.js";

// QR codes and campaign links. The encoder is written here rather than taken
// from a package so a printed code depends on nothing that can be withdrawn.
export {
  dataCodewordCount,
  encodeQr,
  maskPenalty,
  QrCapacityError,
  selectMode,
  ERROR_CORRECTION_RECOVERY,
  type EncodeQrOptions,
  type ErrorCorrectionLevel,
  type QrMatrix,
  type QrMode,
} from "./qr/encode.js";
export { renderQrPng, renderQrSvg, type QrRenderOptions } from "./qr/render.js";
export {
  adviseQr,
  colorContrastRatio,
  recommendedErrorCorrection,
  type AdviseQrInput,
} from "./qr/advise.js";
export {
  buildTaggedUrl,
  normalizeUtmParameters,
  normalizeUtmValue,
  validateCampaignLink,
  type ValidateCampaignLinkInput,
} from "./campaign/utm.js";
export {
  adviseRedirect,
  renderRedirectConfig,
  shortLinkPath,
  type RedirectConfig,
  type RedirectRoute,
  type RedirectTarget,
} from "./campaign/redirect.js";
export type {
  CampaignLinkFinding,
  CampaignLinkFindingSeverity,
  QrErrorCorrection,
  QrPlacement,
  QrPrintAdvice,
  QrScanVerdict,
  UtmParameters,
} from "./campaign/types.js";

// Email. The agent writes the HTML; these decide whether it survives an inbox.
export {
  compileEmail,
  starterEmailHtml,
  type CompiledEmail,
  type CompileEmailOptions,
} from "./email/compile.js";
export {
  sanitizeCssText,
  sanitizeEmailHtml,
  type SanitizeFinding,
  type SanitizeResult,
} from "./email/sanitize.js";
export {
  inlineEmailCss,
  parseStylesheet,
  specificityOf,
  type InlineResult,
} from "./email/inline.js";
export {
  contrastRatio,
  GMAIL_CLIP_BYTES,
  parseHexColor,
  toPlainText,
  validateEmailHtml,
  type EmailBrandExpectations,
  type EmailFinding,
  type EmailValidationReport,
} from "./email/validate.js";

export { TelegramPublisher } from "./integrations/social/telegram.js";
export { XPublisher } from "./integrations/social/x.js";
export {
  FacebookPagePublisher,
  InstagramPublisher,
} from "./integrations/social/meta.js";

// Competitor publishing cadence from a site's own feed. A crawl shows what a
// rival's pages look like; this shows how fast they ship.
export {
  collectCadenceForTarget,
  collectPublishingCadence,
  discoverFeedUrl,
  parseFeed,
  summarizeCadence,
  type FeedItem,
  type FeedOutcome,
  type FeedUnavailableReason,
  type PublishingCadence,
} from "./integrations/feed.js";
export {
  assessBrandPresence,
  probeBrandReachability,
  sameAsUrls,
} from "./integrations/brand-presence.js";
export type {
  BrandProfileInput,
  BrandPresencePage,
  BrandProfilePresence,
  BrandReachability,
} from "./integrations/brand-presence.js";
export {
  runOsintResearch,
  type OsintDossier,
  type OsintEntity,
  type OsintEntityType,
  type OsintEvidence,
  type OsintEvidenceState,
  type OsintFinding,
  type OsintRelationship,
  type OsintRelationshipType,
  type OsintResearchOptions,
  type OsintSourceClass,
  type OsintTargetDossier,
  type OsintProvenance,
} from "./integrations/osint.js";

// The executive layer of a report, shared by every renderer so the HTML and PDF
// can never disagree about what an audit found.
export {
  deriveChange,
  deriveCoverageGaps,
  deriveExecutiveSummary,
  type ChangeSinceBaseline,
  type ComparisonInput,
  type CoverageGap,
  type ExecutiveSummary,
  type HeadlineAction,
} from "./core/report/executive.js";
