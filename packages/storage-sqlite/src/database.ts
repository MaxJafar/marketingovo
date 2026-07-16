import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type {
  Action,
  ActionCheckpoint,
  ActionOccurrenceLifecycle,
  ActionOutcomeObservation,
  ActionVerification,
  CreateProjectInput,
  ExtractionRule,
  ExtractionRuleSetVersion,
  ExtractionRuleWorkspace,
  Integration,
  InternalLinkDirection,
  IssueAdjudication,
  IssueAdjudicationStatus,
  IssueInstance,
  IssueReviewItem,
  IssueReviewListOptions,
  IssueReviewPage,
  MetricValue,
  ModuleStatus,
  Project,
  ProjectDeletionCounts,
  ProjectContextJournalEntry,
  ProjectContextProfile,
  ProjectContextVersion,
  ProjectContextWorkspace,
  Run,
  RunEvidenceSection,
  RunEvent,
  Schedule,
  UpdateActionInput,
} from "@golem-seo/contracts";
import type {
  ProjectBundleConnector,
  ProjectBundleIssueAdjudication,
  ProjectBundleMetric,
  ProjectBundlePage,
  ProjectBundleRunConfiguration,
  ProjectBundleRunModule,
  ProjectBundleSettings,
} from "@golem-seo/contracts/project-bundle";
import { migrations } from "./schema.js";

interface Row {
  [key: string]: unknown;
}

export type DurableJobState =
  "queued" | "leased" | "succeeded" | "failed" | "cancelled" | "dead_letter";
export interface DurableJob {
  id: string;
  runId: string | null;
  type: string;
  state: DurableJobState;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimedSchedule extends Schedule {
  leaseOwner: string;
  leaseExpiresAt: string;
}

export interface ProjectSettings {
  projectId: string;
  timezone: string | null;
  reportingCurrency: string | null;
  weeklyDigest: boolean;
  alertEmail: string | null;
  dataRetentionDays: number | null;
  updatedAt: string;
}

export interface ProjectSettingsPatch {
  name?: string;
  canonicalUrl?: string;
  timezone?: string | null;
  reportingCurrency?: string | null;
  weeklyDigest?: boolean;
  alertEmail?: string | null;
  dataRetentionDays?: number | null;
}

export interface RunModuleRecord {
  runId: string;
  moduleId: string;
  version: string;
  status: ModuleStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  coverage: number | null;
  error: string | null;
}

export interface RunDashboardStatistics {
  runId: string;
  pagesCrawled: number;
  healthScore: number | null;
}

export interface ProjectArtifactRecord {
  id: string;
  runId: string;
  kind: string;
  path: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface ProjectIssueRecord {
  runId: string;
  issue: IssueInstance;
}

export interface ImportedArtifactRecord {
  id: string;
  runId: string;
  kind: string;
  path: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface ActionIssueLinkRecord {
  actionId: string;
  runId: string;
  fingerprint: string;
  lifecycle: ActionOccurrenceLifecycle;
  observedAt: string;
  issue: IssueInstance;
}

export interface ActionIssueScope {
  actionId: string;
  currentInstances: number;
  visibleInstances: number;
  visibleUrls: string[];
}

export interface StoredActionCheckpoint extends ActionCheckpoint {
  baselineSnapshot: Record<string, unknown>;
  targetUrls: string[];
  controlUrls: string[];
  cohortMatching: Record<string, unknown>;
}

export interface StoredActionVerification extends ActionVerification {
  id: string;
  idempotencyKey: string;
  evidence: Array<Record<string, unknown>>;
  requestedAt: string;
  updatedAt: string;
}

export interface PerformanceWindowRecord {
  runId: string;
  projectId: string;
  source: "gsc" | "ga4";
  period: "current" | "previous";
  startDate: string;
  endDate: string;
  fetchedAt: string;
  state: "available" | "partial" | "unavailable" | "failed";
  rowCount: number;
  rowLimit: number | null;
  truncated: boolean;
  coverage: number | null;
  note: string | null;
}

export interface PagePerformanceRecord {
  runId: string;
  projectId: string;
  period: "current" | "previous";
  canonicalUrl: string;
  crawlMatched: boolean;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  sessions: number | null;
  pageViews: number | null;
  engagementRate: number | null;
  keyEvents: number | null;
}

export interface StoredPageRecord {
  canonicalUrl: string;
  statusCode: number | null;
  title: string | null;
  indexable: boolean | null;
  payload: Record<string, unknown>;
}

export interface StoredPageEvidencePage {
  pages: StoredPageRecord[];
  total: number;
  pageCount: number;
  evidencePageCount: number;
}

export interface StoredPageLinkMetrics {
  state: "available" | "unavailable";
  inlinkSources: number;
  inlinkOccurrences: number;
  outlinkTargets: number;
  outlinkOccurrences: number;
}

export interface StoredPageLinkEdge {
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

export interface StoredPageLinkExplorerData {
  page: StoredPageRecord;
  items: StoredPageLinkEdge[];
  total: number;
  pageCount: number;
  graphPageCount: number;
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
}

export interface StoredRunLinkGraphSnapshot {
  pageCount: number;
  graphPageCount: number;
  items: StoredPageLinkEdge[];
}

export interface QueryPerformanceRecord {
  runId: string;
  projectId: string;
  period: "current" | "previous";
  query: string;
  canonicalUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** All IDs are already remapped and all nested values sanitized by runtime. */
export interface DatabaseProjectImport {
  project: Project;
  settings: ProjectBundleSettings | null;
  runs: Run[];
  runConfigurations: ProjectBundleRunConfiguration[];
  runModules: ProjectBundleRunModule[];
  pages: ProjectBundlePage[];
  issues: ProjectIssueRecord[];
  issueAdjudications: ProjectBundleIssueAdjudication[];
  contextVersions: ProjectContextVersion[];
  contextJournal: ProjectContextJournalEntry[];
  extractionRuleVersions: ExtractionRuleSetVersion[];
  actions: Action[];
  metrics: ProjectBundleMetric[];
  schedules: Schedule[];
  connectors: ProjectBundleConnector[];
  artifacts: ImportedArtifactRecord[];
  sourceProjectId: string;
  importedAt: string;
}

const now = (): string => new Date().toISOString();
const json = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type PageLinkSourcePage = {
  canonicalUrl: string;
  payload?: Record<string, unknown>;
};

interface NormalizedPageLinkRow {
  sourceUrl: string;
  targetUrl: string;
  targetPageUrl: string | null;
  occurrences: number;
  followOccurrences: number;
  nofollowOccurrences: number;
  anchorTexts: string[];
  placements: StoredPageLinkEdge["placements"];
}

const LINK_PLACEMENTS = new Set<StoredPageLinkEdge["placements"][number]>([
  "header",
  "navigation",
  "main",
  "aside",
  "footer",
  "body",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedHttpUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function normalizedPageLinks(
  pages: readonly PageLinkSourcePage[],
): NormalizedPageLinkRow[] {
  const aliases = new Map<string, string>();
  for (const page of pages) {
    const canonicalUrl = normalizedHttpUrl(page.canonicalUrl);
    if (!canonicalUrl) continue;
    aliases.set(canonicalUrl, canonicalUrl);
    const payload = page.payload ?? {};
    const sourceUrl = normalizedHttpUrl(payload.sourceUrl);
    if (sourceUrl) aliases.set(sourceUrl, canonicalUrl);
    if (Array.isArray(payload.redirectChain)) {
      for (const hop of payload.redirectChain) {
        const alias = normalizedHttpUrl(hop, sourceUrl ?? canonicalUrl);
        if (alias) aliases.set(alias, canonicalUrl);
      }
    }
  }

  const rows = new Map<
    string,
    NormalizedPageLinkRow & {
      anchorTextSet: Set<string>;
      placementSet: Set<StoredPageLinkEdge["placements"][number]>;
    }
  >();
  for (const page of pages) {
    const sourceUrl = normalizedHttpUrl(page.canonicalUrl);
    const payload = page.payload ?? {};
    if (
      !sourceUrl ||
      payload.linkGraphVersion !== 1 ||
      !Array.isArray(payload.internalLinks)
    ) {
      continue;
    }
    const sourceOrigin = new URL(sourceUrl).origin;
    for (const value of payload.internalLinks) {
      const link = record(value);
      const targetUrl = normalizedHttpUrl(link?.targetUrl, sourceUrl);
      if (!link || !targetUrl || new URL(targetUrl).origin !== sourceOrigin)
        continue;
      const occurrences = boundedInteger(link.occurrences, 1, 2_147_483_647);
      const followOccurrences = boundedInteger(
        link.followOccurrences,
        0,
        2_147_483_647,
      );
      const nofollowOccurrences = boundedInteger(
        link.nofollowOccurrences,
        0,
        2_147_483_647,
      );
      if (
        occurrences === null ||
        followOccurrences === null ||
        nofollowOccurrences === null ||
        followOccurrences + nofollowOccurrences !== occurrences
      ) {
        continue;
      }
      const key = `${sourceUrl}\u0000${targetUrl}`;
      const current = rows.get(key) ?? {
        sourceUrl,
        targetUrl,
        targetPageUrl: aliases.get(targetUrl) ?? null,
        occurrences: 0,
        followOccurrences: 0,
        nofollowOccurrences: 0,
        anchorTexts: [],
        placements: [],
        anchorTextSet: new Set<string>(),
        placementSet: new Set<StoredPageLinkEdge["placements"][number]>(),
      };
      if (current.occurrences > 2_147_483_647 - occurrences) continue;
      current.occurrences += occurrences;
      current.followOccurrences += followOccurrences;
      current.nofollowOccurrences += nofollowOccurrences;
      if (Array.isArray(link.anchorTexts)) {
        for (const anchor of link.anchorTexts) {
          if (current.anchorTextSet.size >= 10) break;
          if (typeof anchor !== "string") continue;
          const text = anchor.replace(/\s+/gu, " ").trim().slice(0, 500);
          if (text) current.anchorTextSet.add(text);
        }
      }
      if (Array.isArray(link.placements)) {
        for (const placement of link.placements) {
          if (
            typeof placement === "string" &&
            LINK_PLACEMENTS.has(
              placement as StoredPageLinkEdge["placements"][number],
            )
          ) {
            current.placementSet.add(
              placement as StoredPageLinkEdge["placements"][number],
            );
          }
        }
      }
      rows.set(key, current);
    }
  }
  return [...rows.values()].map((row) => ({
    sourceUrl: row.sourceUrl,
    targetUrl: row.targetUrl,
    targetPageUrl: row.targetPageUrl,
    occurrences: row.occurrences,
    followOccurrences: row.followOccurrences,
    nofollowOccurrences: row.nofollowOccurrences,
    anchorTexts: [...row.anchorTextSet],
    placements: [...row.placementSet],
  }));
}

function asProject(row: Row): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    canonicalUrl: String(row.canonical_url),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asRun(row: Row): Run {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workflowId: String(row.workflow_id),
    status: row.status as Run["status"],
    requestedAt: String(row.requested_at),
    startedAt: row.started_at === null ? null : String(row.started_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
    progress: Number(row.progress),
    issueCount: Number(row.issue_count),
    error: row.error === null ? null : String(row.error),
  };
}

function asIssueReview(row: Row): IssueReviewItem {
  const adjudication = row.adjudication_status
    ? {
        projectId: String(row.project_id),
        fingerprint: String(row.fingerprint),
        status: row.adjudication_status as IssueAdjudication["status"],
        note:
          row.adjudication_note === null ? null : String(row.adjudication_note),
        actor: String(row.adjudication_actor),
        createdAt: String(row.adjudication_created_at),
        updatedAt: String(row.adjudication_updated_at),
      }
    : null;
  return {
    issue: {
      fingerprint: String(row.fingerprint),
      ruleId: String(row.rule_id),
      moduleId: String(row.module_id),
      canonicalUrl:
        row.canonical_url === null ? null : String(row.canonical_url),
      severity: row.severity as IssueInstance["severity"],
      title: String(row.title),
      description: String(row.description),
      evidence: json<IssueInstance["evidence"]>(row.evidence_json, []),
      firstSeenAt: String(row.first_seen_at),
      lastSeenAt: String(row.last_seen_at),
      status: row.effective_status as IssueInstance["status"],
    },
    latestRunId: String(row.latest_run_id),
    occurrenceCount: Number(row.occurrence_count),
    adjudication,
  };
}

function asProjectContextVersion(row: Row): ProjectContextVersion {
  return {
    projectId: String(row.project_id),
    revision: Number(row.revision),
    profile: json<ProjectContextProfile>(row.profile_json, {
      summary: null,
      audiences: [],
      markets: [],
      languages: [],
      conversionGoals: [],
      priorityTopics: [],
      competitors: [],
      constraints: [],
    }),
    changeSummary: String(row.change_summary),
    actor: String(row.actor),
    createdAt: String(row.created_at),
  };
}

function asProjectContextJournalEntry(row: Row): ProjectContextJournalEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sequence: Number(row.sequence),
    kind: row.kind as ProjectContextJournalEntry["kind"],
    title: String(row.title),
    detail: String(row.detail),
    sourceRunId: row.source_run_id === null ? null : String(row.source_run_id),
    actor: String(row.actor),
    createdAt: String(row.created_at),
  };
}

function asExtractionRuleSetVersion(row: Row): ExtractionRuleSetVersion {
  return {
    projectId: String(row.project_id),
    revision: Number(row.revision),
    configurationHash: String(row.configuration_hash),
    rules: json<ExtractionRule[]>(row.rules_json, []),
    changeSummary: String(row.change_summary),
    actor: String(row.actor),
    createdAt: String(row.created_at),
  };
}

function asAction(row: Row): Action {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ...(row.rule_id ? { ruleId: String(row.rule_id) } : {}),
    ...(row.module_id ? { moduleId: String(row.module_id) } : {}),
    ...(row.issue_fingerprint
      ? { issueFingerprint: String(row.issue_fingerprint) }
      : {}),
    title: String(row.title),
    whyNow: String(row.why_now),
    impact: Number(row.impact),
    effort: row.effort as Action["effort"],
    confidence: Number(row.confidence),
    priorityScore: Number(row.priority_score),
    scoreVersion: "priority-v1",
    scoreInputs: json<Action["scoreInputs"]>(row.score_inputs_json, {
      severity: 0,
      organicExposure: null,
      conversionExposure: null,
      urlReach: 0,
      confidence: 0,
      unavailable: [],
    }),
    affectedUrls: json<string[]>(row.affected_urls_json, []),
    owner: row.owner === null ? null : String(row.owner),
    status: row.status as Action["status"],
    verification: row.verification as Action["verification"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asJob(row: Row): DurableJob {
  return {
    id: String(row.id),
    runId: row.run_id === null ? null : String(row.run_id),
    type: String(row.type),
    state: row.state as DurableJobState,
    payload: json<Record<string, unknown>>(row.payload_json, {}),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    availableAt: String(row.available_at),
    leaseOwner: row.lease_owner === null ? null : String(row.lease_owner),
    leaseExpiresAt:
      row.lease_expires_at === null ? null : String(row.lease_expires_at),
    heartbeatAt: row.heartbeat_at === null ? null : String(row.heartbeat_at),
    lastError: row.last_error === null ? null : String(row.last_error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export interface GolemDatabaseOptions {
  path: string;
  busyTimeoutMs?: number;
}

export class GolemDatabase {
  readonly path: string;
  readonly db: DatabaseSync;

  constructor(options: GolemDatabaseOptions) {
    this.path = resolve(options.path);
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    try {
      chmodSync(dirname(this.path), 0o700);
    } catch {
      /* permissions may be managed externally */
    }
    this.db = new DatabaseSync(this.path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(
      `PRAGMA busy_timeout = ${Math.max(1_000, options.busyTimeoutMs ?? 8_000)};`,
    );
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.migrate();
    try {
      chmodSync(this.path, 0o600);
    } catch {
      /* Windows ACLs are handled by the installer */
    }
  }

  private migrate(): void {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
    );
    const appliedRows = this.db
      .prepare("SELECT version FROM schema_migrations")
      .all() as Row[];
    const applied = new Set(appliedRows.map((row) => Number(row.version)));
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      if (migration.foreignKeysOff) this.db.exec("PRAGMA foreign_keys = OFF;");
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(migration.sql);
        this.db
          .prepare(
            "INSERT INTO schema_migrations(version, name, applied_at) VALUES(?, ?, ?)",
          )
          .run(migration.version, migration.name, now());
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        if (migration.foreignKeysOff) this.db.exec("PRAGMA foreign_keys = ON;");
        throw error;
      }
      if (migration.foreignKeysOff) {
        this.db.exec("PRAGMA foreign_keys = ON;");
        const violations = this.db.prepare("PRAGMA foreign_key_check").all();
        if (violations.length > 0) {
          throw new Error(
            `Migration ${migration.version} left ${violations.length} foreign-key violation(s)`,
          );
        }
      }
    }
  }

  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  createProject(input: CreateProjectInput): Project {
    const timestamp = now();
    const project: Project = {
      id: randomUUID(),
      name: input.name.trim(),
      canonicalUrl: new URL(input.canonicalUrl).href,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO projects(id,name,canonical_url,created_at,updated_at) VALUES(?,?,?,?,?)",
        )
        .run(
          project.id,
          project.name,
          project.canonicalUrl,
          project.createdAt,
          project.updatedAt,
        );
      this.db
        .prepare(
          "INSERT INTO sites(id,project_id,canonical_url,created_at) VALUES(?,?,?,?)",
        )
        .run(randomUUID(), project.id, project.canonicalUrl, timestamp);
    });
    return project;
  }

  listProjects(): Project[] {
    return (
      this.db
        .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
        .all() as Row[]
    ).map(asProject);
  }

  getProject(id: string): Project | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as Row | undefined;
    return row ? asProject(row) : null;
  }

  deleteProject(
    projectId: string,
    deletedAt = now(),
  ): ProjectDeletionCounts | null {
    return this.transaction(() => {
      if (!this.getProject(projectId)) return null;
      const count = (sql: string): number => {
        const row = this.db.prepare(sql).get(projectId) as Row | undefined;
        return Number(row?.count ?? 0);
      };
      const counts: ProjectDeletionCounts = {
        runs: count("SELECT COUNT(*) AS count FROM runs WHERE project_id=?"),
        pages: count(
          `SELECT COUNT(*) AS count FROM pages p
          JOIN runs r ON r.id=p.run_id WHERE r.project_id=?`,
        ),
        issueInstances: count(
          "SELECT COUNT(*) AS count FROM issue_instances WHERE project_id=?",
        ),
        actions: count(
          "SELECT COUNT(*) AS count FROM actions WHERE project_id=?",
        ),
        schedules: count(
          "SELECT COUNT(*) AS count FROM schedules WHERE project_id=?",
        ),
        artifacts: count(
          `SELECT COUNT(*) AS count FROM artifacts a
          JOIN runs r ON r.id=a.run_id WHERE r.project_id=?`,
        ),
        contextVersions: count(
          "SELECT COUNT(*) AS count FROM project_context_versions WHERE project_id=?",
        ),
        contextEntries: count(
          "SELECT COUNT(*) AS count FROM project_context_journal WHERE project_id=?",
        ),
        extractionRuleVersions: count(
          "SELECT COUNT(*) AS count FROM project_extraction_rule_versions WHERE project_id=?",
        ),
      };

      this.db.prepare("DELETE FROM projects WHERE id=?").run(projectId);
      // Issue definitions are shared by fingerprint. Remove only definitions
      // that no surviving project, action, or adjudication references.
      this.db.exec(`
        DELETE FROM issues
        WHERE NOT EXISTS (
          SELECT 1 FROM issue_instances WHERE issue_instances.fingerprint=issues.fingerprint
        )
        AND NOT EXISTS (
          SELECT 1 FROM issue_adjudications WHERE issue_adjudications.fingerprint=issues.fingerprint
        )
        AND NOT EXISTS (
          SELECT 1 FROM action_issue_instances WHERE action_issue_instances.fingerprint=issues.fingerprint
        )
        AND NOT EXISTS (
          SELECT 1 FROM actions WHERE actions.issue_fingerprint=issues.fingerprint
        );
      `);
      this.db
        .prepare(
          `DELETE FROM audit_events
          WHERE entity_id=?
            OR (
              json_valid(payload_json)
              AND json_extract(payload_json,'$.projectId')=?
            )`,
        )
        .run(projectId, projectId);
      this.db
        .prepare(
          `INSERT INTO audit_events
          (actor,action,entity_type,entity_id,at,payload_json)
          VALUES('local-user','project.delete','project',?,?,?)`,
        )
        .run(projectId, deletedAt, JSON.stringify({ counts }));
      return counts;
    });
  }

  getProjectSettings(projectId: string): ProjectSettings | null {
    const row = this.db
      .prepare("SELECT * FROM project_settings WHERE project_id = ?")
      .get(projectId) as Row | undefined;
    if (!row) return null;
    return {
      projectId: String(row.project_id),
      timezone: row.timezone === null ? null : String(row.timezone),
      reportingCurrency:
        row.reporting_currency === null ? null : String(row.reporting_currency),
      weeklyDigest: Boolean(row.weekly_digest),
      alertEmail: row.alert_email === null ? null : String(row.alert_email),
      dataRetentionDays:
        row.data_retention_days === null
          ? null
          : Number(row.data_retention_days),
      updatedAt: String(row.updated_at),
    };
  }

  updateProjectSettings(
    projectId: string,
    patch: ProjectSettingsPatch,
  ): { project: Project; settings: ProjectSettings } | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    const current = this.getProjectSettings(projectId);
    const updatedAt = now();
    const name = patch.name === undefined ? project.name : patch.name.trim();
    const canonicalUrl =
      patch.canonicalUrl === undefined
        ? project.canonicalUrl
        : new URL(patch.canonicalUrl).href;
    const settings = {
      timezone:
        patch.timezone === undefined
          ? (current?.timezone ?? null)
          : patch.timezone,
      reportingCurrency:
        patch.reportingCurrency === undefined
          ? (current?.reportingCurrency ?? null)
          : patch.reportingCurrency,
      weeklyDigest:
        patch.weeklyDigest === undefined
          ? (current?.weeklyDigest ?? false)
          : patch.weeklyDigest,
      alertEmail:
        patch.alertEmail === undefined
          ? (current?.alertEmail ?? null)
          : patch.alertEmail,
      dataRetentionDays:
        patch.dataRetentionDays === undefined
          ? (current?.dataRetentionDays ?? null)
          : patch.dataRetentionDays,
    };

    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE projects SET name=?, canonical_url=?, updated_at=? WHERE id=?",
        )
        .run(name, canonicalUrl, updatedAt, projectId);
      this.db
        .prepare("UPDATE sites SET canonical_url=? WHERE project_id=?")
        .run(canonicalUrl, projectId);
      this.db
        .prepare(
          `INSERT INTO project_settings
        (project_id,timezone,reporting_currency,weekly_digest,alert_email,data_retention_days,updated_at)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(project_id) DO UPDATE SET
          timezone=excluded.timezone,reporting_currency=excluded.reporting_currency,
          weekly_digest=excluded.weekly_digest,alert_email=excluded.alert_email,
          data_retention_days=excluded.data_retention_days,updated_at=excluded.updated_at`,
        )
        .run(
          projectId,
          settings.timezone,
          settings.reportingCurrency,
          settings.weeklyDigest ? 1 : 0,
          settings.alertEmail,
          settings.dataRetentionDays,
          updatedAt,
        );
    });

    return {
      project: this.getProject(projectId)!,
      settings: this.getProjectSettings(projectId)!,
    };
  }

  getProjectContext(
    projectId: string,
    options: { historyLimit?: number; journalLimit?: number } = {},
  ): ProjectContextWorkspace | null {
    if (!this.getProject(projectId)) return null;
    const historyLimit = Math.min(
      100,
      Math.max(1, Math.trunc(options.historyLimit ?? 20)),
    );
    const journalLimit = Math.min(
      500,
      Math.max(1, Math.trunc(options.journalLimit ?? 100)),
    );
    const history = (
      this.db
        .prepare(
          `SELECT * FROM project_context_versions
          WHERE project_id=? ORDER BY revision DESC LIMIT ?`,
        )
        .all(projectId, historyLimit) as Row[]
    ).map(asProjectContextVersion);
    const journal = (
      this.db
        .prepare(
          `SELECT * FROM project_context_journal
          WHERE project_id=? ORDER BY sequence DESC LIMIT ?`,
        )
        .all(projectId, journalLimit) as Row[]
    ).map(asProjectContextJournalEntry);
    return {
      projectId,
      current: history[0] ?? null,
      history,
      journal,
    };
  }

  listProjectContextVersions(projectId: string): ProjectContextVersion[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM project_context_versions
          WHERE project_id=? ORDER BY revision`,
        )
        .all(projectId) as Row[]
    ).map(asProjectContextVersion);
  }

  listProjectContextJournal(projectId: string): ProjectContextJournalEntry[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM project_context_journal
          WHERE project_id=? ORDER BY sequence`,
        )
        .all(projectId) as Row[]
    ).map(asProjectContextJournalEntry);
  }

  updateProjectContext(
    projectId: string,
    profile: ProjectContextProfile,
    changeSummary: string,
    actor: string,
  ): ProjectContextWorkspace | null {
    if (!this.getProject(projectId)) return null;
    const createdAt = now();
    this.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(revision),0) AS revision
          FROM project_context_versions WHERE project_id=?`,
        )
        .get(projectId) as Row;
      const revision = Number(row.revision) + 1;
      this.db
        .prepare(
          `INSERT INTO project_context_versions
          (project_id,revision,profile_json,change_summary,actor,created_at)
          VALUES(?,?,?,?,?,?)`,
        )
        .run(
          projectId,
          revision,
          JSON.stringify(profile),
          changeSummary,
          actor,
          createdAt,
        );
      this.db
        .prepare(
          `INSERT INTO audit_events
          (actor,action,entity_type,entity_id,at,payload_json)
          VALUES(?,?,?,?,?,?)`,
        )
        .run(
          actor,
          "project.context.update",
          "project",
          projectId,
          createdAt,
          JSON.stringify({
            projectId,
            revision,
            summaryPresent: profile.summary !== null,
            listItemCount: Object.values(profile)
              .filter(Array.isArray)
              .reduce((total, values) => total + values.length, 0),
          }),
        );
    });
    return this.getProjectContext(projectId);
  }

  appendProjectContextJournal(input: {
    projectId: string;
    kind: ProjectContextJournalEntry["kind"];
    title: string;
    detail: string;
    sourceRunId: string | null;
    actor: string;
  }): ProjectContextJournalEntry | null {
    if (!this.getProject(input.projectId)) return null;
    if (input.sourceRunId) {
      const run = this.getRun(input.sourceRunId);
      if (!run || run.projectId !== input.projectId) {
        throw new Error(
          "Project context source run does not belong to this project",
        );
      }
    }
    const id = randomUUID();
    const createdAt = now();
    let sequence = 0;
    this.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(sequence),0) AS sequence
          FROM project_context_journal WHERE project_id=?`,
        )
        .get(input.projectId) as Row;
      sequence = Number(row.sequence) + 1;
      this.db
        .prepare(
          `INSERT INTO project_context_journal
          (id,project_id,sequence,kind,title,detail,source_run_id,actor,created_at)
          VALUES(?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.projectId,
          sequence,
          input.kind,
          input.title,
          input.detail,
          input.sourceRunId,
          input.actor,
          createdAt,
        );
      this.db
        .prepare(
          `INSERT INTO audit_events
          (actor,action,entity_type,entity_id,at,payload_json)
          VALUES(?,?,?,?,?,?)`,
        )
        .run(
          input.actor,
          "project.context.journal.append",
          "project_context_entry",
          id,
          createdAt,
          JSON.stringify({
            projectId: input.projectId,
            sequence,
            kind: input.kind,
            sourceRunPresent: input.sourceRunId !== null,
          }),
        );
    });
    return this.listProjectContextJournal(input.projectId).at(-1) ?? null;
  }

  getExtractionRuleWorkspace(
    projectId: string,
    historyLimit = 100,
  ): ExtractionRuleWorkspace | null {
    if (!this.getProject(projectId)) return null;
    const limit = Math.min(100, Math.max(1, Math.trunc(historyLimit)));
    const history = (
      this.db
        .prepare(
          `SELECT * FROM project_extraction_rule_versions
          WHERE project_id=? ORDER BY revision DESC LIMIT ?`,
        )
        .all(projectId, limit) as Row[]
    ).map(asExtractionRuleSetVersion);
    return { projectId, current: history[0] ?? null, history };
  }

  getExtractionRuleVersion(
    projectId: string,
    revision: number,
  ): ExtractionRuleSetVersion | null {
    const row = this.db
      .prepare(
        `SELECT * FROM project_extraction_rule_versions
        WHERE project_id=? AND revision=?`,
      )
      .get(projectId, revision) as Row | undefined;
    return row ? asExtractionRuleSetVersion(row) : null;
  }

  listExtractionRuleVersions(projectId: string): ExtractionRuleSetVersion[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM project_extraction_rule_versions
          WHERE project_id=? ORDER BY revision`,
        )
        .all(projectId) as Row[]
    ).map(asExtractionRuleSetVersion);
  }

  updateExtractionRules(input: {
    projectId: string;
    rules: ExtractionRule[];
    configurationHash: string;
    changeSummary: string;
    actor: string;
  }): ExtractionRuleWorkspace | null {
    if (!this.getProject(input.projectId)) return null;
    const createdAt = now();
    this.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(revision),0) AS revision
          FROM project_extraction_rule_versions WHERE project_id=?`,
        )
        .get(input.projectId) as Row;
      const revision = Number(row.revision) + 1;
      this.db
        .prepare(
          `INSERT INTO project_extraction_rule_versions
          (project_id,revision,configuration_hash,rules_json,change_summary,actor,created_at)
          VALUES(?,?,?,?,?,?,?)`,
        )
        .run(
          input.projectId,
          revision,
          input.configurationHash,
          JSON.stringify(input.rules),
          input.changeSummary,
          input.actor,
          createdAt,
        );
      this.db
        .prepare(
          `INSERT INTO audit_events
          (actor,action,entity_type,entity_id,at,payload_json)
          VALUES(?,?,?,?,?,?)`,
        )
        .run(
          input.actor,
          "project.extraction_rules.update",
          "project",
          input.projectId,
          createdAt,
          JSON.stringify({
            projectId: input.projectId,
            revision,
            configurationHash: input.configurationHash,
            ruleCount: input.rules.length,
            enabledRuleCount: input.rules.filter((rule) => rule.enabled).length,
          }),
        );
    });
    return this.getExtractionRuleWorkspace(input.projectId);
  }

  insertRun(input: {
    id: string;
    projectId: string;
    workflowId: string;
    idempotencyKey?: string;
    options?: unknown;
  }): Run {
    if (input.idempotencyKey) {
      const existing = this.db
        .prepare(
          "SELECT * FROM runs WHERE project_id = ? AND idempotency_key = ?",
        )
        .get(input.projectId, input.idempotencyKey) as Row | undefined;
      if (existing) return asRun(existing);
    }
    const requestedAt = now();
    this.db
      .prepare(
        `INSERT INTO runs
      (id,project_id,workflow_id,status,idempotency_key,requested_at,started_at,completed_at,progress,issue_count,error,options_json)
      VALUES(?,?,?,'queued',?,?,NULL,NULL,0,0,NULL,?)`,
      )
      .run(
        input.id,
        input.projectId,
        input.workflowId,
        input.idempotencyKey ?? null,
        requestedAt,
        JSON.stringify(input.options ?? {}),
      );
    return this.getRun(input.id)!;
  }

  updateRun(
    id: string,
    patch: Partial<
      Pick<
        Run,
        | "status"
        | "startedAt"
        | "completedAt"
        | "progress"
        | "issueCount"
        | "error"
      >
    >,
  ): Run | null {
    const current = this.getRun(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.db
      .prepare(
        `UPDATE runs SET status=?, started_at=?, completed_at=?, progress=?, issue_count=?, error=? WHERE id=?`,
      )
      .run(
        next.status,
        next.startedAt,
        next.completedAt,
        next.progress,
        next.issueCount,
        next.error,
        id,
      );
    return this.getRun(id);
  }

  getRun(id: string): Run | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
      Row | undefined;
    return row ? asRun(row) : null;
  }

  getRunOptions(id: string): Record<string, unknown> {
    const row = this.db
      .prepare("SELECT options_json FROM runs WHERE id=?")
      .get(id) as Row | undefined;
    return json<Record<string, unknown>>(row?.options_json, {});
  }

  listRuns(projectId?: string): Run[] {
    const rows = projectId
      ? this.db
          .prepare(
            "SELECT * FROM runs WHERE project_id = ? ORDER BY requested_at DESC LIMIT 200",
          )
          .all(projectId)
      : this.db
          .prepare("SELECT * FROM runs ORDER BY requested_at DESC LIMIT 200")
          .all();
    return (rows as Row[]).map(asRun);
  }

  listRunDashboardStatistics(projectId?: string): RunDashboardStatistics[] {
    const rows = this.db
      .prepare(
        `SELECT r.id AS run_id,
          (SELECT COUNT(*) FROM pages p WHERE p.run_id=r.id) AS pages_crawled,
          (SELECT CASE WHEN m.state='available' THEN m.value ELSE NULL END
             FROM metrics m
            WHERE m.run_id=r.id AND m.key='seo_health'
            ORDER BY m.id DESC LIMIT 1) AS health_score
         FROM runs r
         ${projectId ? "WHERE r.project_id=?" : ""}
         ORDER BY r.requested_at DESC
         LIMIT 200`,
      )
      .all(...(projectId ? [projectId] : [])) as Row[];
    return rows.map((row) => {
      const healthScore =
        row.health_score === null || row.health_score === undefined
          ? null
          : Number(row.health_score);
      return {
        runId: String(row.run_id),
        pagesCrawled: Number(row.pages_crawled),
        healthScore:
          healthScore !== null &&
          Number.isFinite(healthScore) &&
          healthScore >= 0 &&
          healthScore <= 100
            ? healthScore
            : null,
      };
    });
  }

  listAllRunsForProject(projectId: string): Run[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM runs WHERE project_id=? ORDER BY requested_at ASC,id ASC",
        )
        .all(projectId) as Row[]
    ).map(asRun);
  }

  upsertRunModule(input: {
    runId: string;
    moduleId: string;
    version: string;
    status: ModuleStatus;
    startedAt?: string | null;
    completedAt?: string | null;
    durationMs?: number | null;
    coverage?: number | null;
    error?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO run_modules
      (run_id,module_id,version,status,started_at,completed_at,duration_ms,coverage,error)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(run_id,module_id) DO UPDATE SET
        version=excluded.version,status=excluded.status,started_at=excluded.started_at,
        completed_at=excluded.completed_at,duration_ms=excluded.duration_ms,
        coverage=excluded.coverage,error=excluded.error`,
      )
      .run(
        input.runId,
        input.moduleId,
        input.version,
        input.status,
        input.startedAt ?? null,
        input.completedAt ?? null,
        input.durationMs ?? null,
        input.coverage ?? null,
        input.error ?? null,
      );
  }

  listRunModules(runId: string): RunModuleRecord[] {
    return (
      this.db
        .prepare("SELECT * FROM run_modules WHERE run_id=? ORDER BY module_id")
        .all(runId) as Row[]
    ).map((row) => ({
      runId: String(row.run_id),
      moduleId: String(row.module_id),
      version: String(row.version),
      status: row.status as ModuleStatus,
      startedAt: row.started_at === null ? null : String(row.started_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at),
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      coverage: row.coverage === null ? null : Number(row.coverage),
      error: row.error === null ? null : String(row.error),
    }));
  }

  appendRunEvent(
    runId: string,
    type: string,
    payload: Record<string, unknown> = {},
  ): RunEvent {
    const at = now();
    const result = this.db
      .prepare(
        "INSERT INTO job_events(run_id,type,at,payload_json) VALUES(?,?,?,?)",
      )
      .run(runId, type, at, JSON.stringify(payload));
    return { id: Number(result.lastInsertRowid), runId, type, at, payload };
  }

  listRunEvents(runId: string, after = 0): RunEvent[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM job_events WHERE run_id = ? AND id > ? ORDER BY id",
        )
        .all(runId, after) as Row[]
    ).map((row) => ({
      id: Number(row.id),
      runId: String(row.run_id),
      type: String(row.type),
      at: String(row.at),
      payload: json<Record<string, unknown>>(row.payload_json, {}),
    }));
  }

  replaceIssues(
    runId: string,
    projectId: string,
    issues: readonly IssueInstance[],
    options: { resolveMissing?: boolean } = {},
  ): void {
    this.transaction(() => {
      this.db
        .prepare("DELETE FROM issue_instances WHERE run_id = ?")
        .run(runId);
      const issueStatement = this.db.prepare(`INSERT INTO issues
        (fingerprint,rule_id,module_id,canonical_url,severity,title,description) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(fingerprint) DO UPDATE SET severity=excluded.severity,title=excluded.title,description=excluded.description`);
      const instanceStatement = this.db.prepare(`INSERT INTO issue_instances
        (run_id,fingerprint,project_id,evidence_json,first_seen_at,last_seen_at,status,
         severity_snapshot,title_snapshot,description_snapshot)
        VALUES(?,?,?,?,?,?,?,?,?,?)`);
      const adjudicationStatement = this.db.prepare(
        "SELECT status FROM issue_adjudications WHERE project_id=? AND fingerprint=?",
      );
      for (const issue of issues) {
        issueStatement.run(
          issue.fingerprint,
          issue.ruleId,
          issue.moduleId,
          issue.canonicalUrl,
          issue.severity,
          issue.title,
          issue.description,
        );
        const previous = this.db
          .prepare(
            `SELECT first_seen_at,status FROM issue_instances
          WHERE project_id=? AND fingerprint=? AND run_id<>? ORDER BY last_seen_at DESC LIMIT 1`,
          )
          .get(projectId, issue.fingerprint, runId) as Row | undefined;
        const previousStatus = previous?.status
          ? String(previous.status)
          : null;
        const adjudication = adjudicationStatement.get(
          projectId,
          issue.fingerprint,
        ) as Row | undefined;
        const status =
          adjudication?.status === "ignored" ||
          adjudication?.status === "false_positive"
            ? "open"
            : previousStatus === "ignored" ||
                previousStatus === "false_positive"
              ? previousStatus
              : "open";
        instanceStatement.run(
          runId,
          issue.fingerprint,
          projectId,
          JSON.stringify(issue.evidence),
          previous?.first_seen_at
            ? String(previous.first_seen_at)
            : issue.firstSeenAt,
          issue.lastSeenAt,
          status,
          issue.severity,
          issue.title,
          issue.description,
        );
      }
      if (options.resolveMissing) {
        const observed = new Set(issues.map((issue) => issue.fingerprint));
        const open = this.db
          .prepare(
            "SELECT DISTINCT fingerprint FROM issue_instances WHERE project_id=? AND status='open'",
          )
          .all(projectId) as Row[];
        const resolve = this.db.prepare(
          "UPDATE issue_instances SET status='resolved' WHERE project_id=? AND fingerprint=? AND status='open'",
        );
        for (const row of open) {
          const fingerprint = String(row.fingerprint);
          if (!observed.has(fingerprint)) resolve.run(projectId, fingerprint);
        }
      }
    });
  }

  listIssues(
    runId: string,
    options: { includeAdjudication?: boolean } = {},
  ): IssueInstance[] {
    const statusExpression =
      options.includeAdjudication === false
        ? "ii.status"
        : "COALESCE(ia.status,ii.status)";
    const rows = this.db
      .prepare(
        `SELECT i.*,
          COALESCE(ii.severity_snapshot,i.severity) AS effective_severity,
          COALESCE(ii.title_snapshot,i.title) AS effective_title,
          COALESCE(ii.description_snapshot,i.description) AS effective_description,
          ii.evidence_json,ii.first_seen_at,ii.last_seen_at,
          ${statusExpression} AS effective_status
      FROM issue_instances ii JOIN issues i ON i.fingerprint=ii.fingerprint
      LEFT JOIN issue_adjudications ia
        ON ia.project_id=ii.project_id AND ia.fingerprint=ii.fingerprint
      WHERE ii.run_id=? ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
      )
      .all(runId) as Row[];
    return rows.map((row) => ({
      fingerprint: String(row.fingerprint),
      ruleId: String(row.rule_id),
      moduleId: String(row.module_id),
      canonicalUrl:
        row.canonical_url === null ? null : String(row.canonical_url),
      severity: row.effective_severity as IssueInstance["severity"],
      title: String(row.effective_title),
      description: String(row.effective_description),
      evidence: json<IssueInstance["evidence"]>(row.evidence_json, []),
      firstSeenAt: String(row.first_seen_at),
      lastSeenAt: String(row.last_seen_at),
      status: row.effective_status as IssueInstance["status"],
    }));
  }

  private queryProjectIssueReviews(
    projectId: string,
    options: IssueReviewListOptions & { fingerprint?: string } = {},
  ): IssueReviewPage {
    const limit = Math.min(250, Math.max(1, Math.trunc(options.limit ?? 50)));
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const parameters: Array<string | number> = [projectId];
    const conditions: string[] = [];
    if (options.fingerprint) {
      conditions.push("fingerprint=?");
      parameters.push(options.fingerprint);
    }
    if (options.status) {
      conditions.push("effective_status=?");
      parameters.push(options.status);
    }
    if (options.severity) {
      conditions.push("severity=?");
      parameters.push(options.severity);
    }
    const search = options.search?.trim().toLowerCase();
    if (search) {
      const escaped = search
        .replaceAll("\\", "\\\\")
        .replaceAll("%", "\\%")
        .replaceAll("_", "\\_");
      conditions.push(`(
        lower(title) LIKE ? ESCAPE '\\' OR
        lower(description) LIKE ? ESCAPE '\\' OR
        lower(rule_id) LIKE ? ESCAPE '\\' OR
        lower(module_id) LIKE ? ESCAPE '\\' OR
        lower(COALESCE(canonical_url,'')) LIKE ? ESCAPE '\\' OR
        lower(fingerprint) LIKE ? ESCAPE '\\'
      )`);
      for (let index = 0; index < 6; index += 1)
        parameters.push(`%${escaped}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const cte = `WITH ranked AS (
      SELECT ii.*,
        ROW_NUMBER() OVER (
          PARTITION BY ii.fingerprint
          ORDER BY r.requested_at DESC,ii.last_seen_at DESC,ii.run_id DESC
        ) AS row_number,
        COUNT(*) OVER (PARTITION BY ii.fingerprint) AS occurrence_count
      FROM issue_instances ii
      JOIN runs r ON r.id=ii.run_id
      WHERE ii.project_id=?
    ), reviews AS (
      SELECT i.fingerprint,i.rule_id,i.module_id,i.canonical_url,
        COALESCE(ranked.severity_snapshot,i.severity) AS severity,
        COALESCE(ranked.title_snapshot,i.title) AS title,
        COALESCE(ranked.description_snapshot,i.description) AS description,
        ranked.project_id,ranked.run_id AS latest_run_id,
        ranked.evidence_json,ranked.first_seen_at,ranked.last_seen_at,
        ranked.occurrence_count,
        COALESCE(ia.status,ranked.status) AS effective_status,
        ia.status AS adjudication_status,ia.note AS adjudication_note,
        ia.actor AS adjudication_actor,
        ia.created_at AS adjudication_created_at,
        ia.updated_at AS adjudication_updated_at
      FROM ranked
      JOIN issues i ON i.fingerprint=ranked.fingerprint
      LEFT JOIN issue_adjudications ia
        ON ia.project_id=ranked.project_id AND ia.fingerprint=ranked.fingerprint
      WHERE ranked.row_number=1
    )`;
    const totalRow = this.db
      .prepare(`${cte} SELECT COUNT(*) AS total FROM reviews ${where}`)
      .get(...parameters) as Row | undefined;
    const rows = this.db
      .prepare(
        `${cte} SELECT * FROM reviews ${where}
        ORDER BY CASE severity
          WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
          WHEN 'low' THEN 3 ELSE 4 END,
          last_seen_at DESC,fingerprint
        LIMIT ? OFFSET ?`,
      )
      .all(...parameters, limit, offset) as Row[];
    return {
      items: rows.map(asIssueReview),
      total: Number(totalRow?.total ?? 0),
      offset,
      limit,
    };
  }

  listProjectIssueReviews(
    projectId: string,
    options: IssueReviewListOptions = {},
  ): IssueReviewPage {
    return this.queryProjectIssueReviews(projectId, options);
  }

  getProjectIssueReview(
    projectId: string,
    fingerprint: string,
  ): IssueReviewItem | null {
    return (
      this.queryProjectIssueReviews(projectId, {
        fingerprint,
        limit: 1,
      }).items[0] ?? null
    );
  }

  listIssueAdjudications(projectId: string): IssueAdjudication[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM issue_adjudications
          WHERE project_id=? ORDER BY updated_at,fingerprint`,
        )
        .all(projectId) as Row[]
    ).map((row) => ({
      projectId: String(row.project_id),
      fingerprint: String(row.fingerprint),
      status: row.status as IssueAdjudication["status"],
      note: row.note === null ? null : String(row.note),
      actor: String(row.actor),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  updateIssueAdjudication(
    projectId: string,
    fingerprint: string,
    input: {
      status: IssueAdjudicationStatus;
      note?: string | null;
      actor: string;
    },
  ): IssueReviewItem | null {
    const current = this.getProjectIssueReview(projectId, fingerprint);
    if (!current) return null;
    const timestamp = now();
    const note = input.note?.trim() || null;
    this.transaction(() => {
      if (input.status === "open") {
        this.db
          .prepare(
            "DELETE FROM issue_adjudications WHERE project_id=? AND fingerprint=?",
          )
          .run(projectId, fingerprint);
        this.db
          .prepare(
            `UPDATE issue_instances SET status='open'
            WHERE project_id=? AND fingerprint=?
              AND status IN ('ignored','false_positive')`,
          )
          .run(projectId, fingerprint);
      } else {
        this.db
          .prepare(
            `INSERT INTO issue_adjudications
            (project_id,fingerprint,status,note,actor,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(project_id,fingerprint) DO UPDATE SET
              status=excluded.status,note=excluded.note,actor=excluded.actor,
              updated_at=excluded.updated_at`,
          )
          .run(
            projectId,
            fingerprint,
            input.status,
            note,
            input.actor,
            timestamp,
            timestamp,
          );
      }
      this.db
        .prepare(
          `INSERT INTO audit_events
          (actor,action,entity_type,entity_id,at,payload_json)
          VALUES(?,?,?,?,?,?)`,
        )
        .run(
          input.actor,
          "issue.adjudication.update",
          "issue",
          fingerprint,
          timestamp,
          JSON.stringify({
            projectId,
            from: current.issue.status,
            to: input.status,
            notePresent: note !== null,
          }),
        );
    });
    return this.getProjectIssueReview(projectId, fingerprint);
  }

  private insertPageLinks(
    runId: string,
    pages: readonly PageLinkSourcePage[],
  ): void {
    const statement = this.db.prepare(`INSERT INTO page_links
      (run_id,source_url,target_url,target_page_url,occurrences,
       follow_occurrences,nofollow_occurrences,anchor_texts_json,placements_json)
      VALUES(?,?,?,?,?,?,?,?,?)`);
    for (const link of normalizedPageLinks(pages)) {
      statement.run(
        runId,
        link.sourceUrl,
        link.targetUrl,
        link.targetPageUrl,
        link.occurrences,
        link.followOccurrences,
        link.nofollowOccurrences,
        JSON.stringify(link.anchorTexts),
        JSON.stringify(link.placements),
      );
    }
  }

  replacePages(
    runId: string,
    pages: ReadonlyArray<{
      canonicalUrl: string;
      statusCode: number | null;
      title: string | null;
      indexable: boolean | null;
      payload?: Record<string, unknown>;
    }>,
  ): void {
    this.transaction(() => {
      this.db.prepare("DELETE FROM page_links WHERE run_id=?").run(runId);
      this.db.prepare("DELETE FROM pages WHERE run_id=?").run(runId);
      const statement = this.db.prepare(`INSERT INTO pages
        (run_id,canonical_url,status_code,title,indexable,payload_json) VALUES(?,?,?,?,?,?)`);
      for (const page of pages) {
        statement.run(
          runId,
          page.canonicalUrl,
          page.statusCode,
          page.title,
          page.indexable === null ? null : page.indexable ? 1 : 0,
          JSON.stringify(page.payload ?? {}),
        );
      }
      this.insertPageLinks(runId, pages);
    });
  }

  listPages(runId: string): StoredPageRecord[] {
    return (
      this.db
        .prepare("SELECT * FROM pages WHERE run_id=? ORDER BY canonical_url")
        .all(runId) as Row[]
    ).map((row) => ({
      canonicalUrl: String(row.canonical_url),
      statusCode: row.status_code === null ? null : Number(row.status_code),
      title: row.title === null ? null : String(row.title),
      indexable: row.indexable === null ? null : Boolean(row.indexable),
      payload: json<Record<string, unknown>>(row.payload_json, {}),
    }));
  }

  listPageLinkMetrics(runId: string): Map<string, StoredPageLinkMetrics> {
    const metrics = new Map<string, StoredPageLinkMetrics>();
    const pages = this.db
      .prepare(
        `SELECT canonical_url,
          CASE WHEN json_extract(payload_json,'$.linkGraphVersion')=1
            THEN 1 ELSE 0 END AS graph_available
         FROM pages WHERE run_id=? ORDER BY canonical_url`,
      )
      .all(runId) as Row[];
    for (const page of pages) {
      metrics.set(String(page.canonical_url), {
        state: Number(page.graph_available) === 1 ? "available" : "unavailable",
        inlinkSources: 0,
        inlinkOccurrences: 0,
        outlinkTargets: 0,
        outlinkOccurrences: 0,
      });
    }
    const outbound = this.db
      .prepare(
        `SELECT source_url,COUNT(*) AS targets,
          COALESCE(SUM(occurrences),0) AS occurrences
         FROM page_links WHERE run_id=? GROUP BY source_url`,
      )
      .all(runId) as Row[];
    for (const row of outbound) {
      const item = metrics.get(String(row.source_url));
      if (!item) continue;
      item.outlinkTargets = Number(row.targets);
      item.outlinkOccurrences = Number(row.occurrences);
    }
    const inbound = this.db
      .prepare(
        `SELECT target_page_url,COUNT(*) AS sources,
          COALESCE(SUM(occurrences),0) AS occurrences
         FROM page_links
         WHERE run_id=? AND target_page_url IS NOT NULL
         GROUP BY target_page_url`,
      )
      .all(runId) as Row[];
    for (const row of inbound) {
      const item = metrics.get(String(row.target_page_url));
      if (!item) continue;
      item.inlinkSources = Number(row.sources);
      item.inlinkOccurrences = Number(row.occurrences);
    }
    return metrics;
  }

  getRunLinkGraphSnapshot(runId: string): StoredRunLinkGraphSnapshot {
    const coverage = this.db
      .prepare(
        `SELECT COUNT(*) AS page_count,
          COALESCE(SUM(CASE
            WHEN json_extract(payload_json,'$.linkGraphVersion')=1 THEN 1
            ELSE 0 END),0) AS graph_page_count
         FROM pages WHERE run_id=?`,
      )
      .get(runId) as Row;
    const rows = this.db
      .prepare(
        `SELECT l.*,s.title AS source_title,t.title AS target_title,
          t.status_code AS target_status_code,t.indexable AS target_indexable
         FROM page_links l
         JOIN pages s ON s.run_id=l.run_id AND s.canonical_url=l.source_url
         LEFT JOIN pages t
           ON t.run_id=l.run_id AND t.canonical_url=l.target_page_url
         WHERE l.run_id=?
         ORDER BY l.source_url,l.target_url`,
      )
      .all(runId) as Row[];
    const items = rows.map<StoredPageLinkEdge>((row) => {
      const targetPageUrl =
        row.target_page_url === null ? null : String(row.target_page_url);
      const targetStatusCode =
        row.target_status_code === null ? null : Number(row.target_status_code);
      const targetState: StoredPageLinkEdge["targetState"] =
        targetStatusCode !== null && targetStatusCode >= 400
          ? "broken"
          : targetPageUrl === null
            ? "uncrawled"
            : String(row.target_url) !== targetPageUrl
              ? "redirected"
              : "direct";
      return {
        sourceUrl: String(row.source_url),
        sourceTitle:
          row.source_title === null ? null : String(row.source_title),
        targetUrl: String(row.target_url),
        targetPageUrl,
        targetTitle:
          row.target_title === null ? null : String(row.target_title),
        targetStatusCode,
        targetIndexable:
          row.target_indexable === null ? null : Boolean(row.target_indexable),
        targetState,
        occurrences: Number(row.occurrences),
        followOccurrences: Number(row.follow_occurrences),
        nofollowOccurrences: Number(row.nofollow_occurrences),
        anchorTexts: json<string[]>(row.anchor_texts_json, []),
        placements: json<StoredPageLinkEdge["placements"]>(
          row.placements_json,
          [],
        ),
      };
    });
    return {
      pageCount: Number(coverage.page_count),
      graphPageCount: Number(coverage.graph_page_count),
      items,
    };
  }

  getPageLinkExplorerData(
    runId: string,
    requestedPageUrl: string,
    options: {
      direction: InternalLinkDirection;
      limit: number;
      offset: number;
      search?: string;
    },
  ): StoredPageLinkExplorerData | null {
    const normalizedPageUrl = normalizedHttpUrl(requestedPageUrl);
    if (!normalizedPageUrl) return null;
    const pageRow = this.db
      .prepare(
        `SELECT * FROM pages
         WHERE run_id=? AND (
           canonical_url=? OR json_extract(payload_json,'$.sourceUrl')=?
         )
         ORDER BY CASE WHEN canonical_url=? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .get(runId, normalizedPageUrl, normalizedPageUrl, normalizedPageUrl) as
      Row | undefined;
    if (!pageRow) return null;
    const pageUrl = String(pageRow.canonical_url);
    const page: StoredPageRecord = {
      canonicalUrl: pageUrl,
      statusCode:
        pageRow.status_code === null ? null : Number(pageRow.status_code),
      title: pageRow.title === null ? null : String(pageRow.title),
      indexable: pageRow.indexable === null ? null : Boolean(pageRow.indexable),
      payload: json<Record<string, unknown>>(pageRow.payload_json, {}),
    };
    const coverage = this.db
      .prepare(
        `SELECT COUNT(*) AS page_count,
          COALESCE(SUM(CASE
            WHEN json_extract(payload_json,'$.linkGraphVersion')=1 THEN 1
            ELSE 0 END),0) AS graph_page_count
         FROM pages WHERE run_id=?`,
      )
      .get(runId) as Row;
    const inbound = this.db
      .prepare(
        `SELECT COUNT(*) AS sources,
          COALESCE(SUM(occurrences),0) AS occurrences,
          COALESCE(SUM(follow_occurrences),0) AS followed,
          COALESCE(SUM(nofollow_occurrences),0) AS nofollowed
         FROM page_links WHERE run_id=? AND target_page_url=?`,
      )
      .get(runId, pageUrl) as Row;
    const outbound = this.db
      .prepare(
        `SELECT COUNT(*) AS targets,
          COALESCE(SUM(l.occurrences),0) AS occurrences,
          COALESCE(SUM(l.follow_occurrences),0) AS followed,
          COALESCE(SUM(l.nofollow_occurrences),0) AS nofollowed,
          COALESCE(SUM(CASE WHEN t.status_code>=400 THEN 1 ELSE 0 END),0)
            AS broken,
          COALESCE(SUM(CASE
            WHEN l.target_page_url IS NOT NULL
             AND l.target_url<>l.target_page_url THEN 1 ELSE 0 END),0)
            AS redirected,
          COALESCE(SUM(CASE WHEN l.target_page_url IS NULL THEN 1 ELSE 0 END),0)
            AS uncrawled
         FROM page_links l
         LEFT JOIN pages t
           ON t.run_id=l.run_id AND t.canonical_url=l.target_page_url
         WHERE l.run_id=? AND l.source_url=?`,
      )
      .get(runId, pageUrl) as Row;

    const edgeCondition =
      options.direction === "outlinks"
        ? "l.source_url=?"
        : "l.target_page_url=?";
    const term = options.search?.trim().toLowerCase() ?? "";
    const searchCondition = term
      ? ` AND (
          instr(lower(l.source_url),?)>0 OR
          instr(lower(l.target_url),?)>0 OR
          instr(lower(COALESCE(s.title,'')),?)>0 OR
          instr(lower(COALESCE(t.title,'')),?)>0 OR
          instr(lower(l.anchor_texts_json),?)>0
        )`
      : "";
    const baseParams: SQLInputValue[] = [runId, pageUrl];
    if (term) baseParams.push(term, term, term, term, term);
    const from = `FROM page_links l
      JOIN pages s ON s.run_id=l.run_id AND s.canonical_url=l.source_url
      LEFT JOIN pages t
        ON t.run_id=l.run_id AND t.canonical_url=l.target_page_url
      WHERE l.run_id=? AND ${edgeCondition}${searchCondition}`;
    const count = this.db
      .prepare(`SELECT COUNT(*) AS total ${from}`)
      .get(...baseParams) as Row;
    const rows = this.db
      .prepare(
        `SELECT l.*,s.title AS source_title,t.title AS target_title,
          t.status_code AS target_status_code,t.indexable AS target_indexable
         ${from}
         ORDER BY
          CASE
            WHEN t.status_code>=400 THEN 0
            WHEN l.target_page_url IS NOT NULL
             AND l.target_url<>l.target_page_url THEN 1
            WHEN l.target_page_url IS NULL THEN 2
            ELSE 3
          END,
          ${options.direction === "outlinks" ? "l.target_url" : "l.source_url"}
         LIMIT ? OFFSET ?`,
      )
      .all(...baseParams, options.limit, options.offset) as Row[];
    const items = rows.map<StoredPageLinkEdge>((row) => {
      const targetPageUrl =
        row.target_page_url === null ? null : String(row.target_page_url);
      const targetStatusCode =
        row.target_status_code === null ? null : Number(row.target_status_code);
      const targetState: StoredPageLinkEdge["targetState"] =
        targetStatusCode !== null && targetStatusCode >= 400
          ? "broken"
          : targetPageUrl === null
            ? "uncrawled"
            : String(row.target_url) !== targetPageUrl
              ? "redirected"
              : "direct";
      return {
        sourceUrl: String(row.source_url),
        sourceTitle:
          row.source_title === null ? null : String(row.source_title),
        targetUrl: String(row.target_url),
        targetPageUrl,
        targetTitle:
          row.target_title === null ? null : String(row.target_title),
        targetStatusCode,
        targetIndexable:
          row.target_indexable === null ? null : Boolean(row.target_indexable),
        targetState,
        occurrences: Number(row.occurrences),
        followOccurrences: Number(row.follow_occurrences),
        nofollowOccurrences: Number(row.nofollow_occurrences),
        anchorTexts: json<string[]>(row.anchor_texts_json, []),
        placements: json<StoredPageLinkEdge["placements"]>(
          row.placements_json,
          [],
        ),
      };
    });
    return {
      page,
      items,
      total: Number(count.total),
      pageCount: Number(coverage.page_count),
      graphPageCount: Number(coverage.graph_page_count),
      summary: {
        inlinkSources: Number(inbound.sources),
        inlinkOccurrences: Number(inbound.occurrences),
        outlinkTargets: Number(outbound.targets),
        outlinkOccurrences: Number(outbound.occurrences),
        followedInlinkOccurrences: Number(inbound.followed),
        nofollowInlinkOccurrences: Number(inbound.nofollowed),
        followedOutlinkOccurrences: Number(outbound.followed),
        nofollowOutlinkOccurrences: Number(outbound.nofollowed),
        brokenOutlinkTargets: Number(outbound.broken),
        redirectedOutlinkTargets: Number(outbound.redirected),
        uncrawledOutlinkTargets: Number(outbound.uncrawled),
      },
    };
  }

  listPageEvidence(
    runId: string,
    options: {
      section: RunEvidenceSection;
      limit: number;
      offset: number;
      search?: string;
    },
  ): StoredPageEvidencePage {
    const sectionCondition: Record<RunEvidenceSection, string> = {
      crawl: "1=1",
      redirects:
        "COALESCE(json_array_length(json_extract(payload_json,'$.redirectChain')),0)>0",
      hreflang:
        "COALESCE(json_array_length(json_extract(payload_json,'$.hreflang.alternates')),0)>0",
      extractions:
        "COALESCE(json_array_length(json_extract(payload_json,'$.extractions')),0)>0",
    };
    const term = options.search?.trim().toLowerCase() ?? "";
    const searchCondition = term
      ? ` AND (
          instr(lower(canonical_url),?)>0 OR
          instr(lower(COALESCE(title,'')),?)>0 OR
          instr(lower(COALESCE(json_extract(payload_json,'$.sourceUrl'),'')),?)>0
        )`
      : "";
    const params = term ? [runId, term, term, term] : [runId];
    const where = `run_id=? AND (${sectionCondition[options.section]})${searchCondition}`;
    const count = this.db
      .prepare(`SELECT COUNT(*) AS total FROM pages WHERE ${where}`)
      .get(...params) as Row;
    const rows = this.db
      .prepare(
        `SELECT * FROM pages WHERE ${where}
         ORDER BY canonical_url LIMIT ? OFFSET ?`,
      )
      .all(...params, options.limit, options.offset) as Row[];
    const coverage = this.db
      .prepare(
        `SELECT COUNT(*) AS page_count,
          COALESCE(SUM(CASE WHEN json_extract(payload_json,'$.evidenceVersion')=1 THEN 1 ELSE 0 END),0) AS evidence_page_count
         FROM pages WHERE run_id=?`,
      )
      .get(runId) as Row;
    return {
      pages: rows.map((row) => ({
        canonicalUrl: String(row.canonical_url),
        statusCode: row.status_code === null ? null : Number(row.status_code),
        title: row.title === null ? null : String(row.title),
        indexable: row.indexable === null ? null : Boolean(row.indexable),
        payload: json<Record<string, unknown>>(row.payload_json, {}),
      })),
      total: Number(count.total),
      pageCount: Number(coverage.page_count),
      evidencePageCount: Number(coverage.evidence_page_count),
    };
  }

  upsertActions(actions: readonly Action[]): void {
    const statement = this.db.prepare(`INSERT INTO actions
      (id,project_id,rule_id,module_id,issue_fingerprint,title,why_now,impact,effort,confidence,priority_score,score_version,score_inputs_json,affected_urls_json,owner,status,verification,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT DO UPDATE SET
        id=excluded.id,rule_id=excluded.rule_id,module_id=excluded.module_id,issue_fingerprint=excluded.issue_fingerprint,
        title=excluded.title,why_now=excluded.why_now,impact=excluded.impact,effort=excluded.effort,
        confidence=excluded.confidence,priority_score=excluded.priority_score,score_inputs_json=excluded.score_inputs_json,
        affected_urls_json=excluded.affected_urls_json,
        status=CASE WHEN actions.status='resolved' THEN 'open' ELSE actions.status END,
        verification=CASE WHEN actions.status='resolved' OR actions.verification='verified' THEN 'regressed' ELSE actions.verification END,
        updated_at=excluded.updated_at`);
    this.transaction(() => {
      for (const action of actions) {
        statement.run(
          action.id,
          action.projectId,
          action.ruleId ?? null,
          action.moduleId ?? null,
          action.issueFingerprint ?? null,
          action.title,
          action.whyNow,
          action.impact,
          action.effort,
          action.confidence,
          action.priorityScore,
          action.scoreVersion,
          JSON.stringify(action.scoreInputs),
          JSON.stringify(action.affectedUrls),
          action.owner,
          action.status,
          action.verification,
          action.createdAt,
          action.updatedAt,
        );
      }
    });
  }

  listActions(
    projectId?: string,
    options: { includeAdjudicated?: boolean } = {},
  ): Action[] {
    const rows = projectId
      ? this.db
          .prepare(
            `SELECT * FROM actions WHERE project_id=?
            ORDER BY priority_score DESC,updated_at DESC`,
          )
          .all(projectId)
      : this.db
          .prepare(
            `SELECT * FROM actions
            ORDER BY priority_score DESC,updated_at DESC LIMIT 500`,
          )
          .all();
    const actions = (rows as Row[]).map(asAction);
    if (options.includeAdjudicated) return actions;

    const scopes = this.listActionIssueScopes(projectId);
    return actions.flatMap((action) => {
      const scope = scopes.get(action.id);
      if (scope && scope.currentInstances > 0) {
        if (scope.visibleInstances === 0) return [];
        if (scope.visibleInstances < scope.currentInstances) {
          const count = scope.visibleInstances;
          return [
            {
              ...action,
              affectedUrls: scope.visibleUrls,
              whyNow: action.whyNow.replace(
                /^\d+ affected URLs?\./u,
                `${count} affected URL${count === 1 ? "" : "s"}.`,
              ),
            },
          ];
        }
        return [action];
      }
      if (
        action.issueFingerprint &&
        this.hasIssueAdjudication(action.projectId, action.issueFingerprint)
      ) {
        return [];
      }
      return [action];
    });
  }

  listActionIssueScopes(projectId?: string): Map<string, ActionIssueScope> {
    const projectFilter = projectId ? "WHERE a.project_id=?" : "";
    const rows = this.db
      .prepare(
        `WITH action_runs AS (
          SELECT DISTINCT aii.action_id,aii.run_id,r.requested_at
          FROM action_issue_instances aii
          JOIN actions a ON a.id=aii.action_id
          JOIN runs r ON r.id=aii.run_id
          ${projectFilter}
        ), latest_runs AS (
          SELECT action_id,run_id,
            ROW_NUMBER() OVER (
              PARTITION BY action_id
              ORDER BY requested_at DESC,run_id DESC
            ) AS row_number
          FROM action_runs
        )
        SELECT aii.action_id,aii.lifecycle,i.canonical_url,
          ia.fingerprint AS adjudicated_fingerprint
        FROM latest_runs latest
        JOIN action_issue_instances aii
          ON aii.action_id=latest.action_id AND aii.run_id=latest.run_id
        JOIN actions a ON a.id=aii.action_id
        JOIN issues i ON i.fingerprint=aii.fingerprint
        LEFT JOIN issue_adjudications ia
          ON ia.project_id=a.project_id AND ia.fingerprint=aii.fingerprint
        WHERE latest.row_number=1
        ORDER BY aii.action_id,i.canonical_url,aii.fingerprint`,
      )
      .all(...(projectId ? [projectId] : [])) as Row[];
    const scopes = new Map<string, ActionIssueScope>();
    for (const row of rows) {
      const actionId = String(row.action_id);
      const scope = scopes.get(actionId) ?? {
        actionId,
        currentInstances: 0,
        visibleInstances: 0,
        visibleUrls: [],
      };
      scopes.set(actionId, scope);
      if (row.lifecycle === "resolved") continue;
      scope.currentInstances += 1;
      if (row.adjudicated_fingerprint !== null) continue;
      scope.visibleInstances += 1;
      if (row.canonical_url !== null) {
        const canonicalUrl = String(row.canonical_url);
        if (!scope.visibleUrls.includes(canonicalUrl))
          scope.visibleUrls.push(canonicalUrl);
      }
    }
    return scopes;
  }

  hasIssueAdjudication(projectId: string, fingerprint: string): boolean {
    return Boolean(
      this.db
        .prepare(
          `SELECT 1 FROM issue_adjudications
          WHERE project_id=? AND fingerprint=? LIMIT 1`,
        )
        .get(projectId, fingerprint),
    );
  }

  getAction(id: string): Action | null {
    const row = this.db.prepare("SELECT * FROM actions WHERE id=?").get(id) as
      Row | undefined;
    return row ? asAction(row) : null;
  }

  replaceActionIssueLinks(
    runId: string,
    projectId: string,
    actions: readonly Action[],
    issues: readonly IssueInstance[],
    options: { resolveMissing?: boolean } = {},
  ): void {
    const previousRun = this.db
      .prepare(
        `SELECT id FROM runs
        WHERE project_id=? AND id<>? AND workflow_id='audit'
          AND status IN ('succeeded','partial')
        ORDER BY requested_at DESC LIMIT 1`,
      )
      .get(projectId, runId) as Row | undefined;
    const previousRunId = previousRun ? String(previousRun.id) : null;
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO action_issue_instances
      (action_id,run_id,fingerprint,lifecycle,observed_at)
      VALUES(?,?,?,?,?)`,
    );
    this.transaction(() => {
      this.db
        .prepare("DELETE FROM action_issue_instances WHERE run_id=?")
        .run(runId);
      for (const action of actions) {
        const matches = issues.filter((issue) =>
          action.ruleId && action.moduleId
            ? issue.ruleId === action.ruleId &&
              issue.moduleId === action.moduleId
            : issue.fingerprint === action.issueFingerprint,
        );
        const current = new Set(matches.map((issue) => issue.fingerprint));
        const previous = previousRunId
          ? (this.db
              .prepare(
                `SELECT fingerprint FROM action_issue_instances
                WHERE action_id=? AND run_id=? AND lifecycle<>'resolved'`,
              )
              .all(action.id, previousRunId) as Row[])
          : [];
        const previousFingerprints = new Set(
          previous.map((row) => String(row.fingerprint)),
        );
        for (const issue of matches) {
          const seenBefore = this.db
            .prepare(
              `SELECT 1 FROM action_issue_instances
              WHERE action_id=? AND fingerprint=? AND run_id<>?
              AND lifecycle<>'resolved' LIMIT 1`,
            )
            .get(action.id, issue.fingerprint, runId);
          const lifecycle: ActionOccurrenceLifecycle = previousFingerprints.has(
            issue.fingerprint,
          )
            ? "persistent"
            : seenBefore
              ? "reappeared"
              : "new";
          insert.run(
            action.id,
            runId,
            issue.fingerprint,
            lifecycle,
            issue.lastSeenAt,
          );
        }
        if (options.resolveMissing && previousRunId) {
          for (const row of previous) {
            const fingerprint = String(row.fingerprint);
            if (current.has(fingerprint)) continue;
            insert.run(action.id, runId, fingerprint, "resolved", now());
          }
        }
      }
    });
  }

  listActionIssueLinks(actionId: string): ActionIssueLinkRecord[] {
    const rows = this.db
      .prepare(
        `SELECT aii.*,i.rule_id,i.module_id,i.canonical_url,i.severity,
          i.title,i.description,
          ii.evidence_json,ii.first_seen_at,ii.last_seen_at,
          COALESCE(ia.status,ii.status) AS status
        FROM action_issue_instances aii
        JOIN actions a ON a.id=aii.action_id
        JOIN issues i ON i.fingerprint=aii.fingerprint
        LEFT JOIN issue_instances ii
          ON ii.run_id=aii.run_id AND ii.fingerprint=aii.fingerprint
        LEFT JOIN issue_adjudications ia
          ON ia.project_id=a.project_id AND ia.fingerprint=aii.fingerprint
        WHERE aii.action_id=?
        ORDER BY aii.observed_at DESC,aii.fingerprint`,
      )
      .all(actionId) as Row[];
    return rows.map((row) => {
      const fallback = this.db
        .prepare(
          `SELECT ii.evidence_json,ii.first_seen_at,ii.last_seen_at,
            COALESCE(ia.status,ii.status) AS status
          FROM issue_instances ii
          JOIN actions a ON a.id=?
          LEFT JOIN issue_adjudications ia
            ON ia.project_id=a.project_id AND ia.fingerprint=ii.fingerprint
          WHERE ii.fingerprint=?
          ORDER BY ii.last_seen_at DESC LIMIT 1`,
        )
        .get(actionId, String(row.fingerprint)) as Row | undefined;
      const instance = row.first_seen_at === null ? fallback : row;
      return {
        actionId: String(row.action_id),
        runId: String(row.run_id),
        fingerprint: String(row.fingerprint),
        lifecycle: row.lifecycle as ActionOccurrenceLifecycle,
        observedAt: String(row.observed_at),
        issue: {
          fingerprint: String(row.fingerprint),
          ruleId: String(row.rule_id),
          moduleId: String(row.module_id),
          canonicalUrl:
            row.canonical_url === null ? null : String(row.canonical_url),
          severity: row.severity as IssueInstance["severity"],
          title: String(row.title),
          description: String(row.description),
          evidence: json<IssueInstance["evidence"]>(
            instance?.evidence_json,
            [],
          ),
          firstSeenAt: String(instance?.first_seen_at ?? row.observed_at),
          lastSeenAt: String(instance?.last_seen_at ?? row.observed_at),
          status: (instance?.status ??
            (row.lifecycle === "resolved"
              ? "resolved"
              : "open")) as IssueInstance["status"],
        },
      };
    });
  }

  createActionCheckpoint(input: {
    actionId: string;
    projectId: string;
    baselineRunId: string;
    baselineSnapshot: Record<string, unknown>;
    targetUrls: readonly string[];
    controlUrls?: readonly string[];
    cohortMatching?: Record<string, unknown>;
  }): StoredActionCheckpoint {
    const timestamp = now();
    const id = randomUUID();
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO action_checkpoints
          (id,action_id,project_id,baseline_run_id,state,baseline_snapshot_json,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.actionId,
          input.projectId,
          input.baselineRunId,
          "active",
          JSON.stringify(input.baselineSnapshot),
          timestamp,
          timestamp,
        );
      const cohort = this.db.prepare(
        `INSERT INTO action_cohorts(checkpoint_id,kind,urls_json,matching_json)
        VALUES(?,?,?,?)`,
      );
      cohort.run(
        id,
        "target",
        JSON.stringify([...input.targetUrls]),
        JSON.stringify({ source: "action_affected_urls" }),
      );
      cohort.run(
        id,
        "control",
        JSON.stringify([...(input.controlUrls ?? [])]),
        JSON.stringify(input.cohortMatching ?? {}),
      );
      const observation = this.db.prepare(
        `INSERT INTO action_observations
        (id,checkpoint_id,window_days,state,limitations_json)
        VALUES(?,?,?,?,?)`,
      );
      for (const windowDays of [7, 14, 28] as const) {
        observation.run(
          randomUUID(),
          id,
          windowDays,
          "pending",
          JSON.stringify([
            "Business outcomes are observational and remain separate from the technical verdict.",
          ]),
        );
      }
    });
    return this.getActionCheckpoint(id)!;
  }

  getActionCheckpoint(id: string): StoredActionCheckpoint | null {
    const row = this.db
      .prepare("SELECT * FROM action_checkpoints WHERE id=?")
      .get(id) as Row | undefined;
    if (!row) return null;
    const cohorts = this.db
      .prepare("SELECT * FROM action_cohorts WHERE checkpoint_id=?")
      .all(id) as Row[];
    const target = cohorts.find((entry) => entry.kind === "target");
    const control = cohorts.find((entry) => entry.kind === "control");
    return {
      id: String(row.id),
      actionId: String(row.action_id),
      projectId: String(row.project_id),
      baselineRunId: String(row.baseline_run_id),
      state: row.state as ActionCheckpoint["state"],
      baselineSnapshot: json<Record<string, unknown>>(
        row.baseline_snapshot_json,
        {},
      ),
      targetUrls: json<string[]>(target?.urls_json, []),
      controlUrls: json<string[]>(control?.urls_json, []),
      cohortMatching: json<Record<string, unknown>>(control?.matching_json, {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  latestActionCheckpoint(actionId: string): StoredActionCheckpoint | null {
    const row = this.db
      .prepare(
        "SELECT id FROM action_checkpoints WHERE action_id=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(actionId) as Row | undefined;
    return row ? this.getActionCheckpoint(String(row.id)) : null;
  }

  createActionVerification(input: {
    checkpointId: string;
    idempotencyKey: string;
    runId?: string | null;
  }): StoredActionVerification {
    const existing = this.db
      .prepare(
        "SELECT id FROM action_verifications WHERE checkpoint_id=? AND idempotency_key=?",
      )
      .get(input.checkpointId, input.idempotencyKey) as Row | undefined;
    if (existing) return this.getActionVerification(String(existing.id))!;
    const id = randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO action_verifications
          (id,checkpoint_id,run_id,idempotency_key,state,requested_at,updated_at)
          VALUES(?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.checkpointId,
          input.runId ?? null,
          input.idempotencyKey,
          "queued",
          timestamp,
          timestamp,
        );
      this.db
        .prepare(
          "UPDATE action_checkpoints SET state='verification_queued',updated_at=? WHERE id=?",
        )
        .run(timestamp, input.checkpointId);
    });
    return this.getActionVerification(id)!;
  }

  getActionVerification(id: string): StoredActionVerification | null {
    const row = this.db
      .prepare("SELECT * FROM action_verifications WHERE id=?")
      .get(id) as Row | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      state: row.state as ActionVerification["state"],
      checkpointId: String(row.checkpoint_id),
      runId: row.run_id === null ? null : String(row.run_id),
      coverage: row.coverage === null ? null : Number(row.coverage),
      checkedAt: row.checked_at === null ? null : String(row.checked_at),
      reason: row.reason === null ? null : String(row.reason),
      idempotencyKey: String(row.idempotency_key),
      evidence: json<Array<Record<string, unknown>>>(row.evidence_json, []),
      requestedAt: String(row.requested_at),
      updatedAt: String(row.updated_at),
    };
  }

  latestActionVerification(actionId: string): StoredActionVerification | null {
    const row = this.db
      .prepare(
        `SELECT av.id FROM action_verifications av
        JOIN action_checkpoints ac ON ac.id=av.checkpoint_id
        WHERE ac.action_id=? ORDER BY av.requested_at DESC LIMIT 1`,
      )
      .get(actionId) as Row | undefined;
    return row ? this.getActionVerification(String(row.id)) : null;
  }

  attachActionVerificationRun(verificationId: string, runId: string): void {
    this.db
      .prepare(
        "UPDATE action_verifications SET run_id=?,state='queued',updated_at=? WHERE id=?",
      )
      .run(runId, now(), verificationId);
  }

  markActionVerificationRunning(runId: string): void {
    this.db
      .prepare(
        "UPDATE action_verifications SET state='running',updated_at=? WHERE run_id=? AND state='queued'",
      )
      .run(now(), runId);
  }

  completeActionVerification(input: {
    runId: string;
    state: "verified" | "regressed" | "inconclusive";
    coverage: number | null;
    reason: string | null;
    evidence?: Array<Record<string, unknown>>;
  }): StoredActionVerification | null {
    const timestamp = now();
    const row = this.db
      .prepare(
        "SELECT id,checkpoint_id FROM action_verifications WHERE run_id=?",
      )
      .get(input.runId) as Row | undefined;
    if (!row) return null;
    this.transaction(() => {
      this.db
        .prepare(
          `UPDATE action_verifications SET
          state=?,coverage=?,checked_at=?,reason=?,evidence_json=?,updated_at=?
          WHERE id=?`,
        )
        .run(
          input.state,
          input.coverage,
          timestamp,
          input.reason,
          JSON.stringify(input.evidence ?? []),
          timestamp,
          String(row.id),
        );
      const checkpointState =
        input.state === "verified"
          ? "technically_verified"
          : input.state === "regressed"
            ? "regressed"
            : "inconclusive";
      this.db
        .prepare(
          "UPDATE action_checkpoints SET state=?,updated_at=? WHERE id=?",
        )
        .run(checkpointState, timestamp, String(row.checkpoint_id));
    });
    return this.getActionVerification(String(row.id));
  }

  listActionObservations(checkpointId: string): ActionOutcomeObservation[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM action_observations WHERE checkpoint_id=? ORDER BY window_days",
        )
        .all(checkpointId) as Row[]
    ).map((row) => ({
      id: String(row.id),
      checkpointId: String(row.checkpoint_id),
      windowDays: Number(row.window_days) as 7 | 14 | 28,
      state: row.state as ActionOutcomeObservation["state"],
      period:
        row.period_start === null || row.period_end === null
          ? null
          : { start: String(row.period_start), end: String(row.period_end) },
      targetChange:
        row.target_change === null ? null : Number(row.target_change),
      controlChange:
        row.control_change === null ? null : Number(row.control_change),
      controlAdjustedChange:
        row.control_adjusted_change === null
          ? null
          : Number(row.control_adjusted_change),
      confidence: row.confidence === null ? null : Number(row.confidence),
      limitations: json<string[]>(row.limitations_json, []),
      observedAt: row.observed_at === null ? null : String(row.observed_at),
    }));
  }

  resolveMissingActions(
    projectId: string,
    openActionIds: readonly string[],
    updatedAt = now(),
  ): number {
    const open = new Set(openActionIds);
    const candidates = this.db
      .prepare(
        `SELECT id FROM actions
      WHERE project_id=? AND issue_fingerprint IS NOT NULL
        AND (status<>'resolved' OR verification<>'verified')`,
      )
      .all(projectId) as Row[];
    const update = this.db.prepare(
      "UPDATE actions SET status='resolved',verification='verified',updated_at=? WHERE id=?",
    );
    return this.transaction(() => {
      let changed = 0;
      for (const row of candidates) {
        if (open.has(String(row.id))) continue;
        changed += Number(update.run(updatedAt, String(row.id)).changes);
      }
      return changed;
    });
  }

  upsertMetric(
    projectId: string,
    runId: string | null,
    key: string,
    metric: MetricValue,
  ): void {
    this.db
      .prepare(
        `INSERT INTO metrics(project_id,run_id,key,value,state,source,observed_at,coverage,note)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(project_id,run_id,key,source) DO UPDATE SET
        value=excluded.value,state=excluded.state,observed_at=excluded.observed_at,coverage=excluded.coverage,note=excluded.note`,
      )
      .run(
        projectId,
        runId,
        key,
        metric.value,
        metric.state,
        metric.source,
        metric.observedAt,
        metric.coverage,
        metric.note ?? null,
      );
  }

  latestMetrics(projectId: string): Record<string, MetricValue> {
    const rows = this.db
      .prepare(
        `SELECT m.* FROM metrics m
      JOIN (SELECT key,MAX(id) AS max_id FROM metrics WHERE project_id=? GROUP BY key) latest ON latest.max_id=m.id`,
      )
      .all(projectId) as Row[];
    return Object.fromEntries(
      rows.map((row) => [
        String(row.key),
        {
          value: row.value === null ? null : Number(row.value),
          state: row.state as MetricValue["state"],
          source: String(row.source),
          observedAt: row.observed_at === null ? null : String(row.observed_at),
          coverage: row.coverage === null ? null : Number(row.coverage),
          ...(row.note ? { note: String(row.note) } : {}),
        },
      ]),
    );
  }

  listMetricHistory(projectId: string): ProjectBundleMetric[] {
    return (
      this.db
        .prepare("SELECT * FROM metrics WHERE project_id=? ORDER BY id ASC")
        .all(projectId) as Row[]
    ).map((row) => ({
      runId: row.run_id === null ? null : String(row.run_id),
      key: String(row.key),
      metric: {
        value: row.value === null ? null : Number(row.value),
        state: row.state as MetricValue["state"],
        source: String(row.source),
        observedAt: row.observed_at === null ? null : String(row.observed_at),
        coverage: row.coverage === null ? null : Number(row.coverage),
        ...(row.note === null ? {} : { note: String(row.note) }),
      },
    }));
  }

  replacePerformanceData(input: {
    runId: string;
    projectId: string;
    windows: readonly PerformanceWindowRecord[];
    pages: readonly PagePerformanceRecord[];
    queries: readonly QueryPerformanceRecord[];
  }): void {
    this.transaction(() => {
      this.db
        .prepare("DELETE FROM performance_windows WHERE run_id=?")
        .run(input.runId);
      this.db
        .prepare("DELETE FROM page_performance WHERE run_id=?")
        .run(input.runId);
      this.db
        .prepare("DELETE FROM query_performance WHERE run_id=?")
        .run(input.runId);
      const windowStatement = this.db.prepare(
        `INSERT INTO performance_windows
        (run_id,project_id,source,period,start_date,end_date,fetched_at,state,row_count,row_limit,truncated,coverage,note)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const window of input.windows) {
        windowStatement.run(
          window.runId,
          window.projectId,
          window.source,
          window.period,
          window.startDate,
          window.endDate,
          window.fetchedAt,
          window.state,
          window.rowCount,
          window.rowLimit,
          window.truncated ? 1 : 0,
          window.coverage,
          window.note,
        );
      }
      const pageStatement = this.db.prepare(
        `INSERT INTO page_performance
        (run_id,project_id,period,canonical_url,crawl_matched,clicks,impressions,ctr,position,sessions,page_views,engagement_rate,key_events)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const page of input.pages) {
        pageStatement.run(
          page.runId,
          page.projectId,
          page.period,
          page.canonicalUrl,
          page.crawlMatched ? 1 : 0,
          page.clicks,
          page.impressions,
          page.ctr,
          page.position,
          page.sessions,
          page.pageViews,
          page.engagementRate,
          page.keyEvents,
        );
      }
      const queryStatement = this.db.prepare(
        `INSERT INTO query_performance
        (run_id,project_id,period,query,canonical_url,clicks,impressions,ctr,position)
        VALUES(?,?,?,?,?,?,?,?,?)`,
      );
      for (const query of input.queries) {
        queryStatement.run(
          query.runId,
          query.projectId,
          query.period,
          query.query,
          query.canonicalUrl,
          query.clicks,
          query.impressions,
          query.ctr,
          query.position,
        );
      }
    });
  }

  listPerformanceWindows(runId: string): PerformanceWindowRecord[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM performance_windows WHERE run_id=? ORDER BY source,period",
        )
        .all(runId) as Row[]
    ).map((row) => ({
      runId: String(row.run_id),
      projectId: String(row.project_id),
      source: row.source as PerformanceWindowRecord["source"],
      period: row.period as PerformanceWindowRecord["period"],
      startDate: String(row.start_date),
      endDate: String(row.end_date),
      fetchedAt: String(row.fetched_at),
      state: row.state as PerformanceWindowRecord["state"],
      rowCount: Number(row.row_count),
      rowLimit: row.row_limit === null ? null : Number(row.row_limit),
      truncated: Boolean(row.truncated),
      coverage: row.coverage === null ? null : Number(row.coverage),
      note: row.note === null ? null : String(row.note),
    }));
  }

  listPagePerformance(
    runId: string,
    period?: "current" | "previous",
  ): PagePerformanceRecord[] {
    const rows = period
      ? this.db
          .prepare(
            "SELECT * FROM page_performance WHERE run_id=? AND period=? ORDER BY canonical_url",
          )
          .all(runId, period)
      : this.db
          .prepare(
            "SELECT * FROM page_performance WHERE run_id=? ORDER BY period,canonical_url",
          )
          .all(runId);
    return (rows as Row[]).map((row) => ({
      runId: String(row.run_id),
      projectId: String(row.project_id),
      period: row.period as PagePerformanceRecord["period"],
      canonicalUrl: String(row.canonical_url),
      crawlMatched: Boolean(row.crawl_matched),
      clicks: row.clicks === null ? null : Number(row.clicks),
      impressions: row.impressions === null ? null : Number(row.impressions),
      ctr: row.ctr === null ? null : Number(row.ctr),
      position: row.position === null ? null : Number(row.position),
      sessions: row.sessions === null ? null : Number(row.sessions),
      pageViews: row.page_views === null ? null : Number(row.page_views),
      engagementRate:
        row.engagement_rate === null ? null : Number(row.engagement_rate),
      keyEvents: row.key_events === null ? null : Number(row.key_events),
    }));
  }

  listQueryPerformance(
    runId: string,
    period?: "current" | "previous",
  ): QueryPerformanceRecord[] {
    const rows = period
      ? this.db
          .prepare(
            "SELECT * FROM query_performance WHERE run_id=? AND period=? ORDER BY impressions DESC,query",
          )
          .all(runId, period)
      : this.db
          .prepare(
            "SELECT * FROM query_performance WHERE run_id=? ORDER BY period,impressions DESC,query",
          )
          .all(runId);
    return (rows as Row[]).map((row) => ({
      runId: String(row.run_id),
      projectId: String(row.project_id),
      period: row.period as QueryPerformanceRecord["period"],
      query: String(row.query),
      canonicalUrl: String(row.canonical_url),
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
      ctr: Number(row.ctr),
      position: Number(row.position),
    }));
  }

  updateAction(id: string, patch: UpdateActionInput): Action | null {
    const row = this.db.prepare("SELECT * FROM actions WHERE id=?").get(id) as
      Row | undefined;
    if (!row) return null;
    const current = asAction(row);
    const next = { ...current, ...patch, updatedAt: now() };
    this.db
      .prepare(
        "UPDATE actions SET owner=?,status=?,verification=?,updated_at=? WHERE id=?",
      )
      .run(next.owner, next.status, next.verification, next.updatedAt, id);
    return asAction(
      this.db.prepare("SELECT * FROM actions WHERE id=?").get(id) as Row,
    );
  }

  listIntegrations(): Integration[] {
    return (
      this.db
        .prepare("SELECT * FROM integrations ORDER BY label")
        .all() as Row[]
    ).map((row) => ({
      provider: String(row.provider),
      label: String(row.label),
      status: row.status as Integration["status"],
      ...(row.secret_ref ? { secretRef: String(row.secret_ref) } : {}),
      maskedIdentifier:
        row.masked_identifier === null ? null : String(row.masked_identifier),
      scopes: json<string[]>(row.scopes_json, []),
      lastSyncAt: row.last_sync_at === null ? null : String(row.last_sync_at),
      nextSyncAt: row.next_sync_at === null ? null : String(row.next_sync_at),
      expiresAt: row.expires_at === null ? null : String(row.expires_at),
      quota: json<Integration["quota"]>(row.quota_json, null),
      ...(Object.keys(json<Record<string, unknown>>(row.config_json, {}))
        .length > 0
        ? { configuration: json<Record<string, unknown>>(row.config_json, {}) }
        : {}),
    }));
  }

  upsertIntegration(integration: Integration): void {
    this.db
      .prepare(
        `INSERT INTO integrations
      (provider,label,status,secret_ref,masked_identifier,scopes_json,last_sync_at,next_sync_at,expires_at,quota_json,config_json,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provider) DO UPDATE SET
        label=excluded.label,status=excluded.status,secret_ref=excluded.secret_ref,
        masked_identifier=excluded.masked_identifier,scopes_json=excluded.scopes_json,
        last_sync_at=excluded.last_sync_at,next_sync_at=excluded.next_sync_at,
        expires_at=excluded.expires_at,quota_json=excluded.quota_json,
        config_json=excluded.config_json,updated_at=excluded.updated_at`,
      )
      .run(
        integration.provider,
        integration.label,
        integration.status,
        integration.secretRef ?? null,
        integration.maskedIdentifier,
        JSON.stringify(integration.scopes),
        integration.lastSyncAt,
        integration.nextSyncAt,
        integration.expiresAt,
        JSON.stringify(integration.quota),
        JSON.stringify(integration.configuration ?? {}),
        now(),
      );
  }

  deleteIntegration(provider: string): boolean {
    return (
      Number(
        this.db
          .prepare("DELETE FROM integrations WHERE provider=?")
          .run(provider).changes,
      ) > 0
    );
  }

  getProjectIntegrationConfiguration(
    projectId: string,
    provider: string,
  ): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        "SELECT config_json FROM project_integrations WHERE project_id=? AND provider=?",
      )
      .get(projectId, provider) as Row | undefined;
    return row ? json<Record<string, unknown>>(row.config_json, {}) : null;
  }

  setProjectIntegrationConfiguration(
    projectId: string,
    provider: string,
    configuration: Record<string, unknown>,
  ): void {
    this.db
      .prepare(
        `INSERT INTO project_integrations(project_id,provider,config_json,updated_at)
      VALUES(?,?,?,?)
      ON CONFLICT(project_id,provider) DO UPDATE SET
        config_json=excluded.config_json,updated_at=excluded.updated_at`,
      )
      .run(projectId, provider, JSON.stringify(configuration), now());
  }

  listProjectIntegrationConfigurations(
    projectId: string,
  ): ProjectBundleConnector[] {
    return (
      this.db
        .prepare(
          "SELECT provider,config_json FROM project_integrations WHERE project_id=? ORDER BY provider",
        )
        .all(projectId) as Row[]
    ).map((row) => ({
      provider: String(row.provider),
      configuration: json<Record<string, unknown>>(row.config_json, {}),
    }));
  }

  enqueueJob(input: {
    id?: string;
    runId?: string | null;
    type: string;
    payload: Record<string, unknown>;
    maxAttempts?: number;
    availableAt?: string;
  }): DurableJob {
    const timestamp = now();
    const id = input.id ?? randomUUID();
    const availableAt = input.availableAt ?? timestamp;
    this.db
      .prepare(
        `INSERT INTO jobs
      (id,run_id,type,state,payload_json,attempts,max_attempts,available_at,lease_owner,lease_expires_at,heartbeat_at,last_error,created_at,updated_at)
      VALUES(?,?,?,'queued',?,0,?,?,NULL,NULL,NULL,NULL,?,?)`,
      )
      .run(
        id,
        input.runId ?? null,
        input.type,
        JSON.stringify(input.payload),
        Math.max(1, Math.min(20, input.maxAttempts ?? 3)),
        availableAt,
        timestamp,
        timestamp,
      );
    this.appendJobEvent(id, input.runId ?? null, "job.queued", {
      type: input.type,
      availableAt,
    });
    return this.getJob(id)!;
  }

  getJob(id: string): DurableJob | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as
      Row | undefined;
    return row ? asJob(row) : null;
  }

  listJobs(state?: DurableJobState): DurableJob[] {
    const rows = state
      ? this.db
          .prepare("SELECT * FROM jobs WHERE state=? ORDER BY created_at")
          .all(state)
      : this.db
          .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 500")
          .all();
    return (rows as Row[]).map(asJob);
  }

  activeJobForRun(runId: string): DurableJob | null {
    const row = this.db
      .prepare(
        `SELECT * FROM jobs
      WHERE run_id=? AND state IN ('queued','leased') ORDER BY created_at DESC LIMIT 1`,
      )
      .get(runId) as Row | undefined;
    return row ? asJob(row) : null;
  }

  claimJobs(
    workerId: string,
    limit = 1,
    leaseMs = 30_000,
    currentTime = new Date(),
  ): DurableJob[] {
    if (!workerId.trim()) throw new Error("workerId is required");
    const at = currentTime.toISOString();
    const leaseExpiresAt = new Date(
      currentTime.getTime() + Math.max(1_000, leaseMs),
    ).toISOString();
    return this.transaction(() => {
      const rows = this.db
        .prepare(
          `SELECT * FROM jobs
        WHERE (state='queued' AND available_at<=?)
           OR (state='leased' AND lease_expires_at IS NOT NULL AND lease_expires_at<=?)
        ORDER BY available_at,created_at LIMIT ?`,
        )
        .all(at, at, Math.max(1, Math.min(100, limit))) as Row[];
      const claimed: DurableJob[] = [];
      for (const row of rows) {
        const id = String(row.id);
        const updated = this.db
          .prepare(
            `UPDATE jobs SET
          state='leased',attempts=attempts+1,lease_owner=?,lease_expires_at=?,heartbeat_at=?,updated_at=?
          WHERE id=? AND ((state='queued' AND available_at<=?) OR (state='leased' AND lease_expires_at<=?))`,
          )
          .run(workerId, leaseExpiresAt, at, at, id, at, at);
        if (Number(updated.changes) !== 1) continue;
        const job = this.getJob(id)!;
        this.appendJobEvent(id, job.runId, "job.leased", {
          workerId,
          attempt: job.attempts,
          leaseExpiresAt,
        });
        claimed.push(job);
      }
      return claimed;
    });
  }

  heartbeatJob(
    id: string,
    workerId: string,
    leaseMs = 30_000,
    currentTime = new Date(),
  ): boolean {
    const at = currentTime.toISOString();
    const leaseExpiresAt = new Date(
      currentTime.getTime() + Math.max(1_000, leaseMs),
    ).toISOString();
    const updated = this.db
      .prepare(
        `UPDATE jobs SET heartbeat_at=?,lease_expires_at=?,updated_at=?
      WHERE id=? AND state='leased' AND lease_owner=?`,
      )
      .run(at, leaseExpiresAt, at, id, workerId);
    return Number(updated.changes) === 1;
  }

  completeJob(id: string, workerId: string): boolean {
    const timestamp = now();
    const job = this.getJob(id);
    const updated = this.db
      .prepare(
        `UPDATE jobs SET
      state='succeeded',lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=?,updated_at=?
      WHERE id=? AND state='leased' AND lease_owner=?`,
      )
      .run(timestamp, timestamp, id, workerId);
    if (Number(updated.changes) === 1)
      this.appendJobEvent(id, job?.runId ?? null, "job.succeeded");
    return Number(updated.changes) === 1;
  }

  failJob(
    id: string,
    workerId: string,
    error: string,
    currentTime = new Date(),
  ): DurableJob | null {
    const current = this.getJob(id);
    if (
      !current ||
      current.state !== "leased" ||
      current.leaseOwner !== workerId
    )
      return null;
    const terminal = current.attempts >= current.maxAttempts;
    const delay = Math.min(
      60_000,
      1_000 * 2 ** Math.max(0, current.attempts - 1),
    );
    const availableAt = new Date(currentTime.getTime() + delay).toISOString();
    const timestamp = currentTime.toISOString();
    this.db
      .prepare(
        `UPDATE jobs SET
      state=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,last_error=?,updated_at=?
      WHERE id=? AND state='leased' AND lease_owner=?`,
      )
      .run(
        terminal ? "dead_letter" : "queued",
        terminal ? current.availableAt : availableAt,
        error.slice(0, 4_000),
        timestamp,
        id,
        workerId,
      );
    const next = this.getJob(id)!;
    this.appendJobEvent(
      id,
      current.runId,
      terminal ? "job.dead_letter" : "job.retry_scheduled",
      {
        attempt: current.attempts,
        maxAttempts: current.maxAttempts,
        ...(terminal ? {} : { availableAt }),
      },
    );
    return next;
  }

  cancelJob(id: string): boolean {
    const timestamp = now();
    const job = this.getJob(id);
    const updated = this.db
      .prepare(
        `UPDATE jobs SET
      state='cancelled',lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=?
      WHERE id=? AND state IN ('queued','leased')`,
      )
      .run(timestamp, id);
    if (Number(updated.changes) === 1)
      this.appendJobEvent(id, job?.runId ?? null, "job.cancelled");
    return Number(updated.changes) === 1;
  }

  private appendJobEvent(
    jobId: string,
    runId: string | null,
    type: string,
    payload: Record<string, unknown> = {},
  ): void {
    this.db
      .prepare(
        "INSERT INTO job_events(job_id,run_id,type,at,payload_json) VALUES(?,?,?,?,?)",
      )
      .run(jobId, runId, type, now(), JSON.stringify(payload));
  }

  listSchedules(projectId?: string): Schedule[] {
    const rows = projectId
      ? this.db
          .prepare(
            "SELECT * FROM schedules WHERE project_id=? ORDER BY next_run_at",
          )
          .all(projectId)
      : this.db.prepare("SELECT * FROM schedules ORDER BY next_run_at").all();
    return (rows as Row[]).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      cron: String(row.cron),
      timezone: String(row.timezone),
      enabled: Boolean(row.enabled),
      nextRunAt: String(row.next_run_at),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  createSchedule(
    input: Omit<Schedule, "id" | "createdAt" | "updatedAt">,
  ): Schedule {
    const timestamp = now();
    const schedule: Schedule = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.db
      .prepare(
        `INSERT INTO schedules(id,project_id,cron,timezone,enabled,next_run_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        schedule.id,
        schedule.projectId,
        schedule.cron,
        schedule.timezone,
        schedule.enabled ? 1 : 0,
        schedule.nextRunAt,
        schedule.createdAt,
        schedule.updatedAt,
      );
    return schedule;
  }

  updateSchedule(
    id: string,
    patch: Partial<
      Pick<Schedule, "cron" | "timezone" | "enabled" | "nextRunAt">
    >,
  ): Schedule | null {
    const current = this.listSchedules().find((schedule) => schedule.id === id);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    this.db
      .prepare(
        "UPDATE schedules SET cron=?,timezone=?,enabled=?,next_run_at=?,updated_at=? WHERE id=?",
      )
      .run(
        next.cron,
        next.timezone,
        next.enabled ? 1 : 0,
        next.nextRunAt,
        next.updatedAt,
        id,
      );
    return this.listSchedules().find((schedule) => schedule.id === id) ?? null;
  }

  deleteSchedule(id: string): boolean {
    return (
      Number(
        this.db.prepare("DELETE FROM schedules WHERE id=?").run(id).changes,
      ) > 0
    );
  }

  claimDueSchedules(
    workerId: string,
    limit = 20,
    leaseMs = 60_000,
    currentTime = new Date(),
  ): ClaimedSchedule[] {
    const at = currentTime.toISOString();
    const leaseExpiresAt = new Date(
      currentTime.getTime() + Math.max(1_000, leaseMs),
    ).toISOString();
    return this.transaction(() => {
      const rows = this.db
        .prepare(
          `SELECT * FROM schedules
        WHERE enabled=1 AND next_run_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?)
        ORDER BY next_run_at LIMIT ?`,
        )
        .all(at, at, Math.max(1, Math.min(100, limit))) as Row[];
      const claimed: ClaimedSchedule[] = [];
      for (const row of rows) {
        const id = String(row.id);
        const updated = this.db
          .prepare(
            `UPDATE schedules SET lease_owner=?,lease_expires_at=?
          WHERE id=? AND enabled=1 AND next_run_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?)`,
          )
          .run(workerId, leaseExpiresAt, id, at, at);
        if (Number(updated.changes) !== 1) continue;
        claimed.push({
          id,
          projectId: String(row.project_id),
          cron: String(row.cron),
          timezone: String(row.timezone),
          enabled: Boolean(row.enabled),
          nextRunAt: String(row.next_run_at),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
          leaseOwner: workerId,
          leaseExpiresAt,
        });
      }
      return claimed;
    });
  }

  advanceSchedule(
    id: string,
    workerId: string,
    nextRunAt: string,
    lastRunAt = now(),
  ): boolean {
    const timestamp = now();
    const updated = this.db
      .prepare(
        `UPDATE schedules SET
      next_run_at=?,last_run_at=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=?
      WHERE id=? AND lease_owner=?`,
      )
      .run(nextRunAt, lastRunAt, timestamp, id, workerId);
    return Number(updated.changes) === 1;
  }

  releaseSchedule(id: string, workerId: string): boolean {
    const updated = this.db
      .prepare(
        "UPDATE schedules SET lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND lease_owner=?",
      )
      .run(id, workerId);
    return Number(updated.changes) === 1;
  }

  saveArtifact(input: {
    id: string;
    runId: string;
    kind: string;
    path: string;
    mediaType: string;
    sizeBytes: number;
    sha256: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO artifacts(id,run_id,kind,path,media_type,size_bytes,sha256,created_at)
      VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.id,
        input.runId,
        input.kind,
        input.path,
        input.mediaType,
        input.sizeBytes,
        input.sha256,
        now(),
      );
  }

  listProjectArtifacts(projectId: string): ProjectArtifactRecord[] {
    return (
      this.db
        .prepare(
          `SELECT a.* FROM artifacts a
          JOIN runs r ON r.id=a.run_id
          WHERE r.project_id=?
          ORDER BY a.created_at,a.id`,
        )
        .all(projectId) as Row[]
    ).map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      kind: String(row.kind),
      path: String(row.path),
      mediaType: String(row.media_type),
      sizeBytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      createdAt: String(row.created_at),
    }));
  }

  getArtifact(
    runId: string,
    kind: string,
  ): {
    path: string;
    mediaType: string;
    sizeBytes: number;
    sha256: string;
  } | null {
    const row = this.db
      .prepare(
        "SELECT * FROM artifacts WHERE run_id=? AND kind=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(runId, kind) as Row | undefined;
    return row
      ? {
          path: String(row.path),
          mediaType: String(row.media_type),
          sizeBytes: Number(row.size_bytes),
          sha256: String(row.sha256),
        }
      : null;
  }

  /**
   * Inserts a complete imported project in one database transaction. The
   * runtime prepares artifact files first and removes them if this transaction
   * fails. Existing projects and histories are never updated by this method.
   */
  importProjectBundle(input: DatabaseProjectImport): Project {
    return this.transaction(() => {
      if (this.getProject(input.project.id)) {
        throw new Error("The remapped project identifier already exists");
      }
      this.db
        .prepare(
          "INSERT INTO projects(id,name,canonical_url,created_at,updated_at) VALUES(?,?,?,?,?)",
        )
        .run(
          input.project.id,
          input.project.name,
          input.project.canonicalUrl,
          input.project.createdAt,
          input.project.updatedAt,
        );
      this.db
        .prepare(
          "INSERT INTO sites(id,project_id,canonical_url,created_at) VALUES(?,?,?,?)",
        )
        .run(
          randomUUID(),
          input.project.id,
          input.project.canonicalUrl,
          input.importedAt,
        );

      if (input.settings) {
        this.db
          .prepare(
            `INSERT INTO project_settings
            (project_id,timezone,reporting_currency,weekly_digest,alert_email,data_retention_days,updated_at)
            VALUES(?,?,?,?,?,?,?)`,
          )
          .run(
            input.project.id,
            input.settings.timezone,
            input.settings.reportingCurrency,
            input.settings.weeklyDigest ? 1 : 0,
            input.settings.alertEmail,
            input.settings.dataRetentionDays,
            input.settings.updatedAt,
          );
      }

      const insertContextVersion = this.db.prepare(
        `INSERT INTO project_context_versions
        (project_id,revision,profile_json,change_summary,actor,created_at)
        VALUES(?,?,?,?,?,?)`,
      );
      for (const version of input.contextVersions) {
        insertContextVersion.run(
          input.project.id,
          version.revision,
          JSON.stringify(version.profile),
          version.changeSummary,
          version.actor,
          version.createdAt,
        );
      }

      const insertExtractionRuleVersion = this.db.prepare(
        `INSERT INTO project_extraction_rule_versions
        (project_id,revision,configuration_hash,rules_json,change_summary,actor,created_at)
        VALUES(?,?,?,?,?,?,?)`,
      );
      for (const version of input.extractionRuleVersions) {
        insertExtractionRuleVersion.run(
          input.project.id,
          version.revision,
          version.configurationHash,
          JSON.stringify(version.rules),
          version.changeSummary,
          version.actor,
          version.createdAt,
        );
      }

      const insertRun = this.db.prepare(
        `INSERT INTO runs
        (id,project_id,workflow_id,status,idempotency_key,requested_at,started_at,completed_at,progress,issue_count,error,options_json)
        VALUES(?,?,?, ?,NULL,?,?,?,?,?,?, ?)`,
      );
      const runConfigurations = new Map(
        input.runConfigurations.map((configuration) => [
          configuration.runId,
          configuration.options,
        ]),
      );
      for (const run of input.runs) {
        insertRun.run(
          run.id,
          input.project.id,
          run.workflowId,
          run.status,
          run.requestedAt,
          run.startedAt,
          run.completedAt,
          run.progress,
          run.issueCount,
          run.error,
          JSON.stringify(runConfigurations.get(run.id) ?? {}),
        );
      }

      const insertContextEntry = this.db.prepare(
        `INSERT INTO project_context_journal
        (id,project_id,sequence,kind,title,detail,source_run_id,actor,created_at)
        VALUES(?,?,?,?,?,?,?,?,?)`,
      );
      for (const entry of input.contextJournal) {
        insertContextEntry.run(
          entry.id,
          input.project.id,
          entry.sequence,
          entry.kind,
          entry.title,
          entry.detail,
          entry.sourceRunId,
          entry.actor,
          entry.createdAt,
        );
      }

      const insertModule = this.db.prepare(
        `INSERT INTO run_modules
        (run_id,module_id,version,status,started_at,completed_at,duration_ms,coverage,error)
        VALUES(?,?,?,?,?,?,?,?,?)`,
      );
      for (const module of input.runModules) {
        insertModule.run(
          module.runId,
          module.moduleId,
          module.version,
          module.status,
          module.startedAt,
          module.completedAt,
          module.durationMs,
          module.coverage,
          module.error,
        );
      }

      const insertPage = this.db.prepare(
        `INSERT INTO pages
        (run_id,canonical_url,status_code,title,indexable,payload_json)
        VALUES(?,?,?,?,?,?)`,
      );
      for (const page of input.pages) {
        insertPage.run(
          page.runId,
          page.canonicalUrl,
          page.statusCode,
          page.title,
          page.indexable === null ? null : page.indexable ? 1 : 0,
          JSON.stringify(page.payload),
        );
      }
      const linkPagesByRun = new Map<string, ProjectBundlePage[]>();
      for (const page of input.pages) {
        const pages = linkPagesByRun.get(page.runId) ?? [];
        pages.push(page);
        linkPagesByRun.set(page.runId, pages);
      }
      for (const [runId, pages] of linkPagesByRun) {
        this.insertPageLinks(runId, pages);
      }

      const findIssue = this.db.prepare(
        "SELECT rule_id,module_id,canonical_url FROM issues WHERE fingerprint=?",
      );
      const insertIssue = this.db.prepare(
        `INSERT OR IGNORE INTO issues
        (fingerprint,rule_id,module_id,canonical_url,severity,title,description)
        VALUES(?,?,?,?,?,?,?)`,
      );
      const insertIssueInstance = this.db.prepare(
        `INSERT INTO issue_instances
        (run_id,fingerprint,project_id,evidence_json,first_seen_at,last_seen_at,status,
         severity_snapshot,title_snapshot,description_snapshot)
        VALUES(?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const record of input.issues) {
        const issue = record.issue;
        const existing = findIssue.get(issue.fingerprint) as Row | undefined;
        if (
          existing &&
          (String(existing.rule_id) !== issue.ruleId ||
            String(existing.module_id) !== issue.moduleId ||
            (existing.canonical_url === null
              ? null
              : String(existing.canonical_url)) !== issue.canonicalUrl)
        ) {
          throw new Error(
            `Issue fingerprint collision for ${issue.fingerprint}`,
          );
        }
        insertIssue.run(
          issue.fingerprint,
          issue.ruleId,
          issue.moduleId,
          issue.canonicalUrl,
          issue.severity,
          issue.title,
          issue.description,
        );
        insertIssueInstance.run(
          record.runId,
          issue.fingerprint,
          input.project.id,
          JSON.stringify(issue.evidence),
          issue.firstSeenAt,
          issue.lastSeenAt,
          issue.status,
          issue.severity,
          issue.title,
          issue.description,
        );
      }

      const insertAdjudication = this.db.prepare(
        `INSERT INTO issue_adjudications
        (project_id,fingerprint,status,note,actor,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?)`,
      );
      for (const adjudication of input.issueAdjudications) {
        insertAdjudication.run(
          input.project.id,
          adjudication.fingerprint,
          adjudication.status,
          adjudication.note,
          adjudication.actor,
          adjudication.createdAt,
          adjudication.updatedAt,
        );
      }

      const insertAction = this.db.prepare(
        `INSERT INTO actions
        (id,project_id,rule_id,module_id,issue_fingerprint,title,why_now,impact,effort,confidence,priority_score,score_version,score_inputs_json,affected_urls_json,owner,status,verification,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const action of input.actions) {
        insertAction.run(
          action.id,
          input.project.id,
          action.ruleId ?? null,
          action.moduleId ?? null,
          action.issueFingerprint ?? null,
          action.title,
          action.whyNow,
          action.impact,
          action.effort,
          action.confidence,
          action.priorityScore,
          action.scoreVersion,
          JSON.stringify(action.scoreInputs),
          JSON.stringify(action.affectedUrls),
          action.owner,
          action.status,
          action.verification,
          action.createdAt,
          action.updatedAt,
        );
      }

      // Action-to-issue links are derived data, so the portable bundle does
      // not need a second copy of them. Rebuild the relationship from the
      // canonical rule/module/fingerprint identities to preserve per-URL
      // adjudication semantics after import.
      const actionsByGroup = new Map<string, Action[]>();
      const actionsByFingerprint = new Map<string, Action[]>();
      for (const action of input.actions) {
        if (action.ruleId && action.moduleId) {
          const key = `${action.moduleId}\u001f${action.ruleId}`;
          const group = actionsByGroup.get(key) ?? [];
          group.push(action);
          actionsByGroup.set(key, group);
        } else if (action.issueFingerprint) {
          const group = actionsByFingerprint.get(action.issueFingerprint) ?? [];
          group.push(action);
          actionsByFingerprint.set(action.issueFingerprint, group);
        }
      }
      const runRequestedAt = new Map(
        input.runs.map((run) => [run.id, run.requestedAt]),
      );
      const orderedIssues = [...input.issues].sort((left, right) => {
        const byRun = (runRequestedAt.get(left.runId) ?? "").localeCompare(
          runRequestedAt.get(right.runId) ?? "",
        );
        return (
          byRun || left.issue.fingerprint.localeCompare(right.issue.fingerprint)
        );
      });
      const seenActionIssues = new Set<string>();
      const insertActionIssue = this.db.prepare(
        `INSERT OR IGNORE INTO action_issue_instances
        (action_id,run_id,fingerprint,lifecycle,observed_at)
        VALUES(?,?,?,?,?)`,
      );
      for (const record of orderedIssues) {
        const issue = record.issue;
        const candidates =
          actionsByGroup.get(`${issue.moduleId}\u001f${issue.ruleId}`) ??
          actionsByFingerprint.get(issue.fingerprint) ??
          [];
        for (const action of candidates) {
          const identity = `${action.id}\u001f${issue.fingerprint}`;
          const lifecycle: ActionOccurrenceLifecycle =
            issue.status === "resolved"
              ? "resolved"
              : seenActionIssues.has(identity)
                ? "persistent"
                : "new";
          insertActionIssue.run(
            action.id,
            record.runId,
            issue.fingerprint,
            lifecycle,
            issue.lastSeenAt,
          );
          if (issue.status !== "resolved") seenActionIssues.add(identity);
        }
      }

      const insertMetric = this.db.prepare(
        `INSERT INTO metrics
        (project_id,run_id,key,value,state,source,observed_at,coverage,note)
        VALUES(?,?,?,?,?,?,?,?,?)`,
      );
      for (const record of input.metrics) {
        insertMetric.run(
          input.project.id,
          record.runId,
          record.key,
          record.metric.value,
          record.metric.state,
          record.metric.source,
          record.metric.observedAt,
          record.metric.coverage,
          record.metric.note ?? null,
        );
      }

      const insertSchedule = this.db.prepare(
        `INSERT INTO schedules
        (id,project_id,cron,timezone,enabled,next_run_at,created_at,updated_at)
        VALUES(?,?,?,?,0,?,?,?)`,
      );
      for (const schedule of input.schedules) {
        insertSchedule.run(
          schedule.id,
          input.project.id,
          schedule.cron,
          schedule.timezone,
          schedule.nextRunAt,
          schedule.createdAt,
          schedule.updatedAt,
        );
      }

      const insertConnector = this.db.prepare(
        `INSERT INTO project_integrations(project_id,provider,config_json,updated_at)
        VALUES(?,?,?,?)`,
      );
      for (const connector of input.connectors) {
        insertConnector.run(
          input.project.id,
          connector.provider,
          JSON.stringify(connector.configuration),
          input.importedAt,
        );
      }

      const insertArtifact = this.db.prepare(
        `INSERT INTO artifacts
        (id,run_id,kind,path,media_type,size_bytes,sha256,created_at)
        VALUES(?,?,?,?,?,?,?,?)`,
      );
      for (const artifact of input.artifacts) {
        insertArtifact.run(
          artifact.id,
          artifact.runId,
          artifact.kind,
          artifact.path,
          artifact.mediaType,
          artifact.sizeBytes,
          artifact.sha256,
          artifact.createdAt,
        );
      }

      this.db
        .prepare(
          `INSERT INTO audit_events
          (actor,action,entity_type,entity_id,at,payload_json)
          VALUES('local-user','project.import','project',?,?,?)`,
        )
        .run(
          input.project.id,
          input.importedAt,
          JSON.stringify({
            format: "golemseo-project",
            version: 2,
            sourceProjectId: input.sourceProjectId,
          }),
        );
      return this.getProject(input.project.id)!;
    });
  }

  recoverInterruptedRuns(): number {
    const timestamp = now();
    const result = this.db
      .prepare(
        `UPDATE runs SET status='queued',started_at=NULL,error='Recovered after daemon restart'
      WHERE status='running'`,
      )
      .run();
    this.db
      .prepare(
        `UPDATE jobs SET state='queued',lease_owner=NULL,lease_expires_at=NULL,available_at=?,updated_at=?
      WHERE state='leased'`,
      )
      .run(timestamp, timestamp);
    this.db
      .prepare(
        `UPDATE action_verifications SET state='queued',updated_at=?
        WHERE state='running' AND run_id IN (SELECT id FROM runs WHERE status='queued')`,
      )
      .run(timestamp);
    this.db
      .prepare(
        `UPDATE action_checkpoints SET state='verification_queued',updated_at=?
        WHERE id IN (
          SELECT checkpoint_id FROM action_verifications
          WHERE state='queued' AND run_id IN (SELECT id FROM runs WHERE status='queued')
        )`,
      )
      .run(timestamp);
    return Number(result.changes);
  }

  checkpoint(): void {
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  }
  close(): void {
    this.db.close();
  }
}
