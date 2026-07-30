import { createHash, randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isIP } from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FormatRegistry, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  createWorkflowPlan,
  createWorkflowRegistry,
  executePlan,
  priorityScoreV1FromInputs,
  scorePriorityV1,
  selectMatchedControlCohort,
  validateWorkflowOutput,
  workflowById,
} from "@agentseoapp/application";
import {
  AppendProjectContextJournalInputSchema,
  BUILT_IN_EXTRACTION_RULE_TEMPLATE_CATALOG,
  ExtractionRuleSchema,
  ExtractionRuleTemplateCatalogSchema,
  PreviewExtractionRulesInputSchema,
  ProjectContextProfileSchema,
  SitemapEvidenceSchema,
  UpdateExtractionRulesInputSchema,
} from "@agentseoapp/contracts";
import type {
  Action,
  ActionCheckpoint,
  ActionEvidenceWorkspace,
  ActionOutcomeObservation,
  AgentSeoRuntime,
  AppendProjectContextJournalInput,
  Capabilities,
  CreateProjectInput,
  DeleteProjectInput,
  ExtractionPreview,
  ExtractionRule,
  ExtractionRuleTemplateCatalog,
  ExtractionRuleWorkspace,
  Integration,
  IssueInstance,
  IssueReviewListOptions,
  IssueReviewPage,
  MetricValue,
  SeoModule,
  ProjectOverview,
  ProjectDeletionReceipt,
  ProjectContextProfile,
  ProjectContextWorkspace,
  PreviewExtractionRulesInput,
  Run,
  RunComparison,
  RunEvidenceItem,
  RunEvidenceListOptions,
  RunEvidencePage,
  RunLinkExplorer,
  RunLinkExplorerOptions,
  RunReplay,
  RunEvent,
  Schedule,
  SitemapEvidence,
  StartRunInput,
  UpdateActionInput,
  UpdateExtractionRulesInput,
  UpdateIssueAdjudicationInput,
  UpdateProjectContextInput,
} from "@agentseoapp/contracts";
import {
  AGENTSEO_PROJECT_BUNDLE_LIMITS,
  AgentSeoProjectBundleV2Schema,
  type AgentSeoProjectBundleV2,
  type ProjectBundleArtifact,
  type ProjectBundleConnector,
  type ProjectBundleCustomRule,
  type ProjectBundlePage,
  type ProjectBundleRunConfiguration,
  type ProjectImportResult,
} from "@agentseoapp/contracts/project-bundle";
import type {
  CredentialRef,
  CredentialStore,
  StoredOAuthCredential,
} from "@agentseoapp/credentials";
import {
  decodeOAuthCredential,
  encodeOAuthCredential,
  MemoryCredentialStore,
  oauthCredentialRef,
} from "@agentseoapp/credentials";
import type {
  ConnectorHealth,
  ConnectorId,
  GoogleOAuthTokenSet,
} from "@agentseoapp/integrations";
import {
  checkConnectorHealth,
  connectorManifests,
  getConnectorManifest,
  refreshGoogleOAuthToken,
  validateConnectorConfiguration,
} from "@agentseoapp/integrations";
import {
  AgentSeoDatabase,
  type PagePerformanceRecord,
  type PerformanceWindowRecord,
  type QueryPerformanceRecord,
  type StoredPageRecord,
} from "@agentseoapp/storage-sqlite";
import {
  redactSecrets,
  type PerformancePeriodSummary,
  type Report as EngineReport,
  validateExtractorRules,
} from "@agentseoapp/core";
import { validateCustomRuleRegex } from "@agentseoapp/core/custom-rule-regex";
import { nextCronOccurrence } from "./cron.js";
import { resolveGoogleDesktopClientId } from "./google-oauth-env.js";
import {
  DurableJobWorker,
  DurableScheduler,
  type DurableJobHandler,
} from "./durable-work.js";
import { summarizePageIndexability } from "./indexability.js";
import { buildAuditComparison } from "./audit-comparison.js";
export { nextCronOccurrence };
export { resolveGoogleDesktopClientId } from "./google-oauth-env.js";
export {
  DurableJobWorker,
  DurableScheduler,
  type DurableJobHandler,
} from "./durable-work.js";

interface LegacyIssue {
  id: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  message: string;
  urls: string[];
  detail?: Record<string, unknown>;
  fix?: string;
  moduleId?: string;
}

interface EngineModule {
  crawl(
    options: Record<string, unknown>,
  ): Promise<{ report: EngineReport; runId: string }>;
  reportToJson(report: EngineReport): string;
  reportToHtml(report: EngineReport): string;
  reportToCsv(report: EngineReport): string;
  previewExtraction?(options: Record<string, unknown>): Promise<{
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    contentType: string;
    renderMode: "static" | "js";
    responseTimeMs: number;
    fields: Array<{
      label: string;
      value: string | null;
      truncated?: true;
    }>;
  }>;
  compareSites?(options: Record<string, unknown>): Promise<unknown>;
  keywordResearchModule?: {
    invoke(
      input: Record<string, unknown>,
      context: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  };
  topicClustersModule?: {
    invoke(
      input: Record<string, unknown>,
      context: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  };
  loadLimits?(): Record<string, unknown>;
}

interface AuditEngineOutput {
  report: EngineReport;
  runId: string;
  coverage: number;
}

export interface LocalRuntimeOptions {
  dataDir?: string;
  credentialStore?: CredentialStore;
  engine?: EngineModule;
  version?: string;
  /** Public installed-app OAuth client ID used only when refreshing tokens. */
  googleDesktopClientId?: string;
  /** Injectable transport for deterministic credential refresh tests. */
  oauthFetch?: typeof fetch;
  /** Injectable provider transport for connector health probes. */
  integrationFetch?: typeof fetch;
}

export function defaultDataDirectory(): string {
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "AGENTseo");
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "AGENTseo",
    );
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "agentseo",
  );
}

const unavailable = (source: string, note: string): MetricValue => ({
  value: null,
  state: "unavailable",
  source,
  observedAt: null,
  coverage: null,
  note,
});

const severity = (
  priority: LegacyIssue["priority"],
): IssueInstance["severity"] =>
  priority === "High" ? "high" : priority === "Medium" ? "medium" : "low";

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const PROJECT_ARTIFACT_MEDIA = Object.freeze({
  "report.json": "application/json",
  "report.html": "text/html; charset=utf-8",
  "report.csv": "text/csv; charset=utf-8",
  "report.pdf": "application/pdf",
  "run-evidence.json": "application/json",
} as const);

type ProjectArtifactKind = keyof typeof PROJECT_ARTIFACT_MEDIA;

const forbiddenTransferKey =
  /(?:apikey|accesstoken|refreshtoken|authtoken|password|passwd|secretref|secret|credential|authorization|privatekey|clientsecret|setcookie|cookie|requestheaders|responseheaders|headers)/i;
const dangerousTransferKey = /^(?:__proto__|prototype|constructor)$/i;
const secretLikeValue =
  /(?:\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{20,}|\bxox[baprs]-[0-9A-Za-z-]{10,}|\bBearer\s+[A-Za-z0-9._~+\/-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|client[_ -]?secret)\s*[:=]\s*["']?(?!\[redacted\])\S{8,})/i;
const localPathValue =
  /(?:^|[\s"'=])(?:file:\/\/|\/(?:Users|home|private|var|tmp|etc|opt|Volumes)\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/])/i;

const normalizedTransferKey = (key: string): string =>
  key.replace(/[^a-z0-9]/gi, "").toLowerCase();

export class ProjectBundleError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "ProjectBundleError";
  }
}

export class ActionCheckpointError extends Error {
  readonly code = "checkpoint_baseline_unavailable";

  constructor(
    message = "A successful audit is required before creating a checkpoint.",
  ) {
    super(message);
    this.name = "ActionCheckpointError";
  }
}

export class ActionEvidenceCursorError extends Error {
  readonly code = "invalid_action_evidence_cursor";

  constructor(message = "Invalid action evidence cursor.") {
    super(message);
    this.name = "ActionEvidenceCursorError";
  }
}

export class IssueAdjudicationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "project_not_found"
      | "adjudication_note_required"
      | "secret_material_rejected"
      | "local_path_rejected",
    readonly status: 404 | 422,
  ) {
    super(message);
    this.name = "IssueAdjudicationError";
  }
}

export class ProjectContextError extends Error {
  constructor(
    message: string,
    readonly code:
      | "project_not_found"
      | "invalid_project_context"
      | "invalid_source_run"
      | "secret_material_rejected"
      | "local_path_rejected",
    readonly status: 404 | 422,
  ) {
    super(message);
    this.name = "ProjectContextError";
  }
}

export class ProjectDeletionError extends Error {
  constructor(
    message: string,
    readonly code:
      "project_not_found" | "project_confirmation_mismatch" | "project_busy",
    readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "ProjectDeletionError";
  }
}

export class RunReplayError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_idempotency_key"
      | "source_run_not_terminal"
      | "source_workflow_unsupported",
    readonly status: 400 | 409,
  ) {
    super(message);
    this.name = "RunReplayError";
  }
}

export class RunComparisonError extends Error {
  constructor(
    message: string,
    readonly code:
      | "current_run_not_found"
      | "baseline_run_not_found"
      | "comparison_same_run"
      | "comparison_project_mismatch"
      | "comparison_workflow_unsupported"
      | "comparison_run_not_ready"
      | "comparison_direction_invalid",
    readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "RunComparisonError";
  }
}

export class RunLinkExplorerError extends Error {
  constructor(
    message: string,
    readonly code:
      | "link_run_not_ready"
      | "link_workflow_unsupported"
      | "link_page_url_invalid"
      | "link_page_not_found"
      | "link_direction_invalid",
    readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "RunLinkExplorerError";
  }
}

export class ExtractionRulesError extends Error {
  constructor(
    message: string,
    readonly code:
      | "project_not_found"
      | "invalid_extraction_rules"
      | "preview_url_out_of_scope"
      | "extraction_preview_failed"
      | "extraction_template_catalog_invalid",
    readonly status: 404 | 422 | 500,
  ) {
    super(message);
    this.name = "ExtractionRulesError";
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function normalizedExtractionRules(rules: ExtractionRule[]): ExtractionRule[] {
  const ids = new Set<string>();
  for (const rule of rules) {
    if (!Value.Check(ExtractionRuleSchema, rule)) {
      throw new ExtractionRulesError(
        "Every extraction rule must match the documented field and length limits.",
        "invalid_extraction_rules",
        422,
      );
    }
    if (ids.has(rule.id)) {
      throw new ExtractionRulesError(
        `Extraction rule identifier ${rule.id} is duplicated.`,
        "invalid_extraction_rules",
        422,
      );
    }
    ids.add(rule.id);
  }
  let normalized;
  try {
    normalized = validateExtractorRules(
      rules.map((rule) => ({
        label: rule.label,
        selector: rule.selector,
        type: rule.type,
        ...(rule.attribute !== null ? { attribute: rule.attribute } : {}),
        ...(rule.regex !== null ? { regex: rule.regex } : {}),
      })),
    );
  } catch (error) {
    throw new ExtractionRulesError(
      error instanceof Error ? error.message : "Extraction rules are invalid.",
      "invalid_extraction_rules",
      422,
    );
  }
  return normalized.map((rule, index) => ({
    id: rules[index]!.id,
    label: rule.label,
    selector: rule.selector,
    type: rule.type,
    attribute: rule.attribute ?? null,
    regex: rule.regex ?? null,
    enabled: rules[index]!.enabled,
  }));
}

function extractionConfigurationHash(rules: ExtractionRule[]): string {
  return sha256(stableJson({ configurationVersion: 1, rules }));
}

function transferPayloadChecksum(
  bundle: Omit<AgentSeoProjectBundleV2, "integrity">,
): string {
  return sha256(stableJson(bundle));
}

function isLocalPath(value: string): boolean {
  return (
    localPathValue.test(value) ||
    (isAbsolute(value) &&
      !value.startsWith("http://") &&
      !value.startsWith("https://"))
  );
}

/** Removes sensitive keys and secret/path-like values from untrusted JSON fields. */
function sanitizeTransferValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (depth > 32)
    throw new ProjectBundleError(
      "A project value is too deeply nested to export safely.",
      "bundle_complexity_exceeded",
    );
  if (typeof value === "string") {
    return secretLikeValue.test(value) || isLocalPath(value)
      ? "[redacted]"
      : value;
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return typeof value === "number" && !Number.isFinite(value) ? null : value;
  }
  if (value === undefined) return undefined;
  if (Array.isArray(value))
    return value.map((item) => sanitizeTransferValue(item, depth + 1, seen));
  if (typeof value !== "object") return String(value);
  if (seen.has(value))
    throw new ProjectBundleError(
      "A project value contains a circular reference.",
      "bundle_complexity_exceeded",
    );
  seen.add(value);
  const sanitized: Record<string, unknown> = Object.create(null);
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const normalized = normalizedTransferKey(key);
    if (
      dangerousTransferKey.test(key) ||
      forbiddenTransferKey.test(normalized) ||
      normalized === "filepath" ||
      normalized === "localpath"
    )
      continue;
    const next = sanitizeTransferValue(nested, depth + 1, seen);
    if (next !== undefined) sanitized[key] = next;
  }
  seen.delete(value);
  return sanitized;
}

function boundedContractText(
  value: unknown,
  maxLength: number,
  fallback: string,
): string {
  const text = typeof value === "string" ? value.trim() : "";
  const source = text || fallback;
  const characters = Array.from(source);
  if (characters.length <= maxLength) return source;
  return `${characters.slice(0, Math.max(0, maxLength - 1)).join("")}…`;
}

function normalizedContextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = new Map<string, string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase("en-US");
    if (!normalized.has(key)) normalized.set(key, text);
  }
  return [...normalized.values()];
}

function normalizeProjectContextProfile(
  value: ProjectContextProfile,
): ProjectContextProfile {
  return {
    summary:
      typeof value?.summary === "string" ? value.summary.trim() || null : null,
    audiences: normalizedContextList(value?.audiences),
    markets: normalizedContextList(value?.markets),
    languages: normalizedContextList(value?.languages),
    conversionGoals: normalizedContextList(value?.conversionGoals),
    priorityTopics: normalizedContextList(value?.priorityTopics),
    competitors: normalizedContextList(value?.competitors),
    constraints: normalizedContextList(value?.constraints),
  };
}

function assertSafeProjectContextText(values: readonly string[]): void {
  for (const value of values) {
    if (secretLikeValue.test(value)) {
      throw new ProjectContextError(
        "Project context cannot contain credentials or secret-like material.",
        "secret_material_rejected",
        422,
      );
    }
    if (localPathValue.test(value)) {
      throw new ProjectContextError(
        "Project context cannot contain local filesystem paths.",
        "local_path_rejected",
        422,
      );
    }
  }
}

function projectContextProfileText(profile: ProjectContextProfile): string[] {
  return [
    ...(profile.summary ? [profile.summary] : []),
    ...profile.audiences,
    ...profile.markets,
    ...profile.languages,
    ...profile.conversionGoals,
    ...profile.priorityTopics,
    ...profile.competitors,
    ...profile.constraints,
  ];
}

function redactedRuntimeValue<T>(
  value: T,
  exactValues: Iterable<string> = [],
): T {
  return redactSecrets(value, { exactValues }) as T;
}

function redactedRuntimeText(
  value: unknown,
  exactValues: Iterable<string> = [],
): string | null {
  if (value === null || value === undefined) return null;
  return redactedRuntimeValue(String(value), exactValues);
}

function collectCredentialSecrets(
  credentials: Record<string, Record<string, string | number>>,
  target: Set<string>,
): void {
  for (const record of Object.values(credentials)) {
    for (const key of [
      "apiKey",
      "accessToken",
      "refreshToken",
      "login",
      "password",
    ]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) target.add(value);
    }
  }
}

function issueForProjectBundle(issue: IssueInstance): IssueInstance {
  const sanitized = sanitizeTransferValue(issue) as IssueInstance;
  const title = boundedContractText(sanitized.title, 240, "SEO issue");
  return {
    ...sanitized,
    title,
    description: boundedContractText(sanitized.description, 4_000, title),
    evidence: sanitized.evidence.map((evidence) => ({
      ...evidence,
      kind: boundedContractText(evidence.kind, 80, "crawl-observation"),
      label: boundedContractText(evidence.label, 240, title),
      ...(typeof evidence.source === "string"
        ? {
            source: boundedContractText(evidence.source, 120, "core"),
          }
        : {}),
    })),
  };
}

function actionForProjectBundle(action: Action): Action {
  const sanitized = sanitizeTransferValue(action) as Action;
  return {
    ...sanitized,
    title: boundedContractText(sanitized.title, 240, "SEO action"),
    whyNow: boundedContractText(
      sanitized.whyNow,
      2_000,
      "Audit evidence is available for this action.",
    ),
    owner:
      sanitized.owner === null
        ? null
        : boundedContractText(sanitized.owner, 240, "Unassigned"),
  };
}

function rejectUnsafeTransferValue(value: unknown): void {
  const stack: Array<{
    value: unknown;
    path: string;
    depth: number;
    root: boolean;
  }> = [{ value, path: "$", depth: 0, root: true }];
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    visited += 1;
    if (visited > 1_000_000 || current.depth > 32) {
      throw new ProjectBundleError(
        "The project bundle is too deeply nested or contains too many values.",
        "bundle_complexity_exceeded",
      );
    }
    if (typeof current.value === "string") {
      if (secretLikeValue.test(current.value)) {
        throw new ProjectBundleError(
          `Secret-like material is not allowed at ${current.path}.`,
          "secret_material_rejected",
        );
      }
      if (isLocalPath(current.value)) {
        throw new ProjectBundleError(
          `Local filesystem paths are not allowed at ${current.path}.`,
          "local_path_rejected",
        );
      }
      continue;
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((nested, index) =>
        stack.push({
          value: nested,
          path: `${current.path}[${index}]`,
          depth: current.depth + 1,
          root: false,
        }),
      );
      continue;
    }
    if (current.value === null || typeof current.value !== "object") continue;
    for (const [key, nested] of Object.entries(
      current.value as Record<string, unknown>,
    )) {
      const normalized = normalizedTransferKey(key);
      if (dangerousTransferKey.test(key)) {
        throw new ProjectBundleError(
          `Unsafe object key is not allowed at ${current.path}.${key}.`,
          "unsafe_bundle_key",
        );
      }
      const declaration =
        current.root && key === "secretsIncluded" && nested === false;
      if (
        !declaration &&
        (forbiddenTransferKey.test(normalized) ||
          normalized === "filepath" ||
          normalized === "localpath")
      ) {
        throw new ProjectBundleError(
          `Secret or local-only field is not allowed at ${current.path}.${key}.`,
          "secret_material_rejected",
        );
      }
      if (key !== "contentBase64") {
        stack.push({
          value: nested,
          path: `${current.path}.${key}`,
          depth: current.depth + 1,
          root: false,
        });
      }
    }
  }
}

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  });
}
if (!FormatRegistry.Has("uri")) {
  FormatRegistry.Set("uri", (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function validateProjectBundle(
  raw: unknown,
): asserts raw is AgentSeoProjectBundleV2 {
  rejectUnsafeTransferValue(raw);
  if (!Value.Check(AgentSeoProjectBundleV2Schema, raw)) {
    const detail = [...Value.Errors(AgentSeoProjectBundleV2Schema, raw)]
      .slice(0, 8)
      .map((error) => `${error.path || "$"}: ${error.message}`)
      .join("; ");
    throw new ProjectBundleError(
      `The file does not match .agentseo format version 2${detail ? `: ${detail}` : "."}`,
      "invalid_project_bundle",
    );
  }
  const { integrity, ...payload } = raw;
  if (transferPayloadChecksum(payload) !== integrity.bundleSha256) {
    throw new ProjectBundleError(
      "The project bundle checksum does not match its contents.",
      "bundle_checksum_mismatch",
    );
  }

  const runIds = new Set<string>();
  for (const run of raw.runs) {
    if (runIds.has(run.id))
      throw new ProjectBundleError(
        `Duplicate run identifier: ${run.id}`,
        "duplicate_bundle_id",
      );
    if (run.projectId !== raw.project.id)
      throw new ProjectBundleError(
        "Every run must reference the exported project.",
        "orphaned_bundle_record",
      );
    runIds.add(run.id);
  }
  const assertRun = (runId: string, label: string): void => {
    if (!runIds.has(runId))
      throw new ProjectBundleError(
        `${label} references an unknown run ${runId}.`,
        "orphaned_bundle_record",
      );
  };
  const unique = (values: readonly string[], label: string): void => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value))
        throw new ProjectBundleError(
          `Duplicate ${label}: ${value}`,
          "duplicate_bundle_id",
        );
      seen.add(value);
    }
  };
  unique(
    raw.actions.map((action) => action.id),
    "action identifier",
  );
  unique(
    raw.schedules.map((schedule) => schedule.id),
    "schedule identifier",
  );
  unique(
    raw.connectors.map((connector) => connector.provider),
    "connector",
  );
  unique(
    raw.customRules.map((rule) => rule.id),
    "custom rule identifier",
  );
  unique(
    raw.artifacts.map((artifact) => artifact.id),
    "artifact identifier",
  );
  unique(
    raw.runModules.map((record) => `${record.runId}\u001f${record.moduleId}`),
    "run module",
  );
  unique(
    (raw.runConfigurations ?? []).map((record) => record.runId),
    "run configuration",
  );
  unique(
    raw.pages.map((page) => `${page.runId}\u001f${page.canonicalUrl}`),
    "run page",
  );
  unique(
    raw.issues.map(
      (record) => `${record.runId}\u001f${record.issue.fingerprint}`,
    ),
    "run issue",
  );
  unique(
    (raw.issueAdjudications ?? []).map(
      (adjudication) => adjudication.fingerprint,
    ),
    "issue adjudication",
  );
  unique(
    (raw.projectContext?.versions ?? []).map((version) =>
      String(version.revision),
    ),
    "project context revision",
  );
  unique(
    (raw.projectContext?.journal ?? []).map((entry) => entry.id),
    "project context journal identifier",
  );
  unique(
    (raw.extractionRuleVersions ?? []).map((version) =>
      String(version.revision),
    ),
    "extraction-rule revision",
  );
  unique(
    (raw.projectContext?.journal ?? []).map((entry) => String(entry.sequence)),
    "project context journal sequence",
  );
  unique(
    raw.artifacts.map((artifact) => `${artifact.runId}\u001f${artifact.kind}`),
    "run artifact kind",
  );
  unique(
    raw.metrics.map(
      (record) =>
        `${record.runId ?? "<project>"}\u001f${record.key}\u001f${record.metric.source}`,
    ),
    "metric history record",
  );

  raw.runModules.forEach((record) => assertRun(record.runId, "A module"));
  raw.runConfigurations?.forEach((record) =>
    assertRun(record.runId, "A run configuration"),
  );
  if (
    raw.runConfigurations !== undefined &&
    raw.runConfigurations.length !== raw.runs.length
  ) {
    throw new ProjectBundleError(
      "When run configurations are present, every run must have exactly one configuration record.",
      "invalid_project_bundle",
    );
  }
  raw.pages.forEach((record) => assertRun(record.runId, "A page"));
  raw.issues.forEach((record) => assertRun(record.runId, "An issue"));
  raw.metrics.forEach((record) => {
    if (record.runId !== null) assertRun(record.runId, "A metric");
  });
  raw.artifacts.forEach((record) => assertRun(record.runId, "An artifact"));
  raw.projectContext?.journal.forEach((entry) => {
    if (entry.sourceRunId !== null)
      assertRun(entry.sourceRunId, "A project context journal entry");
  });
  const contextRevisions = (raw.projectContext?.versions ?? [])
    .map((version) => version.revision)
    .sort((left, right) => left - right);
  if (contextRevisions.some((revision, index) => revision !== index + 1)) {
    throw new ProjectBundleError(
      "Project context revisions must form a contiguous history starting at 1.",
      "invalid_project_bundle",
    );
  }
  const contextSequences = (raw.projectContext?.journal ?? [])
    .map((entry) => entry.sequence)
    .sort((left, right) => left - right);
  if (contextSequences.some((sequence, index) => sequence !== index + 1)) {
    throw new ProjectBundleError(
      "Project context journal sequences must form a contiguous history starting at 1.",
      "invalid_project_bundle",
    );
  }
  const extractionRevisions = (raw.extractionRuleVersions ?? [])
    .map((version) => version.revision)
    .sort((left, right) => left - right);
  if (extractionRevisions.some((revision, index) => revision !== index + 1)) {
    throw new ProjectBundleError(
      "Extraction-rule revisions must form a contiguous history starting at 1.",
      "invalid_project_bundle",
    );
  }
  const extractionRevisionSet = new Set(extractionRevisions);
  for (const configuration of raw.runConfigurations ?? []) {
    if (!("extractionRuleRevision" in configuration.options)) continue;
    const revision = configuration.options.extractionRuleRevision;
    if (revision === null) continue;
    if (
      typeof revision !== "number" ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      !extractionRevisionSet.has(revision)
    ) {
      throw new ProjectBundleError(
        `Run configuration ${configuration.runId} references an unavailable extraction-rule revision.`,
        "invalid_project_bundle",
      );
    }
  }
  const issueCounts = new Map<string, number>();
  for (const record of raw.issues) {
    issueCounts.set(record.runId, (issueCounts.get(record.runId) ?? 0) + 1);
  }
  for (const run of raw.runs) {
    if ((issueCounts.get(run.id) ?? 0) !== run.issueCount)
      throw new ProjectBundleError(
        `Run ${run.id} issueCount does not match its issue history.`,
        "invalid_project_bundle",
      );
  }
  for (const schedule of raw.schedules) {
    if (schedule.projectId !== raw.project.id)
      throw new ProjectBundleError(
        "Every schedule must reference the exported project.",
        "orphaned_bundle_record",
      );
  }
  const fingerprints = new Set(
    raw.issues.map((record) => record.issue.fingerprint),
  );
  for (const adjudication of raw.issueAdjudications ?? []) {
    if (adjudication.projectId !== raw.project.id)
      throw new ProjectBundleError(
        "Every issue adjudication must reference the exported project.",
        "orphaned_bundle_record",
      );
    if (!fingerprints.has(adjudication.fingerprint))
      throw new ProjectBundleError(
        `Issue adjudication references an unknown fingerprint ${adjudication.fingerprint}.`,
        "orphaned_bundle_record",
      );
  }
  for (const version of raw.projectContext?.versions ?? []) {
    if (version.projectId !== raw.project.id)
      throw new ProjectBundleError(
        "Every project context revision must reference the exported project.",
        "orphaned_bundle_record",
      );
  }
  for (const entry of raw.projectContext?.journal ?? []) {
    if (entry.projectId !== raw.project.id)
      throw new ProjectBundleError(
        "Every project context journal entry must reference the exported project.",
        "orphaned_bundle_record",
      );
  }
  for (const version of raw.extractionRuleVersions ?? []) {
    if (version.projectId !== raw.project.id) {
      throw new ProjectBundleError(
        "Every extraction-rule revision must reference the exported project.",
        "orphaned_bundle_record",
      );
    }
    let rules: ExtractionRule[];
    try {
      rules = normalizedExtractionRules(version.rules);
    } catch (error) {
      throw new ProjectBundleError(
        error instanceof Error
          ? error.message
          : "An extraction-rule revision is invalid.",
        "invalid_project_bundle",
      );
    }
    if (extractionConfigurationHash(rules) !== version.configurationHash) {
      throw new ProjectBundleError(
        `Extraction-rule revision ${version.revision} failed its configuration hash check.`,
        "bundle_checksum_mismatch",
      );
    }
  }
  const issueActionFingerprints = new Set<string>();
  for (const action of raw.actions) {
    if (action.projectId !== raw.project.id)
      throw new ProjectBundleError(
        "Every action must reference the exported project.",
        "orphaned_bundle_record",
      );
    if (action.issueFingerprint) {
      if (!fingerprints.has(action.issueFingerprint))
        throw new ProjectBundleError(
          `Action ${action.id} references an unknown issue fingerprint.`,
          "orphaned_bundle_record",
        );
      if (issueActionFingerprints.has(action.issueFingerprint))
        throw new ProjectBundleError(
          `Multiple actions reference issue ${action.issueFingerprint}.`,
          "duplicate_bundle_id",
        );
      issueActionFingerprints.add(action.issueFingerprint);
    }
  }
  for (const rule of raw.customRules) {
    const required =
      rule.match === "contains"
        ? rule.value
        : rule.match === "regex"
          ? rule.pattern
          : rule.selector;
    if (typeof required !== "string" || required.length === 0)
      throw new ProjectBundleError(
        `Custom rule ${rule.id} is missing the value required by ${rule.match}.`,
        "invalid_custom_rule",
      );
    if (rule.match === "regex") {
      const validation = validateCustomRuleRegex(required);
      if (!validation.safe) {
        const invalid = [
          "invalid_syntax",
          "empty_pattern",
          "invalid_type",
        ].includes(validation.code);
        throw new ProjectBundleError(
          `Custom rule ${rule.id}: ${validation.message}`,
          invalid ? "invalid_custom_rule" : "unsafe_custom_rule_regex",
        );
      }
    }
  }

  let embeddedBytes = 0;
  for (const artifact of raw.artifacts) {
    const expectedMedia = PROJECT_ARTIFACT_MEDIA[artifact.kind];
    if (artifact.mediaType !== expectedMedia)
      throw new ProjectBundleError(
        `Artifact ${artifact.id} has an invalid media type.`,
        "invalid_artifact",
      );
    if (!artifact.contentIncluded) continue;
    const bytes = Buffer.from(artifact.contentBase64, "base64");
    if (bytes.toString("base64") !== artifact.contentBase64)
      throw new ProjectBundleError(
        `Artifact ${artifact.id} is not canonical base64.`,
        "invalid_artifact",
      );
    if (
      bytes.byteLength !== artifact.sizeBytes ||
      sha256(bytes) !== artifact.sha256
    )
      throw new ProjectBundleError(
        `Artifact ${artifact.id} failed its size or checksum check.`,
        "artifact_checksum_mismatch",
      );
    const artifactText = bytes.toString("utf8");
    if (
      secretLikeValue.test(artifactText) ||
      localPathValue.test(artifactText)
    ) {
      throw new ProjectBundleError(
        `Artifact ${artifact.id} contains secret-like or local-only data.`,
        "secret_material_rejected",
      );
    }
    embeddedBytes += bytes.byteLength;
  }
  if (
    embeddedBytes !== raw.integrity.embeddedArtifactBytes ||
    embeddedBytes > AGENTSEO_PROJECT_BUNDLE_LIMITS.maxEmbeddedArtifactBytes
  ) {
    throw new ProjectBundleError(
      "The embedded artifact byte count is invalid.",
      "invalid_artifact",
    );
  }
}

function integrationIdentifier(
  provider: string,
  account: string,
  secret: Uint8Array,
): string {
  try {
    const parsed = JSON.parse(Buffer.from(secret).toString("utf8")) as Record<
      string,
      unknown
    >;
    if (
      provider === "dataforseo" &&
      typeof parsed.login === "string" &&
      parsed.login.trim()
    ) {
      return parsed.login.trim().slice(0, 160);
    }
    if (typeof parsed.apiKey === "string" && parsed.apiKey) {
      return `••••${parsed.apiKey.slice(-4)}`;
    }
  } catch {
    // The connector schema normally guarantees JSON; keep a safe fallback.
  }
  return account === "default" ? "Connected credential" : account.slice(0, 160);
}

function validateScheduleDefinition(
  cron: string,
  timezone: string,
  nextRunAt: string,
): void {
  const cursor = new Date(nextRunAt);
  if (!Number.isFinite(cursor.getTime()))
    throw new Error("nextRunAt must be an absolute ISO date-time");
  nextCronOccurrence(cron, timezone, new Date(cursor.getTime() - 60_000));
}

function issueFingerprint(
  issue: LegacyIssue,
  canonicalUrl: string | null,
): string {
  return sha256(
    `${issue.moduleId ?? "checks"}\u001f${issue.id}\u001f${canonicalUrl ?? "site"}`,
  );
}

function canonicalizeIssueUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return null;
  }
}

/**
 * GA4's `pagePath` dimension is normally root-relative, while crawl issues
 * use absolute URLs. Resolve it only inside the audited project's origin and
 * reject credential-bearing or non-HTTP values before they can influence an
 * action score.
 */
function canonicalizeGa4PagePath(
  value: string | null | undefined,
  projectCanonicalUrl: string,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const base = new URL(projectCanonicalUrl);
    if (
      (base.protocol !== "http:" && base.protocol !== "https:") ||
      base.username ||
      base.password
    ) {
      return null;
    }
    const page = new URL(raw, base);
    if (
      (page.protocol !== "http:" && page.protocol !== "https:") ||
      page.username ||
      page.password ||
      page.origin !== base.origin
    ) {
      return null;
    }
    page.hash = "";
    return page.href;
  } catch {
    return null;
  }
}

const ACTION_EVIDENCE_DEFAULT_LIMIT = 50;
const ACTION_EVIDENCE_MAX_LIMIT = 200;

function actionEvidencePage(options?: { limit?: number; cursor?: string }): {
  limit: number;
  offset: number;
} {
  const limit = options?.limit ?? ACTION_EVIDENCE_DEFAULT_LIMIT;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > ACTION_EVIDENCE_MAX_LIMIT
  ) {
    throw new RangeError(
      `Action evidence limit must be an integer between 1 and ${ACTION_EVIDENCE_MAX_LIMIT}.`,
    );
  }
  if (!options?.cursor) return { limit, offset: 0 };
  if (options.cursor.length > 256) throw new ActionEvidenceCursorError();
  try {
    const decoded = JSON.parse(
      Buffer.from(options.cursor, "base64url").toString("utf8"),
    ) as { offset?: unknown };
    if (!Number.isInteger(decoded.offset) || Number(decoded.offset) < 0) {
      throw new Error("invalid offset");
    }
    return { limit, offset: Number(decoded.offset) };
  } catch {
    throw new ActionEvidenceCursorError();
  }
}

function actionEvidenceCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

type NormalizedPerformancePeriod = {
  period: "current" | "previous";
  startDate: string;
  endDate: string;
  gsc: PerformancePeriodSummary["gsc"];
  ga4: PerformancePeriodSummary["ga4"];
};

function normalizedPerformancePeriods(
  report: EngineReport,
): NormalizedPerformancePeriod[] {
  const comparison = report.realData?.performanceComparison;
  if (comparison) {
    return [
      {
        period: "current",
        startDate: comparison.current.periodStart,
        endDate: comparison.current.periodEnd,
        gsc: comparison.current.gsc,
        ga4: comparison.current.ga4,
      },
      {
        period: "previous",
        startDate: comparison.previous.periodStart,
        endDate: comparison.previous.periodEnd,
        gsc: comparison.previous.gsc,
        ga4: comparison.previous.ga4,
      },
    ];
  }
  const realData = report.realData;
  if (!realData) return [];
  const generatedDate = report.generatedAt.slice(0, 10);
  const startDate = /^\d{4}-\d{2}-\d{2}$/u.test(realData.periodStart)
    ? realData.periodStart
    : generatedDate;
  const endDate = /^\d{4}-\d{2}-\d{2}$/u.test(realData.periodEnd)
    ? realData.periodEnd
    : generatedDate;
  return [
    {
      period: "current",
      startDate,
      endDate,
      gsc:
        realData.gsc.length > 0
          ? {
              perPage: realData.gsc,
              topQueries: realData.topQueries,
              queryPages: [],
            }
          : undefined,
      ga4: realData.ga4.length > 0 ? { perPage: realData.ga4 } : undefined,
    },
  ];
}

function finiteNonNegative(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function finiteUnit(value: number): number | null {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function normalizePerformanceData(input: {
  runId: string;
  projectId: string;
  projectCanonicalUrl: string;
  report: EngineReport;
}): {
  windows: PerformanceWindowRecord[];
  pages: PagePerformanceRecord[];
  queries: QueryPerformanceRecord[];
} {
  const { runId, projectId, projectCanonicalUrl, report } = input;
  const periods = normalizedPerformancePeriods(report);
  const generatedDate = report.generatedAt.slice(0, 10);
  const periodsForPages =
    periods.length > 0
      ? periods
      : [
          {
            period: "current" as const,
            startDate: generatedDate,
            endDate: generatedDate,
            gsc: undefined,
            ga4: undefined,
          },
        ];
  const crawlUrls = new Set(
    report.pages
      .map((page) =>
        canonicalizeGa4PagePath(page.finalUrl || page.url, projectCanonicalUrl),
      )
      .filter((url): url is string => url !== null),
  );
  const pageRecords = new Map<string, PagePerformanceRecord>();
  const queryRecords = new Map<string, QueryPerformanceRecord>();
  const windows: PerformanceWindowRecord[] = [];

  const ensurePage = (
    period: "current" | "previous",
    canonicalUrl: string,
  ): PagePerformanceRecord => {
    const key = `${period}\u001f${canonicalUrl}`;
    const existing = pageRecords.get(key);
    if (existing) return existing;
    const created: PagePerformanceRecord = {
      runId,
      projectId,
      period,
      canonicalUrl,
      crawlMatched: crawlUrls.has(canonicalUrl),
      clicks: null,
      impressions: null,
      ctr: null,
      position: null,
      sessions: null,
      pageViews: null,
      engagementRate: null,
      keyEvents: null,
    };
    pageRecords.set(key, created);
    return created;
  };

  for (const period of periodsForPages) {
    for (const canonicalUrl of crawlUrls)
      ensurePage(period.period, canonicalUrl);

    for (const row of period.gsc?.perPage ?? []) {
      const canonicalUrl = canonicalizeGa4PagePath(
        row.page,
        projectCanonicalUrl,
      );
      const clicks = finiteNonNegative(row.clicks);
      const impressions = finiteNonNegative(row.impressions);
      const ctr = finiteUnit(row.ctr);
      const position = finiteNonNegative(row.position);
      if (
        !canonicalUrl ||
        clicks === null ||
        impressions === null ||
        ctr === null ||
        position === null
      ) {
        continue;
      }
      const record = ensurePage(period.period, canonicalUrl);
      const priorImpressions = record.impressions ?? 0;
      const priorPosition = record.position;
      record.clicks = (record.clicks ?? 0) + clicks;
      record.impressions = priorImpressions + impressions;
      record.ctr =
        record.impressions > 0 ? record.clicks / record.impressions : ctr;
      record.position =
        priorPosition === null
          ? position
          : priorImpressions + impressions > 0
            ? (priorPosition * priorImpressions + position * impressions) /
              (priorImpressions + impressions)
            : (priorPosition + position) / 2;
    }

    for (const row of period.ga4?.perPage ?? []) {
      const canonicalUrl = canonicalizeGa4PagePath(
        row.page,
        projectCanonicalUrl,
      );
      const sessions = finiteNonNegative(row.sessions);
      const pageViews = finiteNonNegative(row.pageViews);
      const engagementRate = finiteUnit(row.engagementRate);
      const keyEvents = finiteNonNegative(row.keyEvents);
      if (
        !canonicalUrl ||
        sessions === null ||
        pageViews === null ||
        engagementRate === null ||
        keyEvents === null
      ) {
        continue;
      }
      const record = ensurePage(period.period, canonicalUrl);
      const priorSessions = record.sessions ?? 0;
      const priorEngagement = record.engagementRate;
      record.sessions = priorSessions + sessions;
      record.pageViews = (record.pageViews ?? 0) + pageViews;
      record.keyEvents = (record.keyEvents ?? 0) + keyEvents;
      record.engagementRate =
        priorEngagement === null
          ? engagementRate
          : priorSessions + sessions > 0
            ? (priorEngagement * priorSessions + engagementRate * sessions) /
              (priorSessions + sessions)
            : (priorEngagement + engagementRate) / 2;
    }

    for (const row of period.gsc?.queryPages ?? []) {
      const canonicalUrl = canonicalizeGa4PagePath(
        row.page,
        projectCanonicalUrl,
      );
      const clicks = finiteNonNegative(row.clicks);
      const impressions = finiteNonNegative(row.impressions);
      const ctr = finiteUnit(row.ctr);
      const position = finiteNonNegative(row.position);
      if (
        !canonicalUrl ||
        !row.query.trim() ||
        clicks === null ||
        impressions === null ||
        ctr === null ||
        position === null
      ) {
        continue;
      }
      const query = row.query.trim();
      const key = `${period.period}\u001f${query}\u001f${canonicalUrl}`;
      const existing = queryRecords.get(key);
      if (!existing) {
        queryRecords.set(key, {
          runId,
          projectId,
          period: period.period,
          query,
          canonicalUrl,
          clicks,
          impressions,
          ctr,
          position,
        });
        continue;
      }
      const priorImpressions = existing.impressions;
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.ctr =
        existing.impressions > 0 ? existing.clicks / existing.impressions : ctr;
      existing.position =
        priorImpressions + impressions > 0
          ? (existing.position * priorImpressions + position * impressions) /
            (priorImpressions + impressions)
          : (existing.position + position) / 2;
    }
  }

  for (const period of periods) {
    for (const source of ["gsc", "ga4"] as const) {
      const provider = period[source];
      const rowLimit = source === "gsc" ? 250_000 : 1_000_000;
      const rowCount = provider?.perPage.length ?? 0;
      const truncated = provider !== undefined && rowCount >= rowLimit;
      windows.push({
        runId,
        projectId,
        source,
        period: period.period,
        startDate: period.startDate,
        endDate: period.endDate,
        fetchedAt: report.generatedAt,
        state:
          provider === undefined
            ? "unavailable"
            : truncated
              ? "partial"
              : "available",
        rowCount,
        rowLimit,
        truncated,
        coverage: null,
        note:
          provider === undefined
            ? `No successful ${source.toUpperCase()} snapshot was available for this period.`
            : truncated
              ? `The ${source.toUpperCase()} page dataset reached its retained row limit.`
              : "Provider completeness cannot be proven from the returned rows alone.",
      });
    }
  }

  return {
    windows,
    pages: [...pageRecords.values()].sort(
      (left, right) =>
        left.period.localeCompare(right.period) ||
        left.canonicalUrl.localeCompare(right.canonicalUrl),
    ),
    queries: [...queryRecords.values()].sort(
      (left, right) =>
        left.period.localeCompare(right.period) ||
        right.impressions - left.impressions ||
        left.query.localeCompare(right.query) ||
        left.canonicalUrl.localeCompare(right.canonicalUrl),
    ),
  };
}

function performanceMetricState(
  state: PerformanceWindowRecord["state"],
): MetricValue["state"] {
  if (state === "available") return "available";
  if (state === "partial") return "stale";
  if (state === "failed") return "failed";
  return "unavailable";
}

function publicCheckpoint(checkpoint: ActionCheckpoint): ActionCheckpoint {
  return {
    id: checkpoint.id,
    actionId: checkpoint.actionId,
    projectId: checkpoint.projectId,
    baselineRunId: checkpoint.baselineRunId,
    state: checkpoint.state,
    createdAt: checkpoint.createdAt,
    updatedAt: checkpoint.updatedAt,
  };
}

function privateHostAllowlist(options: Record<string, unknown>): string[] {
  if (options.privateHostAllowlist === undefined) return [];
  if (!Array.isArray(options.privateHostAllowlist)) {
    throw new TypeError(
      "privateHostAllowlist must be an array of exact hostnames or IP addresses",
    );
  }
  if (options.privateHostAllowlist.length > 32) {
    throw new RangeError(
      "privateHostAllowlist cannot contain more than 32 hosts",
    );
  }
  const hosts = options.privateHostAllowlist.map((value) => {
    if (typeof value !== "string")
      throw new TypeError("privateHostAllowlist entries must be strings");
    const host = value
      .trim()
      .replace(/^\[|\]$/gu, "")
      .replace(/\.$/u, "")
      .toLowerCase();
    if (!host || /[\s/@*]/u.test(host) || host.includes("://")) {
      throw new TypeError(
        `Invalid exact private host allowlist entry '${value}'`,
      );
    }
    if (host.includes(":") && isIP(host) !== 6) {
      throw new TypeError(
        `Private host allowlist entries must not include ports: '${value}'`,
      );
    }
    return host;
  });
  return [...new Set(hosts)];
}

function exactAuditUrls(
  options: Record<string, unknown>,
  projectCanonicalUrl: string,
): string[] | undefined {
  if (options.exactUrls === undefined) return undefined;
  if (!Array.isArray(options.exactUrls)) {
    throw new TypeError("exactUrls must be an array of absolute HTTP(S) URLs");
  }
  if (options.exactUrls.length === 0) {
    throw new TypeError("exactUrls must contain at least one URL");
  }
  const projectOrigin = new URL(projectCanonicalUrl).origin.toLowerCase();
  const urls = options.exactUrls.map((value) => {
    if (typeof value !== "string") {
      throw new TypeError("exactUrls entries must be strings");
    }
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new TypeError(`Unsupported audit URL scheme '${parsed.protocol}'`);
    }
    if (parsed.origin.toLowerCase() !== projectOrigin) {
      throw new TypeError(
        `Exact audit URL '${value}' is outside the project origin`,
      );
    }
    parsed.hash = "";
    return parsed.toString();
  });
  return [...new Set(urls)];
}

function auditReportState(report: EngineReport): {
  status: "succeeded" | "partial" | "failed";
  coverage: number;
  error: string | null;
} {
  const total = report.pages.length;
  const failedPages = report.pages.filter((page) => page.status === 0).length;
  const respondedPages = total - failedPages;
  const coverage = total === 0 ? 0 : respondedPages / total;
  const errors = [...(report.realData?.errors ?? [])];
  if (failedPages > 0)
    errors.push(`${failedPages} of ${total} crawled page requests failed`);
  if (total === 0 || respondedPages === 0) {
    if (total === 0) errors.push("The crawl returned no pages");
    return {
      status: "failed",
      coverage,
      error: errors.join("; ") || "The crawl produced no usable page evidence",
    };
  }
  if (errors.length > 0)
    return { status: "partial", coverage, error: errors.join("; ") };
  return { status: "succeeded", coverage, error: null };
}

function normalizeIssues(report: EngineReport): IssueInstance[] {
  const observedAt = report.generatedAt;
  const normalized = new Map<string, IssueInstance>();
  for (const issue of report.issues) {
    const urls = issue.urls.length > 0 ? issue.urls : [null];
    for (const value of urls) {
      const canonicalUrl = canonicalizeIssueUrl(value);
      const fingerprint = issueFingerprint(issue, canonicalUrl);
      const title = boundedContractText(issue.message, 240, "SEO issue");
      normalized.set(fingerprint, {
        fingerprint,
        ruleId: issue.id,
        moduleId: issue.moduleId ?? "checks",
        canonicalUrl,
        severity: severity(issue.priority),
        title,
        description: boundedContractText(
          issue.fix ?? issue.message,
          4_000,
          title,
        ),
        evidence: [
          {
            kind: "crawl-observation",
            label: title,
            ...(issue.detail ? { value: issue.detail } : {}),
            source: issue.moduleId ?? "core",
            observedAt,
          },
        ],
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
        status: "open",
      });
    }
  }
  return [...normalized.values()];
}

function normalizeActions(
  projectId: string,
  projectCanonicalUrl: string,
  report: EngineReport,
): Action[] {
  const pageCount = Math.max(1, report.summary.pagesCrawled);
  const gsc = report.realData?.gsc ?? [];
  const ga4 = report.realData?.ga4 ?? [];
  const maxImpressions = Math.max(0, ...gsc.map((row) => row.impressions));
  const impressions = new Map(
    gsc.flatMap((row) => {
      const page = canonicalizeIssueUrl(row.page);
      return page ? [[page, row.impressions] as const] : [];
    }),
  );
  const keyEvents = new Map<string, number>();
  for (const row of ga4) {
    const page = canonicalizeGa4PagePath(row.page, projectCanonicalUrl);
    const value = row.keyEvents;
    if (
      !page ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      continue;
    }
    // Canonicalization can merge equivalent default-port/fragment variants.
    keyEvents.set(page, (keyEvents.get(page) ?? 0) + value);
  }
  const maxKeyEvents = Math.max(0, ...keyEvents.values());
  const generatedAt = report.generatedAt;

  // A marketer action represents a rule/module group, even when the engine
  // emits multiple issue rows or changes URL ordering between runs.
  const groupedIssues = new Map<string, LegacyIssue>();
  const priorityRank = { High: 3, Medium: 2, Low: 1 } as const;
  for (const issue of report.issues) {
    const key = `${issue.moduleId ?? "checks"}\u001f${issue.id}`;
    const existing = groupedIssues.get(key);
    if (!existing) {
      groupedIssues.set(key, { ...issue, urls: [...issue.urls] });
      continue;
    }
    groupedIssues.set(key, {
      ...existing,
      priority:
        priorityRank[issue.priority] > priorityRank[existing.priority]
          ? issue.priority
          : existing.priority,
      detail: existing.detail ?? issue.detail,
      fix: existing.fix ?? issue.fix,
      urls: [...existing.urls, ...issue.urls],
    });
  }

  return [...groupedIssues.values()]
    .map<Action>((issue) => {
      const validUrls = [
        ...new Set(
          issue.urls
            .map((url) => canonicalizeIssueUrl(url))
            .filter((url): url is string => url !== null),
        ),
      ].sort((left, right) => left.localeCompare(right));
      const organicExposure =
        report.realData && gsc.length > 0
          ? Math.max(0, ...validUrls.map((url) => impressions.get(url) ?? 0)) /
            Math.max(1, maxImpressions)
          : null;
      const matchedKeyEvents = validUrls.flatMap((url) =>
        keyEvents.has(url) ? [keyEvents.get(url)!] : [],
      );
      const conversionExposure =
        matchedKeyEvents.length > 0
          ? Math.max(0, ...matchedKeyEvents) / Math.max(1, maxKeyEvents)
          : null;
      const effort: Action["effort"] =
        /structured|hreflang|canonical|redirect/i.test(
          `${issue.id} ${issue.category}`,
        )
          ? "high"
          : validUrls.length <= 5
            ? "low"
            : "medium";
      const scored = scorePriorityV1({
        severity: severity(issue.priority),
        organicExposure,
        conversionExposure,
        urlReach: Math.min(1, validUrls.length / pageCount),
        confidence: issue.detail ? 0.92 : 0.82,
        effort,
      });
      const fingerprint = issueFingerprint(issue, validUrls[0] ?? null);
      const actionIdentity = sha256(
        `${projectId}\u001f${issue.moduleId ?? "checks"}\u001f${issue.id}`,
      );
      const exposureMessage =
        organicExposure === null
          ? "Organic exposure is unavailable until Search Console is connected."
          : `The affected set reaches ${Math.round(organicExposure * 100)}% of the highest observed organic exposure.`;
      return {
        id: `action-${actionIdentity.slice(0, 24)}`,
        projectId,
        ruleId: issue.id,
        moduleId: issue.moduleId ?? "checks",
        issueFingerprint: fingerprint,
        title: boundedContractText(issue.message, 240, "SEO action"),
        whyNow: `${validUrls.length || 1} affected URL${validUrls.length === 1 ? "" : "s"}. ${exposureMessage}`,
        impact: scored.impact,
        effort,
        confidence: scored.scoreInputs.confidence,
        priorityScore: scored.priorityScore,
        scoreVersion: "priority-v1",
        scoreInputs: scored.scoreInputs,
        affectedUrls: validUrls,
        owner: null,
        status: "open",
        verification: "pending",
        createdAt: generatedAt,
        updatedAt: generatedAt,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

const RUN_EVIDENCE_VERSION = 1;
const RUN_EVIDENCE_SAMPLE_LIMIT = 100;
const RUN_EVIDENCE_ARTIFACT_LIMIT = 2 * 1024 * 1024;

interface StoredRunEvidenceSummary {
  version: typeof RUN_EVIDENCE_VERSION;
  generatedAt: string;
  sitemap: SitemapEvidence;
}

function evidenceRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function evidenceUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function evidenceText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function evidenceStatusCode(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 999
    ? value
    : null;
}

function uniqueConsecutive(values: readonly string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (result.at(-1) !== value) result.push(value);
  }
  return result;
}

function normalizeRunEvidenceItem(
  section: RunEvidenceListOptions["section"],
  page: StoredPageRecord,
): RunEvidenceItem | null {
  const finalUrl = evidenceUrl(page.canonicalUrl);
  const sourceUrl =
    evidenceUrl(page.payload.sourceUrl) ?? evidenceUrl(page.canonicalUrl);
  if (!sourceUrl || !finalUrl) return null;

  if (section === "crawl") {
    const crawlDepth = page.payload.crawlDepth;
    return {
      kind: "crawl",
      sourceUrl,
      finalUrl,
      title: evidenceText(page.title, 2_000),
      statusCode: evidenceStatusCode(page.statusCode),
      indexable: page.indexable,
      crawlDepth:
        typeof crawlDepth === "number" &&
        Number.isInteger(crawlDepth) &&
        crawlDepth >= 0
          ? crawlDepth
          : null,
      discoveredFrom: evidenceUrl(page.payload.discoveredFrom),
    };
  }

  if (section === "redirects") {
    const storedChain = Array.isArray(page.payload.redirectChain)
      ? page.payload.redirectChain.flatMap((value) => {
          const normalized = evidenceUrl(value, sourceUrl);
          return normalized ? [normalized] : [];
        })
      : [];
    const chain = uniqueConsecutive([sourceUrl, ...storedChain]);
    if (chain.at(-1) !== finalUrl) chain.push(finalUrl);
    if (chain.length < 2) return null;
    return {
      kind: "redirect",
      sourceUrl,
      finalUrl,
      finalStatusCode: evidenceStatusCode(page.statusCode),
      hopCount: chain.length - 1,
      chain,
    };
  }

  if (section === "hreflang") {
    const raw = evidenceRecord(page.payload.hreflang);
    if (!raw || !Array.isArray(raw.alternates)) return null;
    const targetStates = new Set(["self", "crawled", "not_crawled", "invalid"]);
    const reciprocalStates = new Set([
      "matched",
      "missing",
      "language_mismatch",
      "not_applicable",
      "unavailable",
    ]);
    const alternates = raw.alternates.flatMap((value) => {
      const alternate = evidenceRecord(value);
      const lang = evidenceText(alternate?.lang, 80);
      const declaredUrl = evidenceText(alternate?.declaredUrl, 4_000);
      const targetState = evidenceText(alternate?.targetState, 80);
      const reciprocal = evidenceText(alternate?.reciprocal, 80);
      if (
        !alternate ||
        !lang ||
        !declaredUrl ||
        !targetState ||
        !targetStates.has(targetState) ||
        !reciprocal ||
        !reciprocalStates.has(reciprocal)
      ) {
        return [];
      }
      const observedReturnLanguages = Array.isArray(
        alternate.observedReturnLanguages,
      )
        ? alternate.observedReturnLanguages.flatMap((language) => {
            const normalized = evidenceText(language, 80);
            return normalized ? [normalized] : [];
          })
        : [];
      return [
        {
          lang,
          declaredUrl,
          resolvedUrl: evidenceUrl(alternate.resolvedUrl, finalUrl),
          selfReference: alternate.selfReference === true,
          targetState: targetState as
            "self" | "crawled" | "not_crawled" | "invalid",
          targetStatusCode: evidenceStatusCode(alternate.targetStatusCode),
          reciprocal: reciprocal as
            | "matched"
            | "missing"
            | "language_mismatch"
            | "not_applicable"
            | "unavailable",
          expectedReturnLanguage: evidenceText(
            alternate.expectedReturnLanguage,
            80,
          ),
          observedReturnLanguages,
        },
      ];
    });
    if (alternates.length === 0) return null;
    return {
      kind: "hreflang",
      sourceUrl,
      finalUrl,
      htmlLang: evidenceText(raw.htmlLang, 80),
      selfLanguage: evidenceText(raw.selfLanguage, 80),
      hasXDefault: raw.hasXDefault === true,
      alternates,
    };
  }

  const rawExtractions = Array.isArray(page.payload.extractions)
    ? page.payload.extractions
    : [];
  const fields = rawExtractions.flatMap((value) => {
    const field = evidenceRecord(value);
    const label = evidenceText(field?.label, 240);
    if (!field || !label) return [];
    const originalValue = typeof field.value === "string" ? field.value : null;
    return [
      {
        label,
        value: originalValue === null ? null : originalValue.slice(0, 20_000),
        truncated:
          field.truncated === true ||
          (originalValue !== null && originalValue.length > 20_000),
      },
    ];
  });
  if (fields.length === 0) return null;
  return { kind: "extraction", sourceUrl, finalUrl, fields };
}

function sitemapUrlSample(
  values: readonly string[],
): SitemapEvidence["missingIndexable"] {
  const urls = [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  );
  return {
    total: urls.length,
    urls: urls.slice(0, RUN_EVIDENCE_SAMPLE_LIMIT),
    complete: urls.length <= RUN_EVIDENCE_SAMPLE_LIMIT,
  };
}

function unavailableSitemapSample(): SitemapEvidence["missingIndexable"] {
  return { total: null, urls: [], complete: false };
}

function buildSitemapEvidence(report: EngineReport): SitemapEvidence {
  const snapshot = report.sitemap;
  const state = snapshot?.state ?? "not_captured";
  const indexability = summarizePageIndexability(report.pages);
  const aliases = new Map<string, (typeof report.pages)[number]>();
  const discoveredIndexable = new Set<string>();
  for (const [index, page] of report.pages.entries()) {
    const sourceUrl = evidenceUrl(page.url);
    const finalUrl = evidenceUrl(page.finalUrl);
    if (sourceUrl) aliases.set(sourceUrl, page);
    if (finalUrl && !aliases.has(finalUrl)) aliases.set(finalUrl, page);
    if (finalUrl && indexability.assessments[index]?.indexable === true) {
      discoveredIndexable.add(finalUrl);
    }
  }
  const sourceUrl = evidenceUrl(snapshot?.sourceUrl);
  const files = (snapshot?.files ?? []).flatMap((file) => {
    const url = evidenceUrl(file.url);
    if (!url) return [];
    return [
      {
        url,
        kind: file.kind,
        statusCode: evidenceStatusCode(file.statusCode),
        locCount:
          Number.isSafeInteger(file.locCount) && file.locCount >= 0
            ? file.locCount
            : 0,
      },
    ];
  });
  const warnings = [
    ...(snapshot?.warnings ?? []),
    ...(!snapshot
      ? ["This run predates versioned sitemap evidence capture."]
      : []),
  ].map((warning) => boundedContractText(warning, 1_000, "Sitemap warning"));

  if (state !== "available") {
    return {
      state,
      sourceUrl,
      fetchStatusCode: evidenceStatusCode(snapshot?.statusCode),
      files,
      declaredUrls: null,
      discoveredIndexableUrls: discoveredIndexable.size,
      matchedIndexableUrls: null,
      coverage: null,
      missingIndexable: unavailableSitemapSample(),
      declaredNotCrawled: unavailableSitemapSample(),
      brokenDeclared: unavailableSitemapSample(),
      warnings,
    };
  }

  const declared = new Set(
    (snapshot?.pageUrls ?? []).flatMap((value) => {
      const url = evidenceUrl(value, sourceUrl ?? report.startUrl);
      return url ? [url] : [];
    }),
  );
  const matched = [...discoveredIndexable].filter((url) => declared.has(url));
  const missing = [...discoveredIndexable].filter((url) => !declared.has(url));
  const notCrawled = [...declared].filter((url) => !aliases.has(url));
  const broken = [...declared].filter((url) => {
    const page = aliases.get(url);
    return page ? page.status >= 400 : false;
  });
  return {
    state: "available",
    sourceUrl,
    fetchStatusCode: evidenceStatusCode(snapshot?.statusCode),
    files,
    declaredUrls: declared.size,
    discoveredIndexableUrls: discoveredIndexable.size,
    matchedIndexableUrls: matched.length,
    coverage:
      discoveredIndexable.size > 0
        ? matched.length / discoveredIndexable.size
        : null,
    missingIndexable: sitemapUrlSample(missing),
    declaredNotCrawled: sitemapUrlSample(notCrawled),
    brokenDeclared: sitemapUrlSample(broken),
    warnings,
  };
}

async function createPdf(report: EngineReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("AGENTseo audit");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  let y = 790;
  const safe = (value: string): string => value.replace(/[^\x20-\x7E]/g, "?");
  page.drawText("AGENTseo audit", {
    x: 48,
    y,
    size: 22,
    font: bold,
    color: rgb(0.12, 0.16, 0.23),
  });
  y -= 32;
  page.drawText(safe(report.startUrl).slice(0, 88), {
    x: 48,
    y,
    size: 9,
    font,
  });
  y -= 28;
  page.drawText(
    `Pages: ${report.summary.pagesCrawled}    Issues: ${report.issues.length}    Generated: ${report.generatedAt}`,
    { x: 48, y, size: 9, font },
  );
  y -= 32;
  page.drawText("Highest-priority findings", {
    x: 48,
    y,
    size: 14,
    font: bold,
  });
  y -= 22;
  const ordered = [...report.issues].sort(
    (a, b) =>
      ({ High: 0, Medium: 1, Low: 2 })[a.priority] -
      { High: 0, Medium: 1, Low: 2 }[b.priority],
  );
  for (const issue of ordered.slice(0, 18)) {
    if (y < 60) break;
    page.drawText(safe(`[${issue.priority}] ${issue.message}`).slice(0, 92), {
      x: 52,
      y,
      size: 9,
      font,
    });
    y -= 18;
  }
  return pdf.save();
}

export class AgentSeoLocalRuntime implements AgentSeoRuntime {
  readonly dataDir: string;
  readonly database: AgentSeoDatabase;
  readonly credentialStore: CredentialStore;
  readonly version: string;
  readonly events = new EventEmitter();
  private readonly controllers = new Map<string, AbortController>();
  private readonly workflows = createWorkflowRegistry();
  private readonly jobWorker: DurableJobWorker;
  private readonly scheduler: DurableScheduler;
  private googleDesktopClientId: string | undefined;
  private oauthFetch: typeof fetch | undefined;
  private readonly integrationFetch: typeof fetch | undefined;
  private readonly tokenRefreshes = new Map<
    string,
    Promise<Pick<StoredOAuthCredential, "accessToken">>
  >();
  private deletionCleanupPending = false;
  private engine?: EngineModule;

  readonly projects = {
    list: async () => this.database.listProjects(),
    create: async (input: CreateProjectInput) =>
      this.database.createProject(input),
    overview: async (projectId: string): Promise<ProjectOverview> => {
      const project = this.database.getProject(projectId);
      if (!project) throw new Error("Project not found");
      const runs = this.database.listRuns(projectId);
      const metrics = this.database.latestMetrics(projectId);
      const source = (key: string, fallback: MetricValue): MetricValue =>
        metrics[key] ?? fallback;
      return {
        project,
        seoHealth: source(
          "seo_health",
          unavailable("crawl", "Run the first audit to calculate SEO Health."),
        ),
        healthChange: source(
          "health_change",
          unavailable(
            "comparison",
            "Two successful audits are required for change.",
          ),
        ),
        gscClicks: source(
          "gsc_clicks",
          unavailable(
            "google-search-console",
            "Connect Search Console to measure clicks.",
          ),
        ),
        gscImpressions: source(
          "gsc_impressions",
          unavailable(
            "google-search-console",
            "Connect Search Console to measure impressions.",
          ),
        ),
        organicKeyEvents: source(
          "organic_key_events",
          unavailable(
            "google-analytics-4",
            "Connect GA4 to measure organic key events.",
          ),
        ),
        indexableCoverage: source(
          "indexable_coverage",
          unavailable("crawl", "Run the first audit to measure coverage."),
        ),
        cwvPassRate: source(
          "cwv_pass_rate",
          unavailable(
            "browser",
            "Run a JavaScript or performance audit to measure CWV.",
          ),
        ),
        criticalRegressions: source(
          "critical_regressions",
          unavailable(
            "comparison",
            "Two successful audits are required for regressions.",
          ),
        ),
        topActions: this.listEffectiveActions(projectId)
          .filter((action) => action.status !== "resolved")
          .slice(0, 5),
        lastRun: runs[0] ?? null,
      };
    },
    delete: async (
      input: DeleteProjectInput,
    ): Promise<ProjectDeletionReceipt> => this.deleteProject(input),
  };

  readonly runs = {
    start: async (
      input: StartRunInput,
      idempotencyKey?: string,
    ): Promise<Run> => {
      if (!this.database.getProject(input.projectId))
        throw new Error("Project not found");
      const runOptions = { ...(input.options ?? {}) };
      if ((input.workflowId ?? "audit") === "audit") {
        // This reserved option makes extraction output reproducible even after
        // the marketer edits the project's current rule set.
        delete runOptions.extractionRuleRevision;
        const currentExtractionRules = this.database.getExtractionRuleWorkspace(
          input.projectId,
        )?.current;
        runOptions.extractionRuleRevision =
          currentExtractionRules?.revision ?? null;
      }
      const id = randomUUID();
      const run = this.database.insertRun({
        id,
        projectId: input.projectId,
        workflowId: input.workflowId ?? "audit",
        idempotencyKey,
        options: runOptions,
      });
      if (run.id === id) {
        this.emitRun(run.id, "run.queued", {
          workflowId: run.workflowId,
          ...(typeof runOptions.extractionRuleRevision === "number"
            ? {
                extractionRuleRevision: runOptions.extractionRuleRevision,
              }
            : {}),
        });
        this.database.enqueueJob({
          runId: run.id,
          type: "run.execute",
          payload: { runId: run.id },
          maxAttempts: 3,
        });
      }
      return run;
    },
    replay: async (
      sourceRunId: string,
      idempotencyKey: string,
    ): Promise<RunReplay | null> => {
      const source = this.database.getRun(sourceRunId);
      if (!source) return null;
      if (idempotencyKey.length < 8 || idempotencyKey.length > 256) {
        throw new RunReplayError(
          "Replay requests require an Idempotency-Key between 8 and 256 characters.",
          "invalid_idempotency_key",
          400,
        );
      }
      if (source.status === "queued" || source.status === "running") {
        throw new RunReplayError(
          "Wait for the source run to reach a terminal state before replaying its configuration.",
          "source_run_not_terminal",
          409,
        );
      }
      if (
        !["audit", "compare", "keyword-research", "content-plan"].includes(
          source.workflowId,
        )
      ) {
        throw new RunReplayError(
          "The source run uses a workflow that this runtime cannot replay.",
          "source_workflow_unsupported",
          409,
        );
      }
      const options = this.database.getRunOptions(sourceRunId);
      const configurationVersion = 1 as const;
      const configurationHash = sha256(
        stableJson({
          configurationVersion,
          workflowId: source.workflowId,
          options,
        }),
      );
      const replayIdempotencyKey = `replay:${sha256(
        stableJson({ sourceRunId, idempotencyKey }),
      )}`;
      const id = randomUUID();
      const run = this.database.insertRun({
        id,
        projectId: source.projectId,
        workflowId: source.workflowId,
        idempotencyKey: replayIdempotencyKey,
        options,
      });
      if (run.id === id) {
        this.emitRun(run.id, "run.queued", { workflowId: run.workflowId });
        this.emitRun(run.id, "run.replay_queued", {
          sourceRunId,
          configurationVersion,
          configurationHash,
        });
        this.database.enqueueJob({
          runId: run.id,
          type: "run.execute",
          payload: { runId: run.id },
          maxAttempts: 3,
        });
      }
      return {
        sourceRunId,
        configurationVersion,
        configurationHash,
        run,
      };
    },
    compare: async (
      currentRunId: string,
      baselineRunId: string,
    ): Promise<RunComparison> => {
      const currentRun = this.database.getRun(currentRunId);
      if (!currentRun) {
        throw new RunComparisonError(
          "The current run was not found.",
          "current_run_not_found",
          404,
        );
      }
      const baselineRun = this.database.getRun(baselineRunId);
      if (!baselineRun) {
        throw new RunComparisonError(
          "The baseline run was not found.",
          "baseline_run_not_found",
          404,
        );
      }
      if (currentRun.id === baselineRun.id) {
        throw new RunComparisonError(
          "Choose two different audit runs.",
          "comparison_same_run",
          422,
        );
      }
      if (currentRun.projectId !== baselineRun.projectId) {
        throw new RunComparisonError(
          "Audit comparisons cannot cross project boundaries.",
          "comparison_project_mismatch",
          422,
        );
      }
      if (
        currentRun.workflowId !== "audit" ||
        baselineRun.workflowId !== "audit"
      ) {
        throw new RunComparisonError(
          "Historical audit comparison only supports audit workflow runs.",
          "comparison_workflow_unsupported",
          422,
        );
      }
      if (
        !["succeeded", "partial"].includes(currentRun.status) ||
        !["succeeded", "partial"].includes(baselineRun.status)
      ) {
        throw new RunComparisonError(
          "Both audit runs must be succeeded or partial before comparison.",
          "comparison_run_not_ready",
          409,
        );
      }
      if (
        Date.parse(baselineRun.requestedAt) > Date.parse(currentRun.requestedAt)
      ) {
        throw new RunComparisonError(
          "The baseline must not be newer than the current audit.",
          "comparison_direction_invalid",
          422,
        );
      }
      return buildAuditComparison({
        baselineRun,
        currentRun,
        baselineOptions: this.database.getRunOptions(baselineRun.id),
        currentOptions: this.database.getRunOptions(currentRun.id),
        baselineIssues: this.database.listIssues(baselineRun.id),
        currentIssues: this.database.listIssues(currentRun.id),
        baselinePages: this.database.listPages(baselineRun.id),
        currentPages: this.database.listPages(currentRun.id),
        baselineLinkGraph: this.database.getRunLinkGraphSnapshot(
          baselineRun.id,
        ),
        currentLinkGraph: this.database.getRunLinkGraphSnapshot(currentRun.id),
        metrics: this.database.listMetricHistory(currentRun.projectId),
      });
    },
    list: async (projectId?: string) => this.database.listRuns(projectId),
    get: async (runId: string) => this.database.getRun(runId),
    cancel: async (runId: string): Promise<Run | null> => {
      const run = this.database.getRun(runId);
      if (
        !run ||
        ["succeeded", "partial", "failed", "cancelled"].includes(run.status)
      )
        return run;
      this.controllers.get(runId)?.abort(new Error("Cancelled by user"));
      const job = this.database.activeJobForRun(runId);
      if (job) this.database.cancelJob(job.id);
      const cancelled = this.database.updateRun(runId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
        error: null,
      });
      this.emitRun(runId, "run.cancelled");
      return cancelled;
    },
    issues: async (runId: string) => this.database.listIssues(runId),
    evidence: async (
      runId: string,
      options: RunEvidenceListOptions,
    ): Promise<RunEvidencePage | null> => this.runEvidence(runId, options),
    links: async (
      runId: string,
      options: RunLinkExplorerOptions,
    ): Promise<RunLinkExplorer | null> => this.runLinks(runId, options),
  };

  readonly context = {
    get: async (projectId: string): Promise<ProjectContextWorkspace | null> =>
      this.database.getProjectContext(projectId),
    update: async (
      input: UpdateProjectContextInput,
    ): Promise<ProjectContextWorkspace | null> => {
      if (!this.database.getProject(input.projectId)) {
        throw new ProjectContextError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
      const profile = normalizeProjectContextProfile(input.profile);
      const changeSummary =
        typeof input.changeSummary === "string"
          ? input.changeSummary.trim()
          : "";
      if (
        !Value.Check(ProjectContextProfileSchema, profile) ||
        changeSummary.length < 3 ||
        changeSummary.length > 240
      ) {
        throw new ProjectContextError(
          "Project context must stay within the documented field and list limits.",
          "invalid_project_context",
          422,
        );
      }
      assertSafeProjectContextText([
        changeSummary,
        ...projectContextProfileText(profile),
      ]);
      return this.database.updateProjectContext(
        input.projectId,
        profile,
        changeSummary,
        "local-user",
      );
    },
    append: async (input: AppendProjectContextJournalInput) => {
      if (!this.database.getProject(input.projectId)) {
        throw new ProjectContextError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
      const normalized = {
        projectId: input.projectId,
        kind: input.kind,
        title: typeof input.title === "string" ? input.title.trim() : "",
        detail: typeof input.detail === "string" ? input.detail.trim() : "",
        sourceRunId: input.sourceRunId?.trim() || null,
      };
      if (!Value.Check(AppendProjectContextJournalInputSchema, normalized)) {
        throw new ProjectContextError(
          "The context journal entry is invalid or exceeds its limits.",
          "invalid_project_context",
          422,
        );
      }
      assertSafeProjectContextText([normalized.title, normalized.detail]);
      if (normalized.sourceRunId) {
        const run = this.database.getRun(normalized.sourceRunId);
        if (!run || run.projectId !== input.projectId) {
          throw new ProjectContextError(
            "The source run does not belong to this project.",
            "invalid_source_run",
            422,
          );
        }
      }
      return this.database.appendProjectContextJournal({
        ...normalized,
        actor: "local-user",
      });
    },
  };

  readonly extractionRules = {
    templates: async (): Promise<ExtractionRuleTemplateCatalog> => {
      const catalog = structuredClone(
        BUILT_IN_EXTRACTION_RULE_TEMPLATE_CATALOG,
      ) as ExtractionRuleTemplateCatalog;
      if (!Value.Check(ExtractionRuleTemplateCatalogSchema, catalog)) {
        throw new ExtractionRulesError(
          "The built-in extraction template catalog is invalid.",
          "extraction_template_catalog_invalid",
          500,
        );
      }
      return catalog;
    },
    get: async (projectId: string): Promise<ExtractionRuleWorkspace | null> =>
      this.database.getExtractionRuleWorkspace(projectId),
    update: async (
      input: UpdateExtractionRulesInput,
    ): Promise<ExtractionRuleWorkspace | null> => {
      if (!this.database.getProject(input.projectId)) {
        throw new ExtractionRulesError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
      if (!Value.Check(UpdateExtractionRulesInputSchema, input)) {
        throw new ExtractionRulesError(
          "The extraction rule set does not match the documented limits.",
          "invalid_extraction_rules",
          422,
        );
      }
      const changeSummary = input.changeSummary.trim();
      if (changeSummary.length < 3 || changeSummary.length > 240) {
        throw new ExtractionRulesError(
          "Describe this extraction-rule revision in 3 to 240 characters.",
          "invalid_extraction_rules",
          422,
        );
      }
      const rules = normalizedExtractionRules(input.rules);
      const serialized = stableJson({ changeSummary, rules });
      if (secretLikeValue.test(serialized)) {
        throw new ExtractionRulesError(
          "Extraction rules cannot contain credentials or secret-like values.",
          "invalid_extraction_rules",
          422,
        );
      }
      return this.database.updateExtractionRules({
        projectId: input.projectId,
        rules,
        configurationHash: extractionConfigurationHash(rules),
        changeSummary,
        actor: "local-user",
      });
    },
    preview: async (
      input: PreviewExtractionRulesInput,
    ): Promise<ExtractionPreview> => {
      const project = this.database.getProject(input.projectId);
      if (!project) {
        throw new ExtractionRulesError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
      if (!Value.Check(PreviewExtractionRulesInputSchema, input)) {
        throw new ExtractionRulesError(
          "The extraction preview request does not match the documented limits.",
          "invalid_extraction_rules",
          422,
        );
      }
      const rules = normalizedExtractionRules(input.rules);
      const enabledRules = rules.filter((rule) => rule.enabled);
      if (enabledRules.length === 0) {
        throw new ExtractionRulesError(
          "Enable at least one extraction rule before running a preview.",
          "invalid_extraction_rules",
          422,
        );
      }
      let requestedUrl: URL;
      let projectUrl: URL;
      try {
        requestedUrl = new URL(input.url);
        projectUrl = new URL(project.canonicalUrl);
      } catch {
        throw new ExtractionRulesError(
          "The preview URL must be an absolute HTTP or HTTPS URL.",
          "preview_url_out_of_scope",
          422,
        );
      }
      if (
        !["http:", "https:"].includes(requestedUrl.protocol) ||
        requestedUrl.username !== "" ||
        requestedUrl.password !== "" ||
        requestedUrl.origin !== projectUrl.origin
      ) {
        throw new ExtractionRulesError(
          "Preview URLs must use the selected project's exact origin and cannot contain credentials.",
          "preview_url_out_of_scope",
          422,
        );
      }
      requestedUrl.hash = "";
      const engine = await this.loadEngine();
      if (!engine.previewExtraction) {
        throw new ExtractionRulesError(
          "The installed engine does not support extraction previews.",
          "extraction_preview_failed",
          500,
        );
      }
      try {
        const preview = await engine.previewExtraction({
          url: requestedUrl.href,
          renderMode: input.renderMode === "js" ? "js" : "static",
          allowPrivateHost: input.allowPrivateHost === true,
          rules: enabledRules.map((rule) => ({
            label: rule.label,
            selector: rule.selector,
            type: rule.type,
            ...(rule.attribute !== null ? { attribute: rule.attribute } : {}),
            ...(rule.regex !== null ? { regex: rule.regex } : {}),
          })),
        });
        if (preview.fields.length !== enabledRules.length) {
          throw new Error("The engine returned an incomplete field set.");
        }
        const result: ExtractionPreview = {
          projectId: project.id,
          requestedUrl: preview.requestedUrl,
          finalUrl: preview.finalUrl,
          statusCode: preview.statusCode,
          contentType: preview.contentType.slice(0, 500),
          renderMode: preview.renderMode,
          responseTimeMs: preview.responseTimeMs,
          configurationHash: extractionConfigurationHash(rules),
          fields: preview.fields.map((field, index) => ({
            ruleId: enabledRules[index]!.id,
            label: enabledRules[index]!.label,
            value:
              field.value === null
                ? null
                : (redactedRuntimeText(field.value)?.slice(0, 20_000) ?? null),
            truncated:
              field.truncated === true || (field.value?.length ?? 0) > 20_000,
          })),
        };
        return result;
      } catch (error) {
        if (error instanceof ExtractionRulesError) throw error;
        throw new ExtractionRulesError(
          error instanceof Error
            ? `Extraction preview failed: ${redactedRuntimeText(error.message) ?? "unknown error"}`
            : "Extraction preview failed.",
          "extraction_preview_failed",
          422,
        );
      }
    },
  };

  readonly issues = {
    list: async (
      projectId: string,
      options: IssueReviewListOptions = {},
    ): Promise<IssueReviewPage> => {
      if (!this.database.getProject(projectId)) {
        throw new IssueAdjudicationError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
      return this.database.listProjectIssueReviews(projectId, options);
    },
    update: async (
      fingerprint: string,
      input: UpdateIssueAdjudicationInput,
    ) => {
      if (!this.database.getProject(input.projectId)) {
        throw new IssueAdjudicationError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
      const note = input.note?.trim() || null;
      if (input.status !== "open" && (!note || note.length < 3)) {
        throw new IssueAdjudicationError(
          "Explain why this issue should be ignored or treated as a false positive.",
          "adjudication_note_required",
          422,
        );
      }
      if (note && secretLikeValue.test(note)) {
        throw new IssueAdjudicationError(
          "The review note contains secret-like material.",
          "secret_material_rejected",
          422,
        );
      }
      if (note && localPathValue.test(note)) {
        throw new IssueAdjudicationError(
          "The review note contains a local filesystem path.",
          "local_path_rejected",
          422,
        );
      }
      return this.database.updateIssueAdjudication(
        input.projectId,
        fingerprint,
        {
          status: input.status,
          note,
          actor: "local-user",
        },
      );
    },
  };

  readonly actions = {
    list: async (projectId?: string) => this.listEffectiveActions(projectId),
    update: async (actionId: string, input: UpdateActionInput) =>
      this.database.updateAction(actionId, input),
    evidence: async (
      actionId: string,
      options?: { limit?: number; cursor?: string },
    ) => this.buildActionEvidence(actionId, options),
    createCheckpoint: async (actionId: string) =>
      this.createActionCheckpoint(actionId),
    // Verification orchestration is owned by the targeted-audit workflow.
    // Keep the runtime contract explicit while that workflow is wired.
    verify: async () => null,
    outcomes: async (actionId: string) => this.actionOutcomes(actionId),
  };

  private listEffectiveActions(projectId?: string): Action[] {
    const actions = this.database.listActions(projectId, {
      includeAdjudicated: true,
    });
    const scopes = this.database.listActionIssueScopes(projectId);
    return actions
      .flatMap((action): Action[] => {
        const scope = scopes.get(action.id);
        if (scope && scope.currentInstances > 0) {
          if (scope.visibleInstances === 0) return [];
          if (scope.visibleInstances < scope.currentInstances) {
            const visibleRatio =
              scope.visibleInstances / scope.currentInstances;
            const scoreInputs: Action["scoreInputs"] = {
              ...action.scoreInputs,
              urlReach: Math.max(
                0,
                Math.min(1, action.scoreInputs.urlReach * visibleRatio),
              ),
            };
            const count = scope.visibleInstances;
            return [
              {
                ...action,
                affectedUrls: scope.visibleUrls,
                whyNow: action.whyNow.replace(
                  /^\d+ affected URLs?\./u,
                  `${count} affected URL${count === 1 ? "" : "s"}.`,
                ),
                priorityScore: priorityScoreV1FromInputs(
                  scoreInputs,
                  action.effort,
                ),
                scoreInputs,
              },
            ];
          }
          return [action];
        }
        if (
          action.issueFingerprint &&
          this.database.hasIssueAdjudication(
            action.projectId,
            action.issueFingerprint,
          )
        ) {
          return [];
        }
        return [action];
      })
      .sort(
        (left, right) =>
          right.priorityScore - left.priorityScore ||
          right.updatedAt.localeCompare(left.updatedAt),
      );
  }

  private latestFullAudit(
    projectId: string,
    statuses: ReadonlySet<Run["status"]>,
    actionId?: string,
  ): Run | null {
    const isEligible = (run: Run): boolean => {
      if (run.workflowId !== "audit" || !statuses.has(run.status)) return false;
      const options = this.database.getRunOptions(run.id);
      return !(
        options.verificationActionId ||
        options.verificationId ||
        options.technicalOnly === true
      );
    };
    const latest = this.database.listRuns(projectId).find(isEligible);
    if (latest) return latest;
    if (!actionId) return null;
    const checkpoint = this.database.latestActionCheckpoint(actionId);
    if (!checkpoint) return null;
    const baseline = this.database.getRun(checkpoint.baselineRunId);
    return baseline && isEligible(baseline) ? baseline : null;
  }

  private async buildActionEvidence(
    actionId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<ActionEvidenceWorkspace | null> {
    const action = this.database.getAction(actionId);
    if (!action) return null;
    const { limit, offset } = actionEvidencePage(options);
    const links = this.database.listActionIssueLinks(actionId);
    const projectRuns = this.database.listRuns(action.projectId);
    const runRank = new Map(
      projectRuns.map((run, index) => [run.id, index] as const),
    );
    const latestAudit = this.latestFullAudit(
      action.projectId,
      new Set<Run["status"]>(["succeeded", "partial"]),
      actionId,
    );
    const crawlPages = latestAudit
      ? this.database.listPages(latestAudit.id)
      : [];
    const performanceRows = latestAudit
      ? this.database.listPagePerformance(latestAudit.id, "current")
      : [];
    const performanceWindows = latestAudit
      ? this.database.listPerformanceWindows(latestAudit.id)
      : [];
    const canonical = (value: string | null | undefined): string | null =>
      canonicalizeIssueUrl(value);
    const allUrls = [
      ...new Set(
        [
          ...action.affectedUrls,
          ...links.map((link) => link.issue.canonicalUrl),
        ]
          .map(canonical)
          .filter((url): url is string => url !== null),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const crawlByUrl = new Map(
      crawlPages.flatMap((page) => {
        const url = canonical(page.canonicalUrl);
        return url ? [[url, page] as const] : [];
      }),
    );
    const performanceByUrl = new Map(
      performanceRows.flatMap((row) => {
        const url = canonical(row.canonicalUrl);
        return url ? [[url, row] as const] : [];
      }),
    );
    const linksByUrl = new Map<string, typeof links>();
    for (const link of links) {
      const url = canonical(link.issue.canonicalUrl);
      if (!url) continue;
      const entries = linksByUrl.get(url) ?? [];
      entries.push(link);
      linksByUrl.set(url, entries);
    }
    for (const entries of linksByUrl.values()) {
      entries.sort(
        (left, right) =>
          (runRank.get(left.runId) ?? Number.MAX_SAFE_INTEGER) -
            (runRank.get(right.runId) ?? Number.MAX_SAFE_INTEGER) ||
          right.observedAt.localeCompare(left.observedAt),
      );
    }
    const gscWindow = performanceWindows.find(
      (window) => window.source === "gsc" && window.period === "current",
    );
    const ga4Window = performanceWindows.find(
      (window) => window.source === "ga4" && window.period === "current",
    );
    const usableWindow = (
      window: PerformanceWindowRecord | undefined,
    ): window is PerformanceWindowRecord =>
      window?.state === "available" || window?.state === "partial";
    const gscAvailable = usableWindow(gscWindow);
    const ga4Available = usableWindow(ga4Window);
    const currentRows = allUrls
      .map((url) => performanceByUrl.get(url))
      .filter((row): row is PagePerformanceRecord => row !== undefined);
    const clicks = gscAvailable
      ? currentRows.reduce((total, row) => total + (row.clicks ?? 0), 0)
      : null;
    const impressions = gscAvailable
      ? currentRows.reduce((total, row) => total + (row.impressions ?? 0), 0)
      : null;
    const keyEvents = ga4Available
      ? currentRows.reduce((total, row) => total + (row.keyEvents ?? 0), 0)
      : null;

    const lifecycleCounts = {
      new: 0,
      persistent: 0,
      resolved: 0,
      reappeared: 0,
    };
    for (const link of links) lifecycleCounts[link.lifecycle] += 1;

    const historyGroups = new Map<
      string,
      { observedAt: string; links: typeof links }
    >();
    for (const link of links) {
      const group = historyGroups.get(link.runId) ?? {
        observedAt: link.observedAt,
        links: [],
      };
      if (link.observedAt > group.observedAt)
        group.observedAt = link.observedAt;
      group.links.push(link);
      historyGroups.set(link.runId, group);
    }
    const history = [...historyGroups.entries()]
      .map(([runId, group]) => {
        const status = group.links.some(
          (link) => link.lifecycle === "reappeared",
        )
          ? ("reappeared" as const)
          : group.links.every((link) => link.lifecycle === "resolved")
            ? ("resolved" as const)
            : ("present" as const);
        const occurrences = new Set(
          group.links.map(
            (link) => canonical(link.issue.canonicalUrl) ?? link.fingerprint,
          ),
        );
        return {
          runId,
          observedAt: group.observedAt,
          status,
          affectedCount: occurrences.size,
        };
      })
      .sort(
        (left, right) =>
          (runRank.get(left.runId) ?? Number.MAX_SAFE_INTEGER) -
            (runRank.get(right.runId) ?? Number.MAX_SAFE_INTEGER) ||
          right.observedAt.localeCompare(left.observedAt),
      );

    const toNumberOrNull = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null;
    const evidenceUrls = allUrls.map<ActionEvidenceWorkspace["urls"][number]>(
      (url) => {
        const page = crawlByUrl.get(url);
        const performance = performanceByUrl.get(url);
        const urlLinks = linksByUrl.get(url) ?? [];
        const latestLink = urlLinks[0];
        const issue = latestLink
          ? {
              ...latestLink.issue,
              status:
                latestLink.lifecycle === "resolved"
                  ? ("resolved" as const)
                  : latestLink.issue.status,
            }
          : null;
        const vitals =
          page?.payload.vitals && typeof page.payload.vitals === "object"
            ? (page.payload.vitals as Record<string, unknown>)
            : null;
        const lcp = toNumberOrNull(vitals?.lcp);
        const cls = toNumberOrNull(vitals?.cls);
        const ttfb = toNumberOrNull(vitals?.ttfb);
        const hasCwv = lcp !== null || cls !== null || ttfb !== null;
        const hasGsc =
          gscAvailable &&
          performance?.clicks !== null &&
          performance?.clicks !== undefined &&
          performance.impressions !== null &&
          performance.ctr !== null &&
          performance.position !== null;
        const hasGa4 =
          ga4Available &&
          performance?.sessions !== null &&
          performance?.sessions !== undefined &&
          performance.keyEvents !== null;
        return {
          url,
          title: page?.title ?? null,
          statusCode: page?.statusCode ?? null,
          indexable: page?.indexable ?? null,
          lifecycle: latestLink?.lifecycle ?? "new",
          issue,
          gsc: hasGsc
            ? {
                clicks: performance.clicks!,
                impressions: performance.impressions!,
                ctr: performance.ctr!,
                position: performance.position!,
                state: performanceMetricState(gscWindow.state),
                period: {
                  start: gscWindow.startDate,
                  end: gscWindow.endDate,
                },
              }
            : null,
          ga4: hasGa4
            ? {
                sessions: performance.sessions!,
                keyEvents: performance.keyEvents!,
                state: performanceMetricState(ga4Window.state),
                period: {
                  start: ga4Window.startDate,
                  end: ga4Window.endDate,
                },
              }
            : null,
          cwv: vitals
            ? {
                lcp,
                cls,
                ttfb,
                state: hasCwv ? "available" : "unavailable",
              }
            : null,
        };
      },
    );

    const crawlMatched = allUrls.filter((url) => crawlByUrl.has(url)).length;
    const crawlSource: MetricValue = latestAudit
      ? {
          value: crawlMatched,
          state: latestAudit.status === "partial" ? "stale" : "available",
          source: "crawl",
          observedAt: latestAudit.completedAt ?? latestAudit.requestedAt,
          coverage: allUrls.length === 0 ? null : crawlMatched / allUrls.length,
          note:
            latestAudit.status === "partial"
              ? "The latest audit completed with partial coverage."
              : "Coverage is measured against the action's complete URL cohort.",
        }
      : unavailable("crawl", "No completed audit evidence is available.");
    const sourceMetric = (
      window: PerformanceWindowRecord | undefined,
      source: string,
      value: number | null,
    ): MetricValue =>
      window
        ? {
            value: usableWindow(window) ? value : null,
            state: performanceMetricState(window.state),
            source,
            observedAt: window.fetchedAt,
            coverage: window.coverage,
            ...(window.note ? { note: window.note } : {}),
          }
        : unavailable(
            source,
            `No ${source === "google-search-console" ? "Search Console" : "GA4"} snapshot is available.`,
          );

    const checkpoint = this.database.latestActionCheckpoint(actionId);
    const latestVerification = this.database.latestActionVerification(actionId);
    const checkpointState = checkpoint?.state;
    const fallbackVerificationState =
      checkpointState === "verification_queued"
        ? ("queued" as const)
        : checkpointState === "technically_verified"
          ? ("verified" as const)
          : checkpointState === "regressed"
            ? ("regressed" as const)
            : checkpointState === "inconclusive"
              ? ("inconclusive" as const)
              : ("not_started" as const);
    const verification = latestVerification
      ? {
          state: latestVerification.state,
          checkpointId: latestVerification.checkpointId,
          runId: latestVerification.runId,
          coverage: latestVerification.coverage,
          checkedAt: latestVerification.checkedAt,
          reason: latestVerification.reason,
        }
      : {
          state: fallbackVerificationState,
          checkpointId: checkpoint?.id ?? null,
          runId: null,
          coverage: null,
          checkedAt: null,
          reason: null,
        };
    const outcomes = checkpoint
      ? this.database.listActionObservations(checkpoint.id)
      : [];
    const pageEnd = Math.min(allUrls.length, offset + limit);

    return {
      action,
      summary: {
        totalUrls: allUrls.length,
        issueOccurrences: links.length,
        newOccurrences: lifecycleCounts.new,
        persistentOccurrences: lifecycleCounts.persistent,
        resolvedOccurrences: lifecycleCounts.resolved,
        reappearedOccurrences: lifecycleCounts.reappeared,
        clicks,
        impressions,
        keyEvents,
      },
      urls: evidenceUrls.slice(offset, pageEnd),
      history,
      sources: [
        crawlSource,
        sourceMetric(gscWindow, "google-search-console", clicks),
        sourceMetric(ga4Window, "google-analytics-4", keyEvents),
      ],
      verification,
      outcomes,
      pageInfo: {
        nextCursor:
          pageEnd < allUrls.length ? actionEvidenceCursor(pageEnd) : null,
        total: allUrls.length,
      },
    };
  }

  private async createActionCheckpoint(
    actionId: string,
  ): Promise<ActionCheckpoint | null> {
    const action = this.database.getAction(actionId);
    if (!action) return null;
    const baseline = this.latestFullAudit(
      action.projectId,
      new Set<Run["status"]>(["succeeded"]),
      actionId,
    );
    if (!baseline) throw new ActionCheckpointError();
    const currentPerformance = this.database.listPagePerformance(
      baseline.id,
      "current",
    );
    const cohort = selectMatchedControlCohort(
      action.affectedUrls,
      currentPerformance.map((page) => ({
        url: page.canonicalUrl,
        clicks: page.clicks,
        impressions: page.impressions,
        keyEvents: page.keyEvents,
      })),
    );
    const targetSet = new Set(cohort.targetUrls);
    const controlSet = new Set(cohort.controlUrls);
    const crawlPages = this.database.listPages(baseline.id);
    const baselineLinks = this.database
      .listActionIssueLinks(actionId)
      .filter((link) => link.runId === baseline.id);
    const checkpoint = this.database.createActionCheckpoint({
      actionId,
      projectId: action.projectId,
      baselineRunId: baseline.id,
      baselineSnapshot: {
        schemaVersion: "action-checkpoint-v1",
        capturedAt: new Date().toISOString(),
        action,
        run: baseline,
        windows: this.database.listPerformanceWindows(baseline.id),
        target: {
          urls: cohort.targetUrls,
          performance: currentPerformance.filter((page) =>
            targetSet.has(page.canonicalUrl),
          ),
          crawl: crawlPages.filter((page) => targetSet.has(page.canonicalUrl)),
          issues: baselineLinks.filter(
            (link) =>
              link.issue.canonicalUrl !== null &&
              targetSet.has(link.issue.canonicalUrl),
          ),
        },
        control: {
          urls: cohort.controlUrls,
          performance: currentPerformance.filter((page) =>
            controlSet.has(page.canonicalUrl),
          ),
          crawl: crawlPages.filter((page) => controlSet.has(page.canonicalUrl)),
        },
        cohort,
      },
      targetUrls: cohort.targetUrls,
      controlUrls: cohort.controlUrls,
      cohortMatching: {
        method: "path-and-demand-v1",
        baselineRunId: baseline.id,
        coverage: cohort.coverage,
        matches: cohort.matches,
        limitations: cohort.limitations,
      },
    });
    return publicCheckpoint(checkpoint);
  }

  private async actionOutcomes(
    actionId: string,
  ): Promise<ActionOutcomeObservation[]> {
    if (!this.database.getAction(actionId)) return [];
    const checkpoint = this.database.latestActionCheckpoint(actionId);
    return checkpoint
      ? this.database.listActionObservations(checkpoint.id)
      : [];
  }

  readonly integrations = {
    list: async (projectId?: string): Promise<Integration[]> => {
      const stored = new Map(
        this.database
          .listIntegrations()
          .map((integration) => [integration.provider, integration]),
      );
      return connectorManifests.map((manifest) => {
        const base = stored.get(manifest.id) ?? {
          provider: manifest.id,
          label: manifest.label,
          status: "not_configured" as const,
          maskedIdentifier: null,
          scopes: [...manifest.auth.scopes],
          lastSyncAt: null,
          nextSyncAt: null,
          expiresAt: null,
          quota: null,
        };
        const configuration = projectId
          ? this.database.getProjectIntegrationConfiguration(
              projectId,
              manifest.id,
            )
          : null;
        return configuration ? { ...base, configuration } : base;
      });
    },
    saveSecret: async (
      provider: string,
      account: string,
      kind: string,
      secret: Uint8Array,
    ): Promise<Integration> => {
      const manifest = getConnectorManifest(provider);
      if (!manifest) throw new Error("Unknown integration provider");
      const ref: CredentialRef = { provider, account, kind };
      return this.replaceCredential(provider, ref, secret, () => {
        const current = this.database
          .listIntegrations()
          .find((candidate) => candidate.provider === provider);
        const integration: Integration = {
          provider,
          label: manifest.label,
          // Stored is not the same as verified. The explicit provider probe
          // is the only path that promotes an API credential to connected.
          status: "degraded",
          secretRef: `${provider}/${account}/${kind}`,
          maskedIdentifier: integrationIdentifier(provider, account, secret),
          scopes: [...manifest.auth.scopes],
          lastSyncAt: null,
          nextSyncAt: null,
          expiresAt: null,
          quota: null,
          ...(current?.configuration
            ? { configuration: current.configuration }
            : {}),
        };
        this.database.upsertIntegration(integration);
        return integration;
      });
    },
    completeOAuth: async (
      provider: string,
      account: string,
      tokenSet: GoogleOAuthTokenSet,
    ): Promise<Integration> => {
      const manifest = getConnectorManifest(provider);
      if (
        !manifest ||
        manifest.auth.type !== "oauth-pkce" ||
        tokenSet.provider !== provider
      ) {
        throw new Error("Unknown OAuth integration provider");
      }
      const expiresAtEpochMs = Date.parse(tokenSet.expiresAt);
      if (!Number.isFinite(expiresAtEpochMs))
        throw new Error("OAuth token expiry is invalid");
      const ref = oauthCredentialRef(provider, account);
      const stored: StoredOAuthCredential = {
        version: 1,
        provider,
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        tokenType: tokenSet.tokenType,
        expiresAt: new Date(expiresAtEpochMs).toISOString(),
        scopes: [...tokenSet.scopes],
      };
      const encoded = encodeOAuthCredential(stored);
      try {
        return await this.replaceCredential(provider, ref, encoded, () => {
          const current = this.database
            .listIntegrations()
            .find((candidate) => candidate.provider === provider);
          const integration: Integration = {
            provider,
            label: manifest.label,
            status: expiresAtEpochMs <= Date.now() ? "expired" : "connected",
            secretRef: `${provider}/${ref.account}/${ref.kind}`,
            // Never derive this field from access/refresh token material.
            maskedIdentifier: "Google OAuth",
            scopes: [...stored.scopes],
            lastSyncAt: null,
            nextSyncAt: null,
            expiresAt: stored.expiresAt,
            quota: null,
            ...(current?.configuration
              ? { configuration: current.configuration }
              : {}),
          };
          this.database.upsertIntegration(integration);
          return integration;
        });
      } finally {
        encoded.fill(0);
      }
    },
    configure: async (
      provider: string,
      projectId: string,
      configuration: Record<string, unknown>,
    ): Promise<Integration> => {
      const manifest = getConnectorManifest(provider);
      if (!manifest) throw new Error("Unknown integration provider");
      if (!this.database.getProject(projectId))
        throw new Error("Project not found");
      if (!validateConnectorConfiguration(provider, configuration)) {
        throw new Error("Integration configuration is invalid");
      }
      this.database.setProjectIntegrationConfiguration(
        projectId,
        provider,
        structuredClone(configuration),
      );
      const integration = (await this.integrations.list(projectId)).find(
        (candidate) => candidate.provider === provider,
      );
      if (!integration) throw new Error("Unknown integration provider");
      return integration;
    },
    test: async (
      provider: string,
      projectId?: string,
    ): Promise<Integration> => {
      const manifest = getConnectorManifest(provider);
      if (!manifest) throw new Error("Unknown integration provider");
      const project = projectId ? this.database.getProject(projectId) : null;
      if (projectId && !project) throw new Error("Project not found");
      const integration = (await this.integrations.list(projectId)).find(
        (candidate) => candidate.provider === provider,
      );
      if (!integration) throw new Error("Unknown integration provider");

      let health: ConnectorHealth;
      try {
        const credentials = await this.readConnectorCredentials(
          provider as ConnectorId,
          integration,
        );
        health = await checkConnectorHealth({
          provider: provider as ConnectorId,
          ...(credentials ? { credentials } : {}),
          ...(integration.configuration
            ? { configuration: integration.configuration }
            : {}),
          ...(project ? { targetUrl: project.canonicalUrl } : {}),
          ...(this.integrationFetch
            ? { fetchImpl: this.integrationFetch }
            : {}),
        });
      } catch {
        const latest = this.database
          .listIntegrations()
          .find((candidate) => candidate.provider === provider);
        health = {
          status: latest?.status === "expired" ? "expired" : "failed",
          checkedAt: new Date().toISOString(),
          message: "The local credential could not be read or refreshed.",
        };
      }

      const stored = this.database
        .listIntegrations()
        .find((candidate) => candidate.provider === provider);
      const next: Integration = {
        ...(stored ?? integration),
        status: health.status,
        lastSyncAt:
          health.status === "connected"
            ? health.checkedAt
            : (stored ?? integration).lastSyncAt,
        nextSyncAt:
          health.status === "rate_limited"
            ? (health.resetsAt ?? (stored ?? integration).nextSyncAt)
            : null,
        quota:
          health.remainingQuota === undefined
            ? (stored ?? integration).quota
            : {
                remaining: health.remainingQuota,
                limit: (stored ?? integration).quota?.limit ?? null,
                resetsAt: health.resetsAt ?? null,
              },
        ...(integration.configuration
          ? { configuration: integration.configuration }
          : {}),
      };
      const { configuration: _projectConfiguration, ...globalNext } = next;
      this.database.upsertIntegration({
        ...globalNext,
        // Project-specific configuration belongs in its own table and must
        // never bleed into another project's global connector record.
        ...(stored?.configuration
          ? { configuration: stored.configuration }
          : {}),
      });
      return next;
    },
    remove: async (provider: string): Promise<boolean> => {
      const integration = this.database
        .listIntegrations()
        .find((candidate) => candidate.provider === provider);
      if (integration?.secretRef) {
        const [savedProvider, account, kind] = integration.secretRef.split("/");
        if (savedProvider && account && kind)
          await this.credentialStore.delete({
            provider: savedProvider,
            account,
            kind,
          });
      }
      return this.database.deleteIntegration(provider);
    },
  };

  readonly schedules = {
    list: async (projectId?: string) => this.database.listSchedules(projectId),
    create: async (input: Omit<Schedule, "id" | "createdAt" | "updatedAt">) => {
      if (!this.database.getProject(input.projectId))
        throw new Error("Project not found");
      validateScheduleDefinition(input.cron, input.timezone, input.nextRunAt);
      return this.database.createSchedule(input);
    },
    update: async (
      id: string,
      input: Partial<
        Pick<Schedule, "cron" | "timezone" | "enabled" | "nextRunAt">
      >,
    ) => {
      const current = this.database
        .listSchedules()
        .find((schedule) => schedule.id === id);
      if (!current) return null;
      const next = { ...current, ...input };
      validateScheduleDefinition(next.cron, next.timezone, next.nextRunAt);
      return this.database.updateSchedule(id, input);
    },
    remove: async (id: string) => this.database.deleteSchedule(id),
  };

  readonly reports = {
    get: async (
      runId: string,
      format: "html" | "pdf" | "csv" | "json",
    ): Promise<Uint8Array | null> => {
      const artifact = this.database.getArtifact(runId, `report.${format}`);
      if (!artifact) return null;
      try {
        return new Uint8Array(readFileSync(artifact.path));
      } catch {
        return null;
      }
    },
  };

  readonly system = {
    health: async () => {
      const queued = this.database.listJobs("queued").length;
      const leased = this.database.listJobs("leased").length;
      const deadLetter = this.database.listJobs("dead_letter").length;
      return {
        status:
          deadLetter > 0 || this.deletionCleanupPending
            ? ("degraded" as const)
            : ("ok" as const),
        database: this.deletionCleanupPending
          ? "connected; project deletion cleanup pending"
          : "connected",
        queue: `${leased} running; ${queued} queued; ${deadLetter} dead-letter`,
        version: this.version,
      };
    },
    capabilities: async (): Promise<Capabilities> => ({
      edition: "community",
      version: this.version,
      apiVersion: "v1",
      telemetry: "disabled_by_default",
      limits: { projects: null, audits: null },
      features: [
        "static-crawl",
        "javascript-crawl",
        "technical-seo",
        "content-checks",
        "link-checks",
        "audit-evidence-workbench",
        "audit-replay",
        "audit-comparison",
        "internal-link-explorer",
        "project-extraction-rules",
        "extraction-preview",
        "lighthouse",
        "pagespeed-insights-byok",
        "core-web-vitals",
        "gsc-byok",
        "ga4-byok",
        "trends",
        "serpapi-byok",
        "dataforseo-byok",
        "actions",
        "comparisons",
        "reports",
        "schedules",
        "project-export",
        "project-import",
        "project-deletion",
        "database-backup-restore",
        "custom-rules",
        "rest",
        "cli",
        "mcp",
        "codex",
        "openclaw",
      ],
      hosted: {
        available: false,
        url: "urn:agentseo:hosted-unavailable",
        message: "AGENTseo is local-first; no hosted service is configured.",
      },
    }),
  };

  constructor(options: LocalRuntimeOptions = {}) {
    this.dataDir = options.dataDir ?? defaultDataDirectory();
    mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    try {
      chmodSync(this.dataDir, 0o700);
    } catch {
      /* platform ACL may own this */
    }
    this.database = new AgentSeoDatabase({
      path: join(this.dataDir, "agentseo.db"),
    });
    this.recoverDeletionStaging();
    this.credentialStore =
      options.credentialStore ?? new MemoryCredentialStore();
    this.engine = options.engine;
    this.version = options.version ?? "1.0.0";
    this.googleDesktopClientId = resolveGoogleDesktopClientId(
      options.googleDesktopClientId,
    );
    this.oauthFetch = options.oauthFetch;
    this.integrationFetch = options.integrationFetch;
    this.database.recoverInterruptedRuns();
    const handlers = new Map<string, DurableJobHandler>([
      [
        "run.execute",
        async (payload, job) => {
          const runId =
            typeof payload.runId === "string" ? payload.runId : job.runId;
          if (!runId) throw new Error("run.execute job is missing runId");
          const run = this.database.getRun(runId);
          if (!run || run.status === "cancelled") return;
          await this.executeRun(runId, {
            projectId: run.projectId,
            workflowId: run.workflowId as StartRunInput["workflowId"],
            options: this.database.getRunOptions(runId),
          });
          const completed = this.database.getRun(runId);
          if (completed?.status === "failed") {
            if (job.attempts < job.maxAttempts) {
              this.database.updateRun(runId, {
                status: "queued",
                completedAt: null,
                progress: 0,
              });
              this.emitRun(runId, "run.retry_scheduled", {
                attempt: job.attempts,
                maxAttempts: job.maxAttempts,
              });
            }
            throw new Error(completed.error ?? "Run failed");
          }
        },
      ],
    ]);
    this.jobWorker = new DurableJobWorker({
      database: this.database,
      handlers,
      concurrency: 2,
    });
    this.scheduler = new DurableScheduler({
      database: this.database,
      startRun: (input, idempotencyKey) =>
        this.runs.start(input, idempotencyKey),
    });
    this.resumeQueuedRuns();
    this.jobWorker.start();
    this.scheduler.start();
  }

  private emitRun(
    runId: string,
    type: string,
    payload: Record<string, unknown> = {},
    exactValues: Iterable<string> = [],
  ): RunEvent {
    const event = this.database.appendRunEvent(
      runId,
      type,
      redactedRuntimeValue(payload, exactValues),
    );
    this.events.emit(`run:${runId}`, event);
    this.events.emit("run", event);
    return event;
  }

  private async loadEngine(): Promise<EngineModule> {
    if (!this.engine)
      this.engine =
        (await import("@agentseoapp/core")) as unknown as EngineModule;
    return this.engine;
  }

  private credentialReference(
    secretRef: string | undefined,
    expectedProvider: string,
  ): CredentialRef | null {
    if (!secretRef) return null;
    const [provider, account, kind, ...extra] = secretRef.split("/");
    if (
      extra.length > 0 ||
      provider !== expectedProvider ||
      !account ||
      !kind
    ) {
      return null;
    }
    return { provider, account, kind };
  }

  /**
   * Replaces a vault entry without leaving the previous account credential
   * orphaned. The old bytes are held only long enough to roll back a failed
   * vault or SQLite mutation and are zeroed on every exit path.
   */
  private async replaceCredential(
    provider: string,
    nextRef: CredentialRef,
    secret: Uint8Array,
    persist: () => Integration,
  ): Promise<Integration> {
    const previous = this.database
      .listIntegrations()
      .find((candidate) => candidate.provider === provider);
    const previousRef = this.credentialReference(previous?.secretRef, provider);
    const previousBytes = previousRef
      ? await this.credentialStore.get(previousRef)
      : null;
    const sameRef =
      previousRef?.provider === nextRef.provider &&
      previousRef.account === nextRef.account &&
      previousRef.kind === nextRef.kind;
    let wroteNext = false;
    try {
      await this.credentialStore.put(nextRef, secret);
      wroteNext = true;
      if (previousRef && !sameRef) {
        await this.credentialStore.delete(previousRef);
      }
      return persist();
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      if (wroteNext) {
        try {
          await this.credentialStore.delete(nextRef);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (previousRef && previousBytes) {
        try {
          await this.credentialStore.put(previousRef, previousBytes);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          "Credential rotation failed and the vault rollback was incomplete",
        );
      }
      throw error;
    } finally {
      previousBytes?.fill(0);
    }
  }

  private async readConnectorCredentials(
    provider: ConnectorId,
    integration: Integration,
  ): Promise<Record<string, unknown> | undefined> {
    if (
      provider === "google-search-console" ||
      provider === "google-analytics-4"
    ) {
      if (!integration.secretRef) return undefined;
      return this.readOrRefreshGoogleCredential(
        provider,
        integration.secretRef,
      );
    }
    const ref = this.credentialReference(integration.secretRef, provider);
    if (!ref) return undefined;
    const bytes = await this.credentialStore.get(ref);
    if (!bytes) throw new Error("Connector credential is missing");
    try {
      const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Connector credential payload is invalid");
      }
      return parsed as Record<string, unknown>;
    } finally {
      bytes.fill(0);
    }
  }

  private googleTokenManager(
    provider: "google-search-console" | "google-analytics-4",
    exactValues: Set<string>,
  ):
    | { refresh(): Promise<Pick<StoredOAuthCredential, "accessToken">> }
    | undefined {
    const integration = this.database
      .listIntegrations()
      .find((candidate) => candidate.provider === provider);
    if (!integration?.secretRef) return undefined;
    const secretRef = integration.secretRef;
    return {
      refresh: async () => {
        const credential = await this.readOrRefreshGoogleCredential(
          provider,
          secretRef,
        );
        exactValues.add(credential.accessToken);
        return credential;
      },
    };
  }

  private async readOrRefreshGoogleCredential(
    provider: "google-search-console" | "google-analytics-4",
    secretRef: string,
  ): Promise<Pick<StoredOAuthCredential, "accessToken">> {
    const existing = this.tokenRefreshes.get(provider);
    if (existing) return existing;
    const operation = (async () => {
      const [savedProvider, account, kind, ...extra] = secretRef.split("/");
      if (
        extra.length ||
        savedProvider !== provider ||
        !account ||
        kind !== "oauth"
      ) {
        throw new Error(`Stored ${provider} credential reference is invalid`);
      }
      const ref: CredentialRef = { provider, account, kind };
      const bytes = await this.credentialStore.get(ref);
      if (!bytes)
        throw new Error(
          `${provider} credential is missing from the local vault`,
        );
      let credential: StoredOAuthCredential;
      try {
        credential = decodeOAuthCredential(bytes);
      } finally {
        bytes.fill(0);
      }
      if (credential.provider !== provider)
        throw new Error(`Stored ${provider} credential payload is invalid`);
      if (Date.parse(credential.expiresAt) - Date.now() > 5 * 60_000) {
        return { accessToken: credential.accessToken };
      }
      if (!this.googleDesktopClientId) {
        this.updateIntegrationStatus(provider, "expired", credential.expiresAt);
        throw new Error(
          "Google OAuth token expired; configure the public desktop client ID and reconnect",
        );
      }
      try {
        const refreshed = await refreshGoogleOAuthToken({
          provider,
          clientId: this.googleDesktopClientId,
          refreshToken: credential.refreshToken,
          scopes: credential.scopes,
          ...(this.oauthFetch ? { fetchImpl: this.oauthFetch } : {}),
        });
        const next: StoredOAuthCredential = {
          version: 1,
          provider,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenType: refreshed.tokenType,
          expiresAt: refreshed.expiresAt,
          scopes: [...refreshed.scopes],
        };
        const encoded = encodeOAuthCredential(next);
        try {
          await this.credentialStore.put(ref, encoded);
        } finally {
          encoded.fill(0);
        }
        this.updateIntegrationStatus(
          provider,
          "connected",
          next.expiresAt,
          next.scopes,
        );
        return { accessToken: next.accessToken };
      } catch (error) {
        this.updateIntegrationStatus(provider, "expired", credential.expiresAt);
        throw error;
      }
    })().finally(() => this.tokenRefreshes.delete(provider));
    this.tokenRefreshes.set(provider, operation);
    return operation;
  }

  private updateIntegrationStatus(
    provider: string,
    status: Integration["status"],
    expiresAt: string | null,
    scopes?: string[],
  ): void {
    const integration = this.database
      .listIntegrations()
      .find((candidate) => candidate.provider === provider);
    if (!integration) return;
    this.database.upsertIntegration({
      ...integration,
      status,
      expiresAt,
      ...(scopes ? { scopes } : {}),
    });
  }

  private deletionMoves(
    projectId: string,
    runIds: readonly string[],
    stagingRoot: string,
  ): Array<{ source: string; destination: string }> {
    return [
      ...runIds.map((runId) => ({
        source: join(this.dataDir, "artifacts", runId),
        destination: join(stagingRoot, "artifacts", "runs", runId),
      })),
      {
        source: join(this.dataDir, "artifacts", "imported", projectId),
        destination: join(stagingRoot, "artifacts", "imported"),
      },
      {
        source: join(this.dataDir, "projects", projectId),
        destination: join(stagingRoot, "project"),
      },
    ];
  }

  private readDeletionManifest(stagingRoot: string): {
    version: 1;
    projectId: string;
    runIds: string[];
  } {
    const parsed = JSON.parse(
      readFileSync(join(stagingRoot, "manifest.json"), "utf8"),
    ) as unknown;
    const safeSegment = (value: unknown): value is string =>
      typeof value === "string" &&
      value.length >= 1 &&
      value.length <= 160 &&
      !value.includes("..") &&
      !value.includes("/") &&
      !value.includes("\\");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { version?: unknown }).version !== 1 ||
      !safeSegment((parsed as { projectId?: unknown }).projectId) ||
      !Array.isArray((parsed as { runIds?: unknown }).runIds) ||
      !(parsed as { runIds: unknown[] }).runIds.every(safeSegment) ||
      new Set((parsed as { runIds: string[] }).runIds).size !==
        (parsed as { runIds: string[] }).runIds.length
    ) {
      throw new Error("Invalid project deletion recovery manifest");
    }
    return parsed as { version: 1; projectId: string; runIds: string[] };
  }

  private recoverDeletionStaging(): void {
    const stagingBase = join(this.dataDir, ".deletion-staging");
    if (!existsSync(stagingBase)) {
      this.deletionCleanupPending = false;
      return;
    }
    let pending = false;
    let entries;
    try {
      entries = readdirSync(stagingBase, { withFileTypes: true });
    } catch {
      this.deletionCleanupPending = true;
      return;
    }
    for (const entry of entries) {
      const stagingRoot = join(stagingBase, entry.name);
      if (!entry.isDirectory()) {
        pending = true;
        continue;
      }
      try {
        const stagedEntries = readdirSync(stagingRoot);
        if (
          !stagedEntries.includes("manifest.json") &&
          stagedEntries.length === 1 &&
          stagedEntries[0] === "manifest.json.tmp"
        ) {
          // Files are moved only after the atomically renamed manifest exists.
          rmSync(stagingRoot, { recursive: true, force: true });
          continue;
        }
        const manifest = this.readDeletionManifest(stagingRoot);
        if (this.database.getProject(manifest.projectId)) {
          const moves = this.deletionMoves(
            manifest.projectId,
            manifest.runIds,
            stagingRoot,
          );
          for (const move of [...moves].reverse()) {
            if (!existsSync(move.destination)) continue;
            if (existsSync(move.source)) {
              throw new Error(
                "Project deletion recovery found both staged and live files",
              );
            }
            mkdirSync(dirname(move.source), { recursive: true, mode: 0o700 });
            renameSync(move.destination, move.source);
          }
        }
        rmSync(stagingRoot, { recursive: true, force: true });
      } catch {
        pending = true;
      }
    }
    try {
      if (readdirSync(stagingBase).length === 0) {
        rmSync(stagingBase, { recursive: true, force: true });
      }
    } catch {
      pending = true;
    }
    this.deletionCleanupPending = pending || existsSync(stagingBase);
  }

  private finalizeDeletionStaging(stagingRoot: string): boolean {
    const stagingBase = join(this.dataDir, ".deletion-staging");
    try {
      rmSync(stagingRoot, { recursive: true, force: true });
      if (existsSync(stagingBase) && readdirSync(stagingBase).length === 0) {
        rmSync(stagingBase, { recursive: true, force: true });
      }
      this.deletionCleanupPending = existsSync(stagingBase);
      return true;
    } catch {
      this.deletionCleanupPending = true;
      return false;
    }
  }

  private async deleteProject(
    input: DeleteProjectInput,
  ): Promise<ProjectDeletionReceipt> {
    const project = this.database.getProject(input.projectId);
    if (!project) {
      throw new ProjectDeletionError(
        "The project was not found.",
        "project_not_found",
        404,
      );
    }
    if (input.confirmation !== project.name) {
      throw new ProjectDeletionError(
        "The confirmation must exactly match the current project name.",
        "project_confirmation_mismatch",
        422,
      );
    }

    const runs = this.database.listAllRunsForProject(project.id);
    const activeRunIds = runs
      .filter(
        (run) =>
          !["succeeded", "partial", "failed", "cancelled"].includes(run.status),
      )
      .map((run) => run.id);
    for (const runId of activeRunIds) await this.runs.cancel(runId);
    const deadline = Date.now() + 5_000;
    while (activeRunIds.some((runId) => this.controllers.has(runId))) {
      if (Date.now() >= deadline) {
        throw new ProjectDeletionError(
          "An active project job did not stop in time. Retry deletion after the job finishes cancelling.",
          "project_busy",
          409,
        );
      }
      await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 25));
    }

    const deletionId = randomUUID();
    const stagingRoot = join(this.dataDir, ".deletion-staging", deletionId);
    const runIds = runs.map((run) => run.id);
    const moves = this.deletionMoves(project.id, runIds, stagingRoot);
    const staged: Array<{ source: string; destination: string }> = [];
    const rollback = (): unknown[] => {
      const errors: unknown[] = [];
      for (const move of [...staged].reverse()) {
        if (!existsSync(move.destination)) continue;
        try {
          mkdirSync(dirname(move.source), { recursive: true, mode: 0o700 });
          renameSync(move.destination, move.source);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length === 0) {
        try {
          rmSync(stagingRoot, { recursive: true, force: true });
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) this.deletionCleanupPending = true;
      return errors;
    };

    try {
      mkdirSync(stagingRoot, { recursive: true, mode: 0o700 });
      const manifestTemporary = join(stagingRoot, "manifest.json.tmp");
      writeFileSync(
        manifestTemporary,
        `${JSON.stringify({ version: 1, projectId: project.id, runIds })}\n`,
        { mode: 0o600, flag: "wx" },
      );
      renameSync(manifestTemporary, join(stagingRoot, "manifest.json"));
      for (const move of moves) {
        if (!existsSync(move.source)) continue;
        mkdirSync(dirname(move.destination), {
          recursive: true,
          mode: 0o700,
        });
        renameSync(move.source, move.destination);
        staged.push(move);
      }
    } catch (error) {
      const rollbackErrors = rollback();
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          "Project file staging failed and rollback was incomplete",
        );
      }
      throw error;
    }

    const deletedAt = new Date().toISOString();
    let counts;
    try {
      counts = this.database.deleteProject(project.id, deletedAt);
      if (!counts) {
        throw new ProjectDeletionError(
          "The project was not found.",
          "project_not_found",
          404,
        );
      }
    } catch (error) {
      const rollbackErrors = rollback();
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          "Project deletion failed and file rollback was incomplete",
        );
      }
      throw error;
    }

    return {
      projectId: project.id,
      deletedAt,
      counts,
      artifactCleanup: this.finalizeDeletionStaging(stagingRoot)
        ? "complete"
        : "scheduled",
      globalCredentialsRetained: true,
    };
  }

  private resumeQueuedRuns(): void {
    for (const run of this.database
      .listRuns()
      .filter((candidate) => candidate.status === "queued")) {
      if (this.database.activeJobForRun(run.id)) continue;
      this.database.enqueueJob({
        runId: run.id,
        type: "run.execute",
        payload: { runId: run.id },
        maxAttempts: 3,
      });
    }
  }

  private async executeRun(runId: string, input: StartRunInput): Promise<void> {
    if (this.controllers.has(runId)) return;
    const run = this.database.getRun(runId);
    const project = run ? this.database.getProject(run.projectId) : null;
    if (!run || !project || run.status === "cancelled") return;
    const controller = new AbortController();
    const exactSecretValues = new Set<string>();
    this.controllers.set(runId, controller);
    this.database.updateRun(runId, {
      status: "running",
      startedAt: new Date().toISOString(),
      progress: 0.01,
      error: null,
    });
    this.emitRun(runId, "run.started", { progress: 0.01 });
    try {
      const engine = await this.loadEngine();
      const projectRoot = join(this.dataDir, "projects", project.id);
      mkdirSync(projectRoot, { recursive: true, mode: 0o700 });
      const options =
        Object.keys(input.options ?? {}).length > 0
          ? input.options!
          : this.database.getRunOptions(runId);
      if (run.workflowId !== "audit") {
        await this.executeResearchWorkflow(
          run,
          project.canonicalUrl,
          projectRoot,
          options,
          engine,
          controller.signal,
          exactSecretValues,
        );
        return;
      }
      const pageSpeedIntegration = this.database
        .listIntegrations()
        .find((candidate) => candidate.provider === "pagespeed-insights");
      const gscConfiguration = this.database.getProjectIntegrationConfiguration(
        project.id,
        "google-search-console",
      );
      const ga4Configuration = this.database.getProjectIntegrationConfiguration(
        project.id,
        "google-analytics-4",
      );
      const pageSpeedConfiguration =
        this.database.getProjectIntegrationConfiguration(
          project.id,
          "pagespeed-insights",
        );
      const gscToken = this.googleTokenManager(
        "google-search-console",
        exactSecretValues,
      );
      const ga4Token = this.googleTokenManager(
        "google-analytics-4",
        exactSecretValues,
      );
      const configuredGscSite =
        typeof options.gscSiteUrl === "string"
          ? options.gscSiteUrl
          : typeof gscConfiguration?.siteUrl === "string"
            ? gscConfiguration.siteUrl
            : undefined;
      const configuredGa4Property =
        typeof options.ga4PropertyId === "string"
          ? options.ga4PropertyId
          : typeof ga4Configuration?.propertyId === "string"
            ? ga4Configuration.propertyId
            : undefined;
      let pageSpeedInsights:
        { apiKey?: string; strategy?: "mobile" | "desktop" } | undefined;
      const pageSpeedStrategy =
        options.psiStrategy === "desktop" || options.psiStrategy === "mobile"
          ? options.psiStrategy
          : pageSpeedConfiguration?.strategy === "desktop" ||
              pageSpeedConfiguration?.strategy === "mobile"
            ? pageSpeedConfiguration.strategy
            : undefined;
      if (pageSpeedConfiguration || pageSpeedStrategy) {
        pageSpeedInsights = {
          ...(pageSpeedStrategy ? { strategy: pageSpeedStrategy } : {}),
        };
      }
      if (pageSpeedIntegration?.secretRef) {
        try {
          const credentials = await this.readConnectorCredentials(
            "pagespeed-insights",
            pageSpeedIntegration,
          );
          const apiKey = credentials?.apiKey;
          if (typeof apiKey === "string" && apiKey.trim()) {
            exactSecretValues.add(apiKey);
            pageSpeedInsights = {
              apiKey,
              ...(pageSpeedStrategy ? { strategy: pageSpeedStrategy } : {}),
            };
          }
        } catch {
          // A broken optional connector must not turn the crawl into a false
          // failure. Its health remains visible in Integrations and the audit
          // proceeds without PageSpeed enrichment.
          this.updateIntegrationStatus(
            "pagespeed-insights",
            "failed",
            pageSpeedIntegration.expiresAt,
          );
        }
      }
      const allowedPrivateHosts = privateHostAllowlist(options);
      const exactUrls = exactAuditUrls(options, project.canonicalUrl);
      const extractionRevision = options.extractionRuleRevision;
      const extractionRuleSet =
        extractionRevision === null
          ? null
          : typeof extractionRevision === "number" &&
              Number.isSafeInteger(extractionRevision) &&
              extractionRevision > 0
            ? this.database.getExtractionRuleVersion(
                project.id,
                extractionRevision,
              )
            : this.database.getExtractionRuleWorkspace(project.id)?.current;
      if (
        extractionRevision !== undefined &&
        extractionRevision !== null &&
        (typeof extractionRevision !== "number" ||
          !Number.isSafeInteger(extractionRevision) ||
          extractionRevision <= 0 ||
          !extractionRuleSet)
      ) {
        throw new Error(
          `Extraction-rule revision ${String(extractionRevision)} is unavailable for this project.`,
        );
      }
      const extractors = (extractionRuleSet?.rules ?? [])
        .filter((rule) => rule.enabled)
        .map((rule) => ({
          label: rule.label,
          selector: rule.selector,
          type: rule.type,
          ...(rule.attribute !== null ? { attribute: rule.attribute } : {}),
          ...(rule.regex !== null ? { regex: rule.regex } : {}),
        }));
      const workflow = workflowById(this.workflows, run.workflowId);
      const auditModule: SeoModule<unknown, unknown> = {
        kind: "leaf",
        id: "core-audit",
        version: this.version,
        inputSchema: Type.Object({}, { additionalProperties: false }),
        outputSchema: workflow.outputSchema,
        requirements: [],
        run: async () => {
          const outcome = await engine.crawl({
            startUrl: project.canonicalUrl,
            projectRoot,
            renderMode: options.renderMode === "js" ? "js" : "static",
            collectVitals: options.collectVitals === true,
            lighthouse:
              typeof options.lighthouse === "string"
                ? options.lighthouse
                : "off",
            signal: controller.signal,
            privateHostAllowlist: allowedPrivateHosts,
            extractors,
            ...(exactUrls ? { exactUrls, seedUrls: exactUrls } : {}),
            ...(configuredGscSite ? { gscSiteUrl: configuredGscSite } : {}),
            ...(configuredGa4Property
              ? { ga4PropertyId: configuredGa4Property }
              : {}),
            ...(gscToken || ga4Token
              ? {
                  googleTokens: {
                    ...(gscToken ? { gsc: gscToken } : {}),
                    ...(ga4Token ? { ga4: ga4Token } : {}),
                  },
                }
              : {}),
            ...(pageSpeedInsights ? { pageSpeedInsights } : {}),
            ...(this.integrationFetch
              ? { providerFetch: this.integrationFetch }
              : {}),
            limits: {
              ...(typeof options.maxUrls === "number"
                ? { maxUrls: options.maxUrls }
                : {}),
              // The production runtime never honors the legacy global private
              // network flag. Private access exists only for exact hosts in
              // this run's explicit allowlist.
              allowPrivate: allowedPrivateHosts.length > 0,
            },
            onProgress: (progress: {
              crawled: number;
              queue: number;
              elapsedMs: number;
            }) => {
              if (controller.signal.aborted) return;
              const estimate = Math.min(
                0.9,
                Math.max(
                  0.02,
                  progress.crawled /
                    Math.max(1, progress.crawled + progress.queue),
                ),
              );
              this.database.updateRun(runId, { progress: estimate });
              this.emitRun(runId, "run.progress", {
                ...progress,
                progress: estimate,
              });
            },
          });
          return {
            ...outcome,
            coverage: auditReportState(outcome.report).coverage,
          } satisfies AuditEngineOutput;
        },
      };
      const leafRegistry = new Map([[auditModule.id, auditModule]]);
      const plan = createWorkflowPlan(workflow, { options }, leafRegistry);
      const [moduleExecution] = await executePlan(plan, leafRegistry, {
        concurrency: 1,
        runId,
        signal: controller.signal,
        onNodeStateChange: (state) =>
          this.database.upsertRunModule({
            runId,
            moduleId: state.moduleId,
            version: state.version ?? "unknown",
            status: state.status,
            startedAt: state.startedAt ?? null,
            completedAt: state.completedAt ?? null,
            durationMs: state.durationMs ?? null,
            coverage: state.coverage ?? null,
            error: redactedRuntimeText(
              state.error ?? state.skipReason,
              exactSecretValues,
            ),
          }),
      });
      if (
        !moduleExecution ||
        moduleExecution.status === "cancelled" ||
        controller.signal.aborted
      )
        return;
      if (moduleExecution.status !== "succeeded" || !moduleExecution.output) {
        throw new Error(
          moduleExecution.error ??
            moduleExecution.skipReason ??
            "The core audit module did not complete",
        );
      }
      if (
        controller.signal.aborted ||
        this.database.getRun(runId)?.status === "cancelled"
      )
        return;
      validateWorkflowOutput(workflow, moduleExecution.output);
      const result = moduleExecution.output as AuditEngineOutput;
      // Treat all engine output as tainted. Exact values cover credentials
      // exposed to this run; structural and pattern redaction covers nested
      // provider errors before they can reach SQLite or any report format.
      const report = redactedRuntimeValue(
        result.report,
        exactSecretValues,
      ) as EngineReport;
      const assessment = auditReportState(report);
      const indexability = summarizePageIndexability(report.pages);
      const issues = normalizeIssues(report);
      this.database.replaceIssues(runId, project.id, issues, {
        resolveMissing: assessment.status === "succeeded",
      });
      this.database.replacePages(
        runId,
        report.pages.map((page, index) => ({
          canonicalUrl: page.finalUrl || page.url,
          statusCode: page.status,
          title: page.title,
          indexable: indexability.assessments[index]?.indexable ?? null,
          payload: {
            evidenceVersion: RUN_EVIDENCE_VERSION,
            sourceUrl: page.url,
            crawlDepth: page.crawlDepth ?? null,
            discoveredFrom: page.discoveredFrom ?? null,
            responseTimeMs: page.responseTimeMs,
            vitals: page.vitals,
            contentType: page.contentType ?? null,
            canonical: page.canonical ?? null,
            robotsMeta: page.robotsMeta ?? null,
            xRobotsTag: page.xRobotsTag ?? null,
            robotsAllowed: page.robotsAllowed ?? null,
            htmlParsed: page.htmlParsed ?? null,
            error: page.error ?? null,
            redirectChain: page.redirectChain ?? [],
            htmlLang: page.htmlLang ?? null,
            hreflang: page.hreflang ?? null,
            extractions: page.extractions ?? [],
            ...(Array.isArray(page.internalLinks)
              ? {
                  linkGraphVersion: 1,
                  internalLinks: page.internalLinks,
                }
              : {}),
            indexabilityReason:
              indexability.assessments[index]?.reason ?? "missing_status",
          },
        })),
      );
      const performanceData = normalizePerformanceData({
        runId,
        projectId: project.id,
        projectCanonicalUrl: project.canonicalUrl,
        report,
      });
      this.database.replacePerformanceData({
        runId,
        projectId: project.id,
        ...performanceData,
      });
      const actions = normalizeActions(
        project.id,
        project.canonicalUrl,
        report,
      );
      this.database.upsertActions(actions);
      this.database.replaceActionIssueLinks(
        runId,
        project.id,
        this.database.listActions(project.id, { includeAdjudicated: true }),
        issues,
        { resolveMissing: assessment.status === "succeeded" },
      );
      if (assessment.status === "succeeded") {
        this.database.resolveMissingActions(
          project.id,
          actions.map((action) => action.id),
          report.generatedAt,
        );
      }
      this.saveMetrics(project.id, runId, report);
      await this.saveReportArtifacts(runId, report, engine, exactSecretValues);
      this.saveJsonArtifact(
        runId,
        "run-evidence.json",
        {
          version: RUN_EVIDENCE_VERSION,
          generatedAt: report.generatedAt,
          sitemap: buildSitemapEvidence(report),
        } satisfies StoredRunEvidenceSummary,
        exactSecretValues,
      );
      const status: Run["status"] = assessment.status;
      if (status === "failed") {
        const execution = this.database
          .listRunModules(runId)
          .find((entry) => entry.moduleId === auditModule.id);
        this.database.upsertRunModule({
          runId,
          moduleId: auditModule.id,
          version: auditModule.version,
          status: "failed",
          startedAt: execution?.startedAt ?? null,
          completedAt: execution?.completedAt ?? new Date().toISOString(),
          durationMs: execution?.durationMs ?? null,
          coverage: assessment.coverage,
          error: assessment.error,
        });
      }
      this.database.updateRun(runId, {
        status,
        completedAt: new Date().toISOString(),
        progress: 1,
        issueCount: issues.length,
        error: assessment.error,
      });
      this.emitRun(
        runId,
        status === "failed" ? "run.failed" : "run.completed",
        {
          status,
          issueCount: issues.length,
          progress: 1,
          ...(assessment.error ? { error: assessment.error } : {}),
        },
        exactSecretValues,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = redactedRuntimeText(
        error instanceof Error ? error.message : error,
        exactSecretValues,
      )!;
      this.database.updateRun(runId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: message,
      });
      this.emitRun(runId, "run.failed", { error: message }, exactSecretValues);
    } finally {
      exactSecretValues.clear();
      this.controllers.delete(runId);
    }
  }

  private async executeResearchWorkflow(
    run: Run,
    canonicalUrl: string,
    projectRoot: string,
    options: Record<string, unknown>,
    engine: EngineModule,
    signal: AbortSignal,
    exactSecretValues: Set<string>,
  ): Promise<void> {
    const moduleId = `research-${run.workflowId}`;
    const workflow = workflowById(this.workflows, run.workflowId);
    const researchModule: SeoModule<unknown, unknown> = {
      kind: "leaf",
      id: moduleId,
      version: this.version,
      inputSchema: Type.Object({}, { additionalProperties: false }),
      outputSchema: workflow.outputSchema,
      requirements: [],
      run: async () => {
        signal.throwIfAborted();
        let output: unknown;
        let partial = false;
        if (run.workflowId === "compare") {
          const competitorUrls = Array.isArray(options.competitorUrls)
            ? options.competitorUrls.filter(
                (url): url is string => typeof url === "string",
              )
            : typeof options.competitorUrl === "string"
              ? [options.competitorUrl]
              : [];
          if (competitorUrls.length === 0)
            throw new Error("compare requires competitorUrl or competitorUrls");
          if (!engine.compareSites)
            throw new Error("The core comparison workflow is unavailable");
          output = await engine.compareSites({
            urls: [canonicalUrl, ...competitorUrls],
            projectRoot,
            maxUrls: typeof options.maxUrls === "number" ? options.maxUrls : 30,
            renderMode: options.renderMode === "js" ? "js" : "static",
            concurrency: 2,
            signal,
            privateHostAllowlist: privateHostAllowlist(options),
          });
          partial =
            (
              output as { sites?: Array<{ error?: string | null }> }
            ).sites?.some((site) => Boolean(site.error)) ?? false;
        } else if (run.workflowId === "keyword-research") {
          const seed =
            typeof options.seed === "string" ? options.seed.trim() : "";
          if (!seed) throw new Error("keyword-research requires options.seed");
          if (!engine.keywordResearchModule)
            throw new Error("The keyword research module is unavailable");
          const context = await this.moduleContext(
            run.projectId,
            projectRoot,
            engine,
            exactSecretValues,
          );
          output = await engine.keywordResearchModule.invoke(
            {
              seed,
              includeTrends: options.includeTrends !== false,
              includePaa: options.includePaa !== false,
              includeRelated: options.includeRelated !== false,
            },
            context,
          );
          partial =
            Array.isArray((output as { issues?: unknown[] }).issues) &&
            (output as { issues: unknown[] }).issues.length > 0;
        } else if (run.workflowId === "content-plan") {
          const seeds = Array.isArray(options.seeds)
            ? options.seeds.filter(
                (seed): seed is string =>
                  typeof seed === "string" && seed.trim().length > 0,
              )
            : typeof options.seed === "string"
              ? [options.seed]
              : [];
          if (seeds.length === 0)
            throw new Error(
              "content-plan requires options.seed or options.seeds",
            );
          if (!engine.keywordResearchModule || !engine.topicClustersModule)
            throw new Error("The content planning modules are unavailable");
          const context = await this.moduleContext(
            run.projectId,
            projectRoot,
            engine,
            exactSecretValues,
          );
          const keywordProfiles = await Promise.all(
            seeds.slice(0, 10).map(async (seed) => {
              signal.throwIfAborted();
              return engine.keywordResearchModule!.invoke(
                {
                  seed,
                  includeTrends: true,
                  includePaa: true,
                  includeRelated: true,
                },
                context,
              );
            }),
          );
          signal.throwIfAborted();
          const clusters = await engine.topicClustersModule.invoke(
            { seeds },
            context,
          );
          output = {
            generatedAt: new Date().toISOString(),
            seeds,
            keywordProfiles,
            clusters,
          };
          partial = keywordProfiles.some(
            (profile) =>
              Array.isArray(profile.issues) && profile.issues.length > 0,
          );
        } else {
          throw new Error(`Unknown workflow '${run.workflowId}'`);
        }
        signal.throwIfAborted();
        return { output, partial };
      },
    };
    const leafRegistry = new Map([[moduleId, researchModule]]);
    const plan = createWorkflowPlan(workflow, { options }, leafRegistry);
    const [execution] = await executePlan(plan, leafRegistry, {
      concurrency: 1,
      runId: run.id,
      signal,
      onNodeStateChange: (state) =>
        this.database.upsertRunModule({
          runId: run.id,
          moduleId: state.moduleId,
          version: state.version ?? "unknown",
          status: state.status,
          startedAt: state.startedAt ?? null,
          completedAt: state.completedAt ?? null,
          durationMs: state.durationMs ?? null,
          coverage: state.coverage ?? null,
          error: redactedRuntimeText(
            state.error ?? state.skipReason,
            exactSecretValues,
          ),
        }),
    });
    if (!execution || execution.status === "cancelled" || signal.aborted)
      return;
    if (execution.status !== "succeeded" || !execution.output) {
      throw new Error(
        execution.error ??
          execution.skipReason ??
          `${run.workflowId} did not complete`,
      );
    }
    validateWorkflowOutput(workflow, execution.output);
    const { output, partial } = execution.output as {
      output: unknown;
      partial: boolean;
    };
    if (signal.aborted || this.database.getRun(run.id)?.status === "cancelled")
      return;
    this.saveJsonArtifact(
      run.id,
      `workflow.${run.workflowId}.json`,
      output,
      exactSecretValues,
    );
    // The standard report endpoint and agent clients can retrieve research
    // results without knowing private artifact names.
    this.saveJsonArtifact(run.id, "report.json", output, exactSecretValues);
    const status: Run["status"] = partial ? "partial" : "succeeded";
    this.database.updateRun(run.id, {
      status,
      completedAt: new Date().toISOString(),
      progress: 1,
      issueCount: 0,
      error: null,
    });
    this.emitRun(run.id, "run.completed", {
      status,
      workflowId: run.workflowId,
      progress: 1,
    });
  }

  private async moduleContext(
    projectId: string,
    projectRoot: string,
    engine: EngineModule,
    exactSecretValues: Set<string>,
  ): Promise<Record<string, unknown>> {
    const logger: Record<string, unknown> = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
    logger.child = () => logger;
    const integrationCredentials =
      await this.loadResearchCredentials(projectId);
    collectCredentialSecrets(integrationCredentials, exactSecretValues);
    return {
      projectRoot,
      limits: engine.loadLimits?.() ?? {},
      logger,
      moduleResults: new Map(),
      integrationCredentials,
      ...(this.integrationFetch
        ? { providerFetch: this.integrationFetch }
        : {}),
      signal: {
        markWeak: () => undefined,
        markStrong: () => undefined,
        isFollowUp: false,
      },
    };
  }

  private async loadResearchCredentials(
    projectId: string,
  ): Promise<Record<string, Record<string, string | number>>> {
    const result: Record<string, Record<string, string | number>> = {};
    for (const provider of ["serpapi", "dataforseo"] as const) {
      const integration = this.database
        .listIntegrations()
        .find((candidate) => candidate.provider === provider);
      if (!integration?.secretRef) continue;
      const [savedProvider, account, kind, ...extra] =
        integration.secretRef.split("/");
      if (extra.length || savedProvider !== provider || !account || !kind)
        continue;
      const bytes = await this.credentialStore.get({ provider, account, kind });
      if (!bytes) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
      } catch {
        this.updateIntegrationStatus(provider, "failed", integration.expiresAt);
        continue;
      } finally {
        bytes.fill(0);
      }
      if (!parsed || typeof parsed !== "object") continue;
      const record = parsed as Record<string, unknown>;
      const configuration =
        this.database.getProjectIntegrationConfiguration(projectId, provider) ??
        {};
      if (
        provider === "serpapi" &&
        typeof record.apiKey === "string" &&
        record.apiKey
      ) {
        result.serpapi = {
          apiKey: record.apiKey,
          ...(typeof configuration.gl === "string"
            ? { gl: configuration.gl }
            : {}),
          ...(typeof configuration.hl === "string"
            ? { hl: configuration.hl }
            : {}),
        };
      }
      if (
        provider === "dataforseo" &&
        typeof record.login === "string" &&
        record.login &&
        typeof record.password === "string" &&
        record.password
      ) {
        result.dataforseo = {
          login: record.login,
          password: record.password,
          ...(typeof configuration.locationCode === "number"
            ? { locationCode: configuration.locationCode }
            : {}),
          ...(typeof configuration.languageCode === "string"
            ? { languageCode: configuration.languageCode }
            : {}),
        };
      }
    }
    return result;
  }

  private saveJsonArtifact(
    runId: string,
    kind: string,
    value: unknown,
    exactSecretValues: Iterable<string> = [],
  ): void {
    const directory = join(this.dataDir, "artifacts", runId);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const safeValue = redactedRuntimeValue(value, exactSecretValues);
    const bytes = Buffer.from(JSON.stringify(safeValue, null, 2));
    const path = join(directory, kind);
    writeFileSync(path, bytes, { mode: 0o600 });
    this.database.saveArtifact({
      id: randomUUID(),
      runId,
      kind,
      path,
      mediaType: "application/json",
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
    });
  }

  private saveMetrics(
    projectId: string,
    runId: string,
    report: EngineReport,
  ): void {
    const observedAt = report.generatedAt;
    const pages = report.pages;
    const indexability = summarizePageIndexability(pages);
    const weightedIssues = report.issues.reduce(
      (total, issue) =>
        total +
        (issue.priority === "High"
          ? 1
          : issue.priority === "Medium"
            ? 0.55
            : 0.25),
      0,
    );
    const health = Math.max(
      0,
      Math.round((1 - weightedIssues / Math.max(1, pages.length * 2)) * 100),
    );
    const previousHealth = [...this.database.listMetricHistory(projectId)]
      .reverse()
      .find(
        (entry) =>
          entry.runId !== runId &&
          entry.key === "seo_health" &&
          entry.metric.state === "available" &&
          typeof entry.metric.value === "number" &&
          Number.isFinite(entry.metric.value),
      )?.metric;
    const measuredVitals = pages.filter(
      (page) =>
        page.vitals && page.vitals.lcp !== null && page.vitals.cls !== null,
    );
    const passingVitals = measuredVitals.filter(
      (page) =>
        page.vitals!.lcp! <= 2_500 &&
        page.vitals!.cls! <= 0.1 &&
        (page.vitals!.ttfb === null || page.vitals!.ttfb <= 800),
    );
    const available = (
      value: number,
      source: string,
      coverage = 1,
    ): MetricValue => ({
      value,
      state: "available",
      source,
      observedAt,
      coverage,
    });
    this.database.upsertMetric(
      projectId,
      runId,
      "seo_health",
      available(health, "crawl"),
    );
    this.database.upsertMetric(
      projectId,
      runId,
      "health_change",
      previousHealth?.value === null || previousHealth?.value === undefined
        ? {
            ...unavailable(
              "audit-comparison",
              "A second completed audit is required to calculate health change.",
            ),
            observedAt,
          }
        : available(
            health - previousHealth.value,
            "audit-comparison",
            Math.min(1, previousHealth.coverage ?? 1),
          ),
    );
    this.database.upsertMetric(projectId, runId, "indexable_coverage", {
      value: indexability.value,
      state: indexability.value === null ? "unavailable" : "available",
      source: "crawl",
      observedAt,
      coverage: indexability.coverage,
      note:
        indexability.totalPages === 0
          ? "No crawled pages were available for indexability classification."
          : `Classified ${indexability.knownPages} of ${indexability.totalPages} crawled pages; ${indexability.totalPages - indexability.knownPages} remain unknown because required crawl evidence was unavailable.`,
    });
    this.database.upsertMetric(
      projectId,
      runId,
      "cwv_pass_rate",
      measuredVitals.length
        ? available(
            passingVitals.length / measuredVitals.length,
            "browser",
            measuredVitals.length / Math.max(1, pages.length),
          )
        : unavailable(
            "browser",
            "No Core Web Vitals measurements were collected.",
          ),
    );
    if (report.realData?.gsc.length) {
      this.database.upsertMetric(
        projectId,
        runId,
        "gsc_clicks",
        available(
          report.realData.gsc.reduce((sum, row) => sum + row.clicks, 0),
          "google-search-console",
        ),
      );
      this.database.upsertMetric(
        projectId,
        runId,
        "gsc_impressions",
        available(
          report.realData.gsc.reduce((sum, row) => sum + row.impressions, 0),
          "google-search-console",
        ),
      );
    }
    if (report.realData?.ga4.length) {
      this.database.upsertMetric(
        projectId,
        runId,
        "organic_key_events",
        available(
          report.realData.ga4.reduce((sum, row) => sum + row.keyEvents, 0),
          "google-analytics-4",
        ),
      );
    }
  }

  private async saveReportArtifacts(
    runId: string,
    report: EngineReport,
    engine: EngineModule,
    exactSecretValues: Iterable<string> = [],
  ): Promise<void> {
    const directory = join(this.dataDir, "artifacts", runId);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const safeReport = redactedRuntimeValue(report, exactSecretValues);
    const safeText = (value: string): string =>
      redactedRuntimeValue(value, exactSecretValues);
    const formats: Array<{
      kind: string;
      mediaType: string;
      bytes: Uint8Array;
    }> = [
      {
        kind: "report.json",
        mediaType: "application/json",
        bytes: Buffer.from(safeText(engine.reportToJson(safeReport))),
      },
      {
        kind: "report.html",
        mediaType: "text/html; charset=utf-8",
        bytes: Buffer.from(safeText(engine.reportToHtml(safeReport))),
      },
      {
        kind: "report.csv",
        mediaType: "text/csv; charset=utf-8",
        bytes: Buffer.from(safeText(engine.reportToCsv(safeReport))),
      },
      {
        kind: "report.pdf",
        mediaType: "application/pdf",
        bytes: await createPdf(safeReport),
      },
    ];
    for (const artifact of formats) {
      const path = join(directory, artifact.kind);
      writeFileSync(path, artifact.bytes, { mode: 0o600 });
      try {
        chmodSync(path, 0o600);
      } catch {
        /* platform ACL may own this */
      }
      this.database.saveArtifact({
        id: randomUUID(),
        runId,
        kind: artifact.kind,
        path,
        mediaType: artifact.mediaType,
        sizeBytes: artifact.bytes.byteLength,
        sha256: sha256(artifact.bytes),
      });
    }
  }

  private readRunEvidenceSummary(
    runId: string,
  ): StoredRunEvidenceSummary | null {
    const artifact = this.database.getArtifact(runId, "run-evidence.json");
    if (
      !artifact ||
      artifact.sizeBytes < 0 ||
      artifact.sizeBytes > RUN_EVIDENCE_ARTIFACT_LIMIT
    ) {
      return null;
    }
    try {
      const artifactRoot = realpathSync(join(this.dataDir, "artifacts"));
      const path = realpathSync(artifact.path);
      const fromRoot = relative(artifactRoot, path);
      if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
      const bytes = readFileSync(path);
      if (
        bytes.byteLength !== artifact.sizeBytes ||
        sha256(bytes) !== artifact.sha256
      ) {
        return null;
      }
      const value = JSON.parse(bytes.toString("utf8")) as Record<
        string,
        unknown
      >;
      if (
        value.version !== RUN_EVIDENCE_VERSION ||
        typeof value.generatedAt !== "string" ||
        !Number.isFinite(Date.parse(value.generatedAt)) ||
        !Value.Check(SitemapEvidenceSchema, value.sitemap)
      ) {
        return null;
      }
      return value as unknown as StoredRunEvidenceSummary;
    } catch {
      return null;
    }
  }

  private runEvidence(
    runId: string,
    options: RunEvidenceListOptions,
  ): RunEvidencePage | null {
    const run = this.database.getRun(runId);
    if (!run) return null;
    const allowedSections = new Set<RunEvidenceListOptions["section"]>([
      "crawl",
      "redirects",
      "hreflang",
      "extractions",
    ]);
    if (!allowedSections.has(options.section))
      throw new RangeError("Unknown run evidence section");
    const limit = Math.min(250, Math.max(1, Math.trunc(options.limit ?? 100)));
    const offset = Math.min(
      1_000_000,
      Math.max(0, Math.trunc(options.offset ?? 0)),
    );
    const search = evidenceText(options.search, 160) ?? undefined;
    const stored = this.database.listPageEvidence(runId, {
      section: options.section,
      limit,
      offset,
      ...(search ? { search } : {}),
    });
    const items = stored.pages.flatMap((page) => {
      const item = normalizeRunEvidenceItem(options.section, page);
      return item ? [item] : [];
    });
    const summary = this.readRunEvidenceSummary(runId);
    const warnings: string[] = [];
    if (stored.pageCount === 0) {
      warnings.push("This run has no stored crawl pages.");
    }
    if (stored.evidencePageCount < stored.pageCount) {
      warnings.push(
        `${stored.pageCount - stored.evidencePageCount} page record(s) predate versioned evidence capture.`,
      );
    }
    if (!summary) {
      warnings.push(
        "The versioned sitemap summary is missing or failed its integrity check.",
      );
    }
    if (items.length < stored.pages.length) {
      warnings.push(
        `${stored.pages.length - items.length} malformed evidence record(s) were excluded from this page.`,
      );
    }
    const state: RunEvidencePage["state"] =
      stored.pageCount === 0
        ? "unavailable"
        : stored.evidencePageCount === stored.pageCount && summary
          ? "available"
          : "partial";
    const sitemap: SitemapEvidence = summary?.sitemap ?? {
      state: "not_captured",
      sourceUrl: null,
      fetchStatusCode: null,
      files: [],
      declaredUrls: null,
      discoveredIndexableUrls: null,
      matchedIndexableUrls: null,
      coverage: null,
      missingIndexable: unavailableSitemapSample(),
      declaredNotCrawled: unavailableSitemapSample(),
      brokenDeclared: unavailableSitemapSample(),
      warnings: ["No verified sitemap snapshot is available for this run."],
    };
    return {
      runId,
      generatedAt: summary?.generatedAt ?? run.completedAt,
      state,
      section: options.section,
      items,
      pageInfo: {
        total: stored.total,
        offset,
        limit,
        nextOffset:
          offset + stored.pages.length < stored.total ? offset + limit : null,
      },
      sitemap,
      warnings,
    };
  }

  private runLinks(
    runId: string,
    options: RunLinkExplorerOptions,
  ): RunLinkExplorer | null {
    const run = this.database.getRun(runId);
    if (!run) return null;
    if (run.workflowId !== "audit") {
      throw new RunLinkExplorerError(
        "Internal-link exploration only supports audit workflow runs.",
        "link_workflow_unsupported",
        422,
      );
    }
    if (!["succeeded", "partial"].includes(run.status)) {
      throw new RunLinkExplorerError(
        "The audit must be succeeded or partial before its link graph can be explored.",
        "link_run_not_ready",
        409,
      );
    }
    if (options.direction !== "inlinks" && options.direction !== "outlinks") {
      throw new RunLinkExplorerError(
        "Link direction must be inlinks or outlinks.",
        "link_direction_invalid",
        422,
      );
    }
    const pageUrl = evidenceUrl(options.pageUrl);
    if (!pageUrl) {
      throw new RunLinkExplorerError(
        "The selected page URL must be an absolute HTTP or HTTPS URL.",
        "link_page_url_invalid",
        422,
      );
    }
    const limit = Math.min(250, Math.max(1, Math.trunc(options.limit ?? 50)));
    const offset = Math.min(
      1_000_000,
      Math.max(0, Math.trunc(options.offset ?? 0)),
    );
    const search = evidenceText(options.search, 160) ?? undefined;
    const stored = this.database.getPageLinkExplorerData(runId, pageUrl, {
      direction: options.direction,
      limit,
      offset,
      ...(search ? { search } : {}),
    });
    if (!stored) {
      throw new RunLinkExplorerError(
        "The selected page does not exist in this audit snapshot.",
        "link_page_not_found",
        404,
      );
    }
    const warnings: string[] = [];
    if (stored.graphPageCount === 0) {
      warnings.push(
        "This audit predates immutable internal-link evidence capture. Replay it to create a comparable graph.",
      );
    } else if (stored.graphPageCount < stored.pageCount) {
      warnings.push(
        `${stored.pageCount - stored.graphPageCount} page record(s) predate link-graph capture, so totals may be incomplete.`,
      );
    }
    if (stored.page.payload.linkGraphVersion !== 1) {
      warnings.push(
        "The selected page has no versioned link evidence in this snapshot.",
      );
    }
    const state: RunLinkExplorer["state"] =
      stored.graphPageCount === 0
        ? "unavailable"
        : stored.graphPageCount === stored.pageCount
          ? "available"
          : "partial";
    const crawlDepth = stored.page.payload.crawlDepth;
    return {
      version: "link-graph-v1",
      runId,
      generatedAt: run.completedAt,
      state,
      page: {
        url: stored.page.canonicalUrl,
        title: evidenceText(stored.page.title, 2_000),
        statusCode: evidenceStatusCode(stored.page.statusCode),
        indexable: stored.page.indexable,
        crawlDepth:
          typeof crawlDepth === "number" &&
          Number.isInteger(crawlDepth) &&
          crawlDepth >= 0
            ? crawlDepth
            : null,
      },
      direction: options.direction,
      summary: stored.summary,
      items: stored.items.map((item) => ({
        ...item,
        sourceTitle: evidenceText(item.sourceTitle, 2_000),
        targetTitle: evidenceText(item.targetTitle, 2_000),
      })),
      pageInfo: {
        total: stored.total,
        offset,
        limit,
        nextOffset:
          offset + stored.items.length < stored.total ? offset + limit : null,
      },
      warnings,
    };
  }

  listRunEvents(runId: string, after = 0): RunEvent[] {
    return this.database.listRunEvents(runId, after);
  }
  listPages(runId: string) {
    return this.database.listPages(runId);
  }
  onRunEvent(runId: string, listener: (event: RunEvent) => void): () => void {
    const key = `run:${runId}`;
    this.events.on(key, listener);
    return () => this.events.off(key, listener);
  }

  async exportProject(projectId: string): Promise<Uint8Array> {
    const project = this.database.getProject(projectId);
    if (!project)
      throw new ProjectBundleError("Project not found.", "project_not_found");
    const runs = this.database.listAllRunsForProject(projectId);
    const settings = this.database.getProjectSettings(projectId);
    const runModules = runs.flatMap((run) =>
      this.database.listRunModules(run.id),
    );
    const pages: ProjectBundlePage[] = runs.flatMap((run) =>
      this.database.listPages(run.id).map((page) => ({
        runId: run.id,
        ...page,
        payload: sanitizeTransferValue(page.payload) as Record<string, unknown>,
      })),
    );
    const issues = runs.flatMap((run) =>
      this.database
        .listIssues(run.id, { includeAdjudication: false })
        .map((issue) => ({
          runId: run.id,
          issue: issueForProjectBundle(issue),
        })),
    );
    const projectConnectors = new Map(
      this.database
        .listProjectIntegrationConfigurations(projectId)
        .map((connector) => [connector.provider, connector.configuration]),
    );
    for (const integration of this.database.listIntegrations()) {
      if (!projectConnectors.has(integration.provider)) {
        projectConnectors.set(
          integration.provider,
          integration.configuration ?? {},
        );
      }
    }
    const connectors: ProjectBundleConnector[] = [...projectConnectors]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([provider, configuration]) => ({
        provider,
        configuration: sanitizeTransferValue(configuration) as Record<
          string,
          unknown
        >,
      }));

    let customRules: ProjectBundleCustomRule[] = [];
    const projectDirectory = resolve(this.dataDir, "projects", project.id);
    const customRulesPath = resolve(projectDirectory, "custom-rules.json");
    try {
      const fromProject = relative(projectDirectory, customRulesPath);
      if (fromProject.startsWith("..") || isAbsolute(fromProject))
        throw new Error("Unsafe custom-rules path");
      const ruleFile = readFileSync(customRulesPath);
      if (ruleFile.byteLength > 512 * 1024)
        throw new ProjectBundleError(
          "custom-rules.json exceeds the 512 KiB transfer limit.",
          "invalid_custom_rule",
        );
      const parsed = JSON.parse(ruleFile.toString("utf8")) as {
        rules?: unknown;
      };
      if (!Array.isArray(parsed.rules))
        throw new ProjectBundleError(
          "custom-rules.json must contain a rules array.",
          "invalid_custom_rule",
        );
      customRules = sanitizeTransferValue(
        parsed.rules,
      ) as ProjectBundleCustomRule[];
    } catch (error) {
      if (error instanceof ProjectBundleError) throw error;
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        customRules = [];
      } else {
        throw new ProjectBundleError(
          error instanceof SyntaxError
            ? "custom-rules.json is not valid JSON."
            : "custom-rules.json could not be read safely; export was stopped to prevent silent data loss.",
          "invalid_custom_rule",
        );
      }
    }

    const artifactRoot = resolve(this.dataDir, "artifacts");
    let embeddedArtifactBytes = 0;
    const artifacts: ProjectBundleArtifact[] = [];
    for (const artifact of this.database.listProjectArtifacts(projectId)) {
      if (!(artifact.kind in PROJECT_ARTIFACT_MEDIA)) continue;
      const kind = artifact.kind as ProjectArtifactKind;
      const expectedMedia = PROJECT_ARTIFACT_MEDIA[kind];
      const safeSha = /^[a-f0-9]{64}$/.test(artifact.sha256)
        ? artifact.sha256
        : null;
      const omitted = (
        reason: "size_limit" | "missing" | "unsafe" | "checksum_mismatch",
      ): ProjectBundleArtifact => ({
        id: artifact.id,
        runId: artifact.runId,
        kind,
        mediaType: expectedMedia,
        sizeBytes: Math.max(0, Math.trunc(artifact.sizeBytes)),
        sha256: safeSha,
        contentIncluded: false,
        omittedReason: reason,
      });
      if (
        artifact.sizeBytes > AGENTSEO_PROJECT_BUNDLE_LIMITS.maxArtifactBytes ||
        embeddedArtifactBytes + artifact.sizeBytes >
          AGENTSEO_PROJECT_BUNDLE_LIMITS.maxEmbeddedArtifactBytes
      ) {
        artifacts.push(omitted("size_limit"));
        continue;
      }
      try {
        const resolvedArtifact = realpathSync(artifact.path);
        const artifactRootReal = realpathSync(artifactRoot);
        const fromRoot = relative(artifactRootReal, resolvedArtifact);
        if (
          fromRoot.startsWith("..") ||
          isAbsolute(fromRoot) ||
          !statSync(resolvedArtifact).isFile()
        ) {
          artifacts.push(omitted("unsafe"));
          continue;
        }
        const bytes = readFileSync(resolvedArtifact);
        if (
          bytes.byteLength !== artifact.sizeBytes ||
          sha256(bytes) !== artifact.sha256
        ) {
          artifacts.push(omitted("checksum_mismatch"));
          continue;
        }
        const artifactText = bytes.toString("utf8");
        if (
          secretLikeValue.test(artifactText) ||
          localPathValue.test(artifactText)
        ) {
          artifacts.push(omitted("unsafe"));
          continue;
        }
        embeddedArtifactBytes += bytes.byteLength;
        artifacts.push({
          id: artifact.id,
          runId: artifact.runId,
          kind,
          mediaType: expectedMedia,
          sizeBytes: bytes.byteLength,
          sha256: artifact.sha256,
          contentIncluded: true,
          contentBase64: bytes.toString("base64"),
        });
      } catch {
        artifacts.push(omitted("missing"));
      }
    }

    const payload: Omit<AgentSeoProjectBundleV2, "integrity"> = {
      format: "agentseo-project",
      version: 2,
      exportedAt: new Date().toISOString(),
      secretsIncluded: false,
      project: sanitizeTransferValue(project) as typeof project,
      settings: settings
        ? {
            timezone: settings.timezone,
            reportingCurrency:
              settings.reportingCurrency?.toUpperCase() ?? null,
            weeklyDigest: settings.weeklyDigest,
            alertEmail: settings.alertEmail,
            dataRetentionDays: settings.dataRetentionDays,
            updatedAt: settings.updatedAt,
          }
        : null,
      runs: sanitizeTransferValue(runs) as typeof runs,
      runConfigurations: runs.map((run): ProjectBundleRunConfiguration => ({
        runId: run.id,
        options: sanitizeTransferValue(
          this.database.getRunOptions(run.id),
        ) as Record<string, unknown>,
      })),
      runModules: sanitizeTransferValue(runModules) as typeof runModules,
      pages,
      issues,
      issueAdjudications: this.database
        .listIssueAdjudications(projectId)
        .map((adjudication) => ({
          ...adjudication,
          note:
            adjudication.note === null
              ? null
              : boundedContractText(
                  sanitizeTransferValue(adjudication.note) as string,
                  2_000,
                  "Reviewed locally.",
                ),
        })),
      projectContext: sanitizeTransferValue({
        versions: this.database.listProjectContextVersions(projectId),
        journal: this.database.listProjectContextJournal(projectId),
      }) as AgentSeoProjectBundleV2["projectContext"],
      extractionRuleVersions: sanitizeTransferValue(
        this.database.listExtractionRuleVersions(projectId),
      ) as AgentSeoProjectBundleV2["extractionRuleVersions"],
      actions: this.database
        .listActions(projectId, { includeAdjudicated: true })
        .map((action) => actionForProjectBundle(action)),
      metrics: sanitizeTransferValue(
        this.database.listMetricHistory(projectId),
      ) as ReturnType<AgentSeoDatabase["listMetricHistory"]>,
      schedules: sanitizeTransferValue(
        this.database.listSchedules(projectId),
      ) as Schedule[],
      connectors,
      customRules,
      artifacts,
    };
    const bundle: AgentSeoProjectBundleV2 = {
      ...payload,
      integrity: {
        algorithm: "sha256",
        bundleSha256: transferPayloadChecksum(payload),
        embeddedArtifactBytes,
      },
    };
    validateProjectBundle(bundle);
    const bytes = Buffer.from(JSON.stringify(bundle, null, 2));
    if (bytes.byteLength > AGENTSEO_PROJECT_BUNDLE_LIMITS.maxBytes) {
      throw new ProjectBundleError(
        `The project export is ${bytes.byteLength} bytes; the safe .agentseo limit is ${AGENTSEO_PROJECT_BUNDLE_LIMITS.maxBytes} bytes.`,
        "bundle_too_large",
        413,
      );
    }
    return bytes;
  }

  async importProject(
    input: string | Uint8Array | unknown,
  ): Promise<ProjectImportResult> {
    let raw: unknown;
    if (typeof input === "string" || input instanceof Uint8Array) {
      const bytes =
        typeof input === "string"
          ? Buffer.byteLength(input, "utf8")
          : input.byteLength;
      if (bytes > AGENTSEO_PROJECT_BUNDLE_LIMITS.maxBytes)
        throw new ProjectBundleError(
          "The .agentseo file exceeds the 25 MiB import limit.",
          "bundle_too_large",
          413,
        );
      try {
        raw = JSON.parse(
          typeof input === "string"
            ? input
            : Buffer.from(input).toString("utf8"),
        ) as unknown;
      } catch {
        throw new ProjectBundleError(
          "The .agentseo file is not valid JSON.",
          "invalid_bundle_json",
        );
      }
    } else {
      let encoded: string;
      try {
        encoded = JSON.stringify(input);
      } catch {
        throw new ProjectBundleError(
          "The project bundle is not JSON serializable.",
          "invalid_bundle_json",
        );
      }
      if (encoded === undefined)
        throw new ProjectBundleError(
          "A .agentseo project bundle is required.",
          "invalid_bundle_json",
        );
      if (
        Buffer.byteLength(encoded, "utf8") >
        AGENTSEO_PROJECT_BUNDLE_LIMITS.maxBytes
      )
        throw new ProjectBundleError(
          "The .agentseo file exceeds the 25 MiB import limit.",
          "bundle_too_large",
          413,
        );
      raw = input;
    }
    validateProjectBundle(raw);

    const importedAt = new Date().toISOString();
    const projectId = randomUUID();
    const runIds = new Map(raw.runs.map((run) => [run.id, randomUUID()]));
    const remapRun = (sourceId: string): string => {
      const mapped = runIds.get(sourceId);
      if (!mapped)
        throw new ProjectBundleError(
          `Unknown source run ${sourceId}.`,
          "orphaned_bundle_record",
        );
      return mapped;
    };
    const warnings: string[] = [];
    const runs: Run[] = raw.runs.map((run) => {
      const incomplete = run.status === "queued" || run.status === "running";
      if (incomplete)
        warnings.push(
          `Run ${run.id} was ${run.status} when exported and was imported as cancelled history.`,
        );
      return {
        ...run,
        id: remapRun(run.id),
        projectId,
        status: incomplete ? "cancelled" : run.status,
        completedAt: incomplete ? importedAt : run.completedAt,
        error: incomplete
          ? "Imported snapshot of a non-terminal run; execution was not resumed."
          : run.error,
      };
    });
    const runConfigurations: ProjectBundleRunConfiguration[] = (
      raw.runConfigurations ?? []
    ).map((configuration) => ({
      runId: remapRun(configuration.runId),
      options: configuration.options,
    }));
    const runModules = raw.runModules.map((record) => ({
      ...record,
      runId: remapRun(record.runId),
      status:
        record.status === "queued" || record.status === "running"
          ? ("cancelled" as const)
          : record.status,
      completedAt:
        record.status === "queued" || record.status === "running"
          ? importedAt
          : record.completedAt,
    }));
    const pages = raw.pages.map((page) => ({
      ...page,
      runId: remapRun(page.runId),
    }));
    const issues = raw.issues.map((record) => ({
      runId: remapRun(record.runId),
      issue: record.issue,
    }));
    const issueAdjudications = (raw.issueAdjudications ?? []).map(
      (adjudication) => ({
        ...adjudication,
        projectId,
      }),
    );
    const contextVersions = (raw.projectContext?.versions ?? []).map(
      (version) => ({ ...version, projectId }),
    );
    const contextJournal = (raw.projectContext?.journal ?? []).map((entry) => ({
      ...entry,
      id: randomUUID(),
      projectId,
      sourceRunId:
        entry.sourceRunId === null ? null : remapRun(entry.sourceRunId),
    }));
    const extractionRuleVersions = (raw.extractionRuleVersions ?? []).map(
      (version) => ({ ...version, projectId }),
    );
    const actions: Action[] = raw.actions.map((action) => ({
      ...action,
      id: randomUUID(),
      projectId,
    }));
    const metrics = raw.metrics.map((record) => ({
      ...record,
      runId: record.runId === null ? null : remapRun(record.runId),
    }));
    const schedules: Schedule[] = raw.schedules.map((schedule) => ({
      ...schedule,
      id: randomUUID(),
      projectId,
      enabled: false,
      updatedAt: importedAt,
    }));

    const artifactDirectory = join(
      this.dataDir,
      "artifacts",
      "imported",
      projectId,
    );
    const importedProjectDirectory = join(this.dataDir, "projects", projectId);
    const writtenPaths: string[] = [];
    const importedArtifacts: Array<{
      id: string;
      runId: string;
      kind: string;
      path: string;
      mediaType: string;
      sizeBytes: number;
      sha256: string;
      createdAt: string;
    }> = [];
    try {
      if (raw.customRules.length > 0) {
        mkdirSync(importedProjectDirectory, {
          recursive: true,
          mode: 0o700,
        });
        const customRulesPath = join(
          importedProjectDirectory,
          "custom-rules.json",
        );
        writeFileSync(
          customRulesPath,
          `${JSON.stringify({ rules: raw.customRules }, null, 2)}\n`,
          { mode: 0o600, flag: "wx" },
        );
        writtenPaths.push(customRulesPath);
      }
      for (const artifact of raw.artifacts) {
        if (!artifact.contentIncluded) {
          warnings.push(
            `${artifact.kind} for run ${artifact.runId} was not embedded (${artifact.omittedReason}).`,
          );
          continue;
        }
        const runId = remapRun(artifact.runId);
        const directory = join(artifactDirectory, runId);
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const path = join(directory, artifact.kind);
        const bytes = Buffer.from(artifact.contentBase64, "base64");
        writeFileSync(path, bytes, { mode: 0o600, flag: "wx" });
        try {
          chmodSync(path, 0o600);
        } catch {
          /* platform ACL may own this */
        }
        writtenPaths.push(path);
        importedArtifacts.push({
          id: randomUUID(),
          runId,
          kind: artifact.kind,
          path,
          mediaType: artifact.mediaType,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
          createdAt: importedAt,
        });
      }

      const project = this.database.importProjectBundle({
        project: {
          ...raw.project,
          id: projectId,
        },
        settings: raw.settings,
        runs,
        runConfigurations,
        runModules,
        pages,
        issues,
        issueAdjudications,
        contextVersions,
        contextJournal,
        extractionRuleVersions,
        actions,
        metrics,
        schedules,
        connectors: raw.connectors,
        artifacts: importedArtifacts,
        sourceProjectId: raw.project.id,
        importedAt,
      });
      return {
        project,
        sourceProjectId: raw.project.id,
        importedAt,
        counts: {
          runs: runs.length,
          runModules: runModules.length,
          pages: pages.length,
          issues: issues.length,
          issueAdjudications: issueAdjudications.length,
          contextVersions: contextVersions.length,
          contextEntries: contextJournal.length,
          extractionRuleVersions: extractionRuleVersions.length,
          actions: actions.length,
          metrics: metrics.length,
          schedules: schedules.length,
          connectors: raw.connectors.length,
          customRules: raw.customRules.length,
          artifacts: importedArtifacts.length,
        },
        schedulesDisabled: true,
        reconnectProviders: raw.connectors.map(
          (connector) => connector.provider,
        ),
        warnings,
      };
    } catch (error) {
      for (const path of writtenPaths) rmSync(path, { force: true });
      rmSync(artifactDirectory, { recursive: true, force: true });
      rmSync(importedProjectDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  createServiceToken(): string {
    return randomBytes(32).toString("base64url");
  }
  configureGoogleOAuth(
    clientId: string | undefined,
    fetchImpl?: typeof fetch,
  ): void {
    const normalized = clientId?.trim();
    if (normalized) this.googleDesktopClientId = normalized;
    if (fetchImpl) this.oauthFetch = fetchImpl;
  }
  close(): void {
    this.scheduler.stop();
    this.jobWorker.stop();
    const credentialStore = this.credentialStore as CredentialStore & {
      close?: () => void;
    };
    credentialStore.close?.();
    this.database.checkpoint();
    this.database.close();
  }
}
