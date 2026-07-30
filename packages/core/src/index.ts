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

// Competitor publishing cadence from a site's own feed. A crawl shows what a
// rival's pages look like; this shows how fast they ship.
export {
  collectPublishingCadence,
  discoverFeedUrl,
  parseFeed,
  summarizeCadence,
  type FeedItem,
  type FeedOutcome,
  type FeedUnavailableReason,
  type PublishingCadence,
} from "./integrations/feed.js";
