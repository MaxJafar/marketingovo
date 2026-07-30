import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  IssueInstance,
  Project,
  Run,
  RunStatus,
} from "@agentseoapp/contracts";
import type { CredentialRef, CredentialStore } from "@agentseoapp/credentials";
import { AgentSeoDatabase } from "@agentseoapp/storage-sqlite";

interface LegacyAuditIssue {
  id?: string;
  ruleId?: string;
  moduleId?: string;
  fingerprint?: string;
  category?: string;
  priority?: "High" | "Medium" | "Low";
  severity?: IssueInstance["severity"];
  message?: string;
  title?: string;
  description?: string;
  urls?: string[];
  canonicalUrl?: string | null;
  evidence?: IssueInstance["evidence"];
  firstSeenAt?: string;
  lastSeenAt?: string;
  status?: IssueInstance["status"];
}

interface LegacyAuditRun {
  id?: string;
  startUrl?: string;
  requestedAt?: string;
  completedAt?: string;
  status?: string;
  durationMs?: number;
  issueCount?: number;
  issues?: LegacyAuditIssue[];
  issueInstances?: LegacyAuditIssue[];
}

interface LegacyScheduleJob {
  name?: string;
  startUrl?: string;
  intervalMinutes?: number;
  timezone?: string;
  nextRunAt?: string;
  next_run_at?: string;
  enabled?: boolean;
}

export interface LegacyDiscovery {
  sourceDirectory: string;
  auditFiles: string[];
  crawlDatabases: string[];
  scheduleFiles: string[];
  customRuleFiles: string[];
  tokenFiles: Array<{
    provider: "google-search-console" | "google-analytics-4";
    path: string;
  }>;
  environmentKeys: string[];
}

export interface LegacyImportReceipt {
  id: string;
  importedAt: string;
  sourceDirectory: string;
  originalsModified: false;
  inputs: Array<{ path: string; sha256: string; sizeBytes: number }>;
  counts: {
    projects: number;
    runs: number;
    pages: number;
    issues: number;
    schedules: number;
    credentials: number;
    customRuleFiles: number;
  };
  warnings: string[];
}

export interface LegacyImportOptions {
  sourceDirectory: string;
  destinationDirectory: string;
  database?: AgentSeoDatabase;
  credentialStore?: CredentialStore;
  environment?: NodeJS.ProcessEnv;
}

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const fileHash = (path: string): string => hash(readFileSync(path));
const validUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const safeIso = (
  value: unknown,
  fallback = new Date().toISOString(),
): string => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return fallback;
  return new Date(value).toISOString();
};
const status = (value: string | undefined): RunStatus => {
  if (value === "completed") return "succeeded";
  if (value === "aborted") return "cancelled";
  return [
    "queued",
    "running",
    "succeeded",
    "partial",
    "failed",
    "cancelled",
  ].includes(value ?? "")
    ? (value as RunStatus)
    : "failed";
};
const severity = (issue: LegacyAuditIssue): IssueInstance["severity"] => {
  if (
    ["critical", "high", "medium", "low", "info"].includes(issue.severity ?? "")
  )
    return issue.severity!;
  return issue.priority === "High"
    ? "high"
    : issue.priority === "Medium"
      ? "medium"
      : "low";
};

function existing(path: string): string[] {
  return existsSync(path) && statSync(path).isFile() ? [path] : [];
}

export function discoverLegacyData(
  sourceDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): LegacyDiscovery {
  const root = resolve(sourceDirectory);
  const auditFiles = existing(join(root, "audits.json"));
  const crawlDatabases = [
    "crawls.db",
    "golem-seo.db",
    "screaming-claw.db",
  ].flatMap((name) => existing(join(root, name)));
  const scheduleFiles = existing(join(root, "schedule.json"));
  const customRuleFiles = [
    "custom-rules.json",
    "custom-rules.example.json",
  ].flatMap((name) => existing(join(root, name)));
  const tokens: LegacyDiscovery["tokenFiles"] = [
    { provider: "google-search-console", path: join(root, "gsc-token.json") },
    {
      provider: "google-search-console",
      path: join(root, ".config", "google-search-console", "token.json"),
    },
    ...[environment.GOLEMSEO_GSC_TOKEN, environment.SCREAMINGCLAW_GSC_TOKEN]
      .filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      )
      .map((path) => ({
        provider: "google-search-console" as const,
        path: resolve(path),
      })),
    { provider: "google-analytics-4", path: join(root, "ga4-token.json") },
    {
      provider: "google-analytics-4",
      path: join(root, ".config", "google-analytics", "token.json"),
    },
    ...[environment.GOLEMSEO_GA4_TOKEN, environment.SCREAMINGCLAW_GA4_TOKEN]
      .filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      )
      .map((path) => ({
        provider: "google-analytics-4" as const,
        path: resolve(path),
      })),
  ];
  return {
    sourceDirectory: root,
    auditFiles,
    crawlDatabases,
    scheduleFiles,
    customRuleFiles,
    tokenFiles: tokens.filter(
      (token) => existsSync(token.path) && statSync(token.path).isFile(),
    ),
    environmentKeys: Object.keys(environment)
      .filter((key) => /^(?:GOLEMSEO|SCREAMINGCLAW)_/u.test(key))
      .sort(),
  };
}

function projectFor(
  database: AgentSeoDatabase,
  cache: Map<string, Project>,
  url: string,
): Project {
  const canonicalUrl = new URL(url).href;
  const cached = cache.get(canonicalUrl);
  if (cached) return cached;
  const existingProject = database
    .listProjects()
    .find((project) => project.canonicalUrl === canonicalUrl);
  const project =
    existingProject ??
    database.createProject({
      name: new URL(canonicalUrl).hostname,
      canonicalUrl,
    });
  cache.set(canonicalUrl, project);
  return project;
}

function canonicalIssue(
  issue: LegacyAuditIssue,
  observedAt: string,
): IssueInstance[] {
  const urls =
    issue.canonicalUrl !== undefined
      ? [issue.canonicalUrl]
      : issue.urls?.length
        ? issue.urls
        : [null];
  const ruleId = issue.ruleId ?? issue.id ?? "legacy-finding";
  const moduleId = issue.moduleId ?? issue.category ?? "legacy-v0";
  return urls.map((url) => {
    const canonicalUrl = validUrl(url) ? new URL(url).href : null;
    const fingerprint =
      issue.fingerprint ??
      hash(`${moduleId}\u001f${ruleId}\u001f${canonicalUrl ?? "site"}`);
    const title = issue.title ?? issue.message ?? ruleId;
    return {
      fingerprint,
      ruleId,
      moduleId,
      canonicalUrl,
      severity: severity(issue),
      title,
      description:
        issue.description ?? issue.message ?? "Imported legacy finding",
      evidence: issue.evidence ?? [
        {
          kind: "legacy-import",
          label: "Imported from Golem SEO v0",
          source: "legacy-v0",
          observedAt,
        },
      ],
      firstSeenAt: safeIso(issue.firstSeenAt, observedAt),
      lastSeenAt: safeIso(issue.lastSeenAt, observedAt),
      status: issue.status ?? "open",
    };
  });
}

function importAuditFile(
  path: string,
  database: AgentSeoDatabase,
  projects: Map<string, Project>,
  receipt: LegacyImportReceipt,
): void {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as
    { runs?: Record<string, LegacyAuditRun> } | LegacyAuditRun[];
  const runs = Array.isArray(parsed)
    ? parsed
    : Object.values(parsed.runs ?? {});
  for (const legacy of runs) {
    if (!validUrl(legacy.startUrl)) {
      receipt.warnings.push(
        `${basename(path)}: skipped run without a valid start URL`,
      );
      continue;
    }
    const project = projectFor(database, projects, legacy.startUrl);
    const requestedAt = safeIso(legacy.requestedAt);
    const id = `legacy-${hash(`${path}\u001f${legacy.id ?? requestedAt}`).slice(0, 28)}`;
    if (database.getRun(id)) continue;
    const imported = database.insertRun({
      id,
      projectId: project.id,
      workflowId: "audit",
      idempotencyKey: `legacy-json:${hash(path).slice(0, 12)}:${legacy.id ?? requestedAt}`,
    });
    if (imported.id !== id) continue;
    const legacyIssues = legacy.issueInstances?.length
      ? legacy.issueInstances
      : (legacy.issues ?? []);
    const issues = legacyIssues.flatMap((issue) =>
      canonicalIssue(issue, requestedAt),
    );
    database.replaceIssues(id, project.id, issues);
    database.updateRun(id, {
      status: status(legacy.status),
      startedAt: requestedAt,
      completedAt: legacy.completedAt
        ? safeIso(legacy.completedAt)
        : requestedAt,
      progress: 1,
      issueCount: issues.length,
      error:
        status(legacy.status) === "failed"
          ? "Imported legacy run had an unknown or failed status"
          : null,
    });
    receipt.counts.runs += 1;
    receipt.counts.issues += issues.length;
  }
}

function tableExists(database: DatabaseSync, name: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name),
  );
}

function importCrawlDatabase(
  path: string,
  database: AgentSeoDatabase,
  projects: Map<string, Project>,
  receipt: LegacyImportReceipt,
): void {
  const legacy = new DatabaseSync(path, { readOnly: true });
  try {
    if (!tableExists(legacy, "crawls")) {
      receipt.warnings.push(`${basename(path)}: no legacy crawls table`);
      return;
    }
    const crawls = legacy
      .prepare("SELECT * FROM crawls ORDER BY id")
      .all() as Array<Record<string, unknown>>;
    for (const crawl of crawls) {
      if (!validUrl(crawl.start_url)) continue;
      const project = projectFor(database, projects, crawl.start_url);
      const legacyId = String(crawl.id);
      const id = `legacy-${hash(`${path}\u001f${legacyId}`).slice(0, 28)}`;
      if (database.getRun(id)) continue;
      const imported = database.insertRun({
        id,
        projectId: project.id,
        workflowId: "audit",
        idempotencyKey: `legacy-sqlite:${fileHash(path).slice(0, 12)}:${legacyId}`,
      });
      if (imported.id !== id) continue;
      const pages = tableExists(legacy, "crawl_pages")
        ? (legacy
            .prepare("SELECT * FROM crawl_pages WHERE crawl_id=?")
            .all(crawl.id as never) as Array<Record<string, unknown>>)
        : [];
      database.replacePages(
        id,
        pages
          .filter((page) => validUrl(page.final_url ?? page.url))
          .map((page) => ({
            canonicalUrl: new URL(String(page.final_url ?? page.url)).href,
            statusCode:
              page.status === null || page.status === undefined
                ? null
                : Number(page.status),
            title:
              page.title === null || page.title === undefined
                ? null
                : String(page.title),
            indexable:
              typeof page.status === "number"
                ? page.status >= 200 && page.status < 300
                : null,
            payload: {
              legacySourceUrl: page.url,
              metaDescription: page.meta_description,
              h1: page.h1,
              canonical: page.canonical,
            },
          })),
      );
      const rows = tableExists(legacy, "crawl_issues")
        ? (legacy
            .prepare("SELECT * FROM crawl_issues WHERE crawl_id=?")
            .all(crawl.id as never) as Array<Record<string, unknown>>)
        : [];
      const observedAt = safeIso(crawl.finished_at ?? crawl.started_at);
      const issues = rows.flatMap((row) =>
        canonicalIssue(
          {
            id: String(row.issue_id ?? "legacy-finding"),
            category: String(row.category ?? "legacy-v0"),
            priority: ["High", "Medium", "Low"].includes(String(row.priority))
              ? (row.priority as LegacyAuditIssue["priority"])
              : "Low",
            message: String(
              row.message ?? row.issue_id ?? "Imported legacy finding",
            ),
            urls: validUrl(row.url) ? [row.url] : [],
          },
          observedAt,
        ),
      );
      database.replaceIssues(id, project.id, issues);
      database.updateRun(id, {
        status: "succeeded",
        startedAt: safeIso(crawl.started_at),
        completedAt: observedAt,
        progress: 1,
        issueCount: issues.length,
        error: null,
      });
      receipt.counts.runs += 1;
      receipt.counts.pages += pages.length;
      receipt.counts.issues += issues.length;
    }
  } finally {
    legacy.close();
  }
}

function cronForInterval(minutes: number): string {
  if (minutes < 60 && 60 % minutes === 0) return `*/${minutes} * * * *`;
  if (minutes % 60 === 0 && minutes < 1_440 && 24 % (minutes / 60) === 0)
    return `0 */${minutes / 60} * * *`;
  if (minutes % 1_440 === 0) return `0 0 */${Math.max(1, minutes / 1_440)} * *`;
  return `@every ${minutes}m`;
}

function importSchedule(
  path: string,
  database: AgentSeoDatabase,
  projects: Map<string, Project>,
  receipt: LegacyImportReceipt,
): void {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    jobs?: LegacyScheduleJob[];
  };
  for (const job of parsed.jobs ?? []) {
    if (
      !validUrl(job.startUrl) ||
      !Number.isFinite(job.intervalMinutes) ||
      (job.intervalMinutes ?? 0) <= 0
    )
      continue;
    const project = projectFor(database, projects, job.startUrl);
    const nextRunAt = safeIso(
      job.nextRunAt ?? job.next_run_at,
      new Date(Date.now() + job.intervalMinutes! * 60_000).toISOString(),
    );
    const duplicate = database
      .listSchedules(project.id)
      .some(
        (schedule) =>
          schedule.cron === cronForInterval(job.intervalMinutes!) &&
          schedule.timezone === (job.timezone ?? "UTC"),
      );
    if (duplicate) continue;
    database.createSchedule({
      projectId: project.id,
      cron: cronForInterval(job.intervalMinutes!),
      timezone: job.timezone ?? "UTC",
      enabled: job.enabled !== false,
      nextRunAt,
    });
    receipt.counts.schedules += 1;
  }
}

async function saveCredential(
  store: CredentialStore,
  ref: CredentialRef,
  bytes: Uint8Array,
): Promise<boolean> {
  const previous = await store.get(ref);
  try {
    if (
      previous &&
      previous.byteLength === bytes.byteLength &&
      timingSafeEqual(previous, bytes)
    ) {
      return false;
    }
  } finally {
    previous?.fill(0);
  }
  await store.put(ref, bytes);
  return true;
}

export async function importLegacyData(
  options: LegacyImportOptions,
): Promise<LegacyImportReceipt> {
  const discovery = discoverLegacyData(
    options.sourceDirectory,
    options.environment,
  );
  const destination = resolve(options.destinationDirectory);
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  try {
    chmodSync(destination, 0o700);
  } catch {
    /* managed by platform ACL */
  }
  const ownedDatabase =
    options.database ??
    new AgentSeoDatabase({ path: join(destination, "agentseo.db") });
  const receipt: LegacyImportReceipt = {
    id: randomUUID(),
    importedAt: new Date().toISOString(),
    sourceDirectory: discovery.sourceDirectory,
    originalsModified: false,
    inputs: [],
    counts: {
      projects: 0,
      runs: 0,
      pages: 0,
      issues: 0,
      schedules: 0,
      credentials: 0,
      customRuleFiles: 0,
    },
    warnings: [],
  };
  const projects = new Map(
    ownedDatabase
      .listProjects()
      .map((project) => [project.canonicalUrl, project]),
  );
  const beforeProjects = projects.size;
  const inputs = [
    ...discovery.auditFiles,
    ...discovery.crawlDatabases,
    ...discovery.scheduleFiles,
    ...discovery.customRuleFiles,
    ...discovery.tokenFiles.map((token) => token.path),
  ];
  receipt.inputs = inputs.map((path) => ({
    path,
    sha256: fileHash(path),
    sizeBytes: statSync(path).size,
  }));
  try {
    for (const path of discovery.auditFiles)
      importAuditFile(path, ownedDatabase, projects, receipt);
    for (const path of discovery.crawlDatabases)
      importCrawlDatabase(path, ownedDatabase, projects, receipt);
    for (const path of discovery.scheduleFiles)
      importSchedule(path, ownedDatabase, projects, receipt);
    const ruleDirectory = join(destination, "legacy-import", "rules");
    mkdirSync(ruleDirectory, { recursive: true, mode: 0o700 });
    for (const path of discovery.customRuleFiles) {
      const output = join(ruleDirectory, basename(path));
      if (existsSync(output) && fileHash(output) === fileHash(path)) continue;
      copyFileSync(path, output);
      try {
        chmodSync(output, 0o600);
      } catch {
        /* managed by platform ACL */
      }
      receipt.counts.customRuleFiles += 1;
    }
    if (options.credentialStore) {
      for (const token of discovery.tokenFiles) {
        const ref = {
          provider: token.provider,
          account: "legacy-import",
          kind: "oauth-token",
        };
        const imported = await saveCredential(
          options.credentialStore,
          ref,
          readFileSync(token.path),
        );
        const credentialStatus = await options.credentialStore.status(ref);
        ownedDatabase.upsertIntegration({
          provider: token.provider,
          label:
            token.provider === "google-search-console"
              ? "Google Search Console"
              : "Google Analytics 4",
          status: "connected",
          secretRef: `${ref.provider}/${ref.account}/${ref.kind}`,
          maskedIdentifier: credentialStatus.maskedIdentifier,
          scopes: [],
          lastSyncAt: null,
          nextSyncAt: null,
          expiresAt: null,
          quota: null,
        });
        if (imported) receipt.counts.credentials += 1;
      }
      const environment = options.environment ?? process.env;
      const apiCredentials: Array<{
        provider: string;
        label: string;
        value: Record<string, string> | null;
      }> = [
        {
          provider: "serpapi",
          label: "SerpAPI",
          value:
            environment.GOLEMSEO_SERPAPI_KEY ||
            environment.SCREAMINGCLAW_SERPAPI_KEY
              ? {
                  apiKey: String(
                    environment.GOLEMSEO_SERPAPI_KEY ??
                      environment.SCREAMINGCLAW_SERPAPI_KEY,
                  ),
                }
              : null,
        },
        {
          provider: "pagespeed-insights",
          label: "PageSpeed Insights",
          value:
            environment.GOLEMSEO_PSI_API_KEY ||
            environment.SCREAMINGCLAW_PSI_API_KEY
              ? {
                  apiKey: String(
                    environment.GOLEMSEO_PSI_API_KEY ??
                      environment.SCREAMINGCLAW_PSI_API_KEY,
                  ),
                }
              : null,
        },
        {
          provider: "dataforseo",
          label: "DataForSEO",
          value:
            (environment.GOLEMSEO_DATAFORSEO_LOGIN ||
              environment.SCREAMINGCLAW_DATAFORSEO_LOGIN) &&
            (environment.GOLEMSEO_DATAFORSEO_PASSWORD ||
              environment.SCREAMINGCLAW_DATAFORSEO_PASSWORD)
              ? {
                  login: String(
                    environment.GOLEMSEO_DATAFORSEO_LOGIN ??
                      environment.SCREAMINGCLAW_DATAFORSEO_LOGIN,
                  ),
                  password: String(
                    environment.GOLEMSEO_DATAFORSEO_PASSWORD ??
                      environment.SCREAMINGCLAW_DATAFORSEO_PASSWORD,
                  ),
                }
              : null,
        },
      ];
      for (const candidate of apiCredentials) {
        if (!candidate.value) continue;
        const ref = {
          provider: candidate.provider,
          account: "legacy-import",
          kind: "credentials",
        };
        const imported = await saveCredential(
          options.credentialStore,
          ref,
          Buffer.from(JSON.stringify(candidate.value)),
        );
        const credentialStatus = await options.credentialStore.status(ref);
        ownedDatabase.upsertIntegration({
          provider: candidate.provider,
          label: candidate.label,
          status: "connected",
          secretRef: `${ref.provider}/${ref.account}/${ref.kind}`,
          maskedIdentifier: credentialStatus.maskedIdentifier,
          scopes: [],
          lastSyncAt: null,
          nextSyncAt: null,
          expiresAt: null,
          quota: null,
        });
        if (imported) receipt.counts.credentials += 1;
      }
    } else if (discovery.tokenFiles.length > 0) {
      receipt.warnings.push(
        "Legacy token files were detected but not imported because the credential vault is locked.",
      );
    }
    if (discovery.environmentKeys.length > 0) {
      receipt.warnings.push(
        `Detected ${discovery.environmentKeys.length} legacy environment setting name(s); values were not written to the receipt.`,
      );
    }
    receipt.counts.projects = projects.size - beforeProjects;
    const receiptDirectory = join(destination, "migration-receipts");
    mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
    const receiptPath = join(
      receiptDirectory,
      `${receipt.importedAt.replace(/[:.]/gu, "-")}-${receipt.id}.json`,
    );
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
    });
    try {
      chmodSync(receiptPath, 0o600);
    } catch {
      /* managed by platform ACL */
    }
    return receipt;
  } finally {
    if (!options.database) ownedDatabase.close();
  }
}
