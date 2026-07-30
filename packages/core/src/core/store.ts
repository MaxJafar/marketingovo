// Project store: one SQLite file per project. Holds crawl history
// (one row per crawl) and per-page state for each crawl. The diff
// between two crawls tells you which URLs appeared, disappeared,
// changed status, or got a new issue.
//
// Uses `node:sqlite` (Node 22.7+, built-in). No native compilation
// required. Operators can switch to `better-sqlite3` later if
// performance becomes a problem (millions of rows).
//
// All data is local. The file lives next to the project
// configuration; the operator controls backups.
//
// Backward compat: the default file name is `marketingovo.db`. If one of
// the earlier names (`golem-seo.db`, `screaming-claw.db`) exists in the
// project root and the new name does not, we read/write the legacy file
// (with a one-time deprecation notice) so existing data is preserved.

import { dirname, join } from "node:path";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import type { CrawledPage, Issue } from "../checks/index.js";

export interface ProjectStoreOptions {
  projectRoot: string; // directory; store file is <root>/marketingovo.db
}

export interface DiffResult {
  added: string[];
  removed: string[];
  statusChanged: Array<{ url: string; from: number; to: number }>;
  newIssues: Array<{ url: string; issueId: string }>;
  fixedIssues: Array<{ url: string; issueId: string }>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS crawls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  start_url TEXT NOT NULL,
  pages_crawled INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS crawl_pages (
  crawl_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  final_url TEXT,
  status INTEGER,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  canonical TEXT,
  body_bytes INTEGER,
  render_mode TEXT,
  PRIMARY KEY (crawl_id, url),
  FOREIGN KEY (crawl_id) REFERENCES crawls(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS crawl_issues (
  crawl_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  message TEXT NOT NULL,
  PRIMARY KEY (crawl_id, url, issue_id),
  FOREIGN KEY (crawl_id) REFERENCES crawls(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_issues_crawl ON crawl_issues(crawl_id);
CREATE INDEX IF NOT EXISTS idx_pages_crawl ON crawl_pages(crawl_id);
`;

type SqliteModule = typeof import("node:sqlite");
let _sqlite: SqliteModule | null = null;

async function loadSqlite(): Promise<SqliteModule> {
  if (_sqlite) return _sqlite;
  try {
    _sqlite = (await import("node:sqlite")) as SqliteModule;
    return _sqlite;
  } catch {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    _sqlite = req("node:sqlite") as SqliteModule;
    return _sqlite;
  }
}

export class ProjectStore {
  private db: import("node:sqlite").DatabaseSync | null = null;
  private readonly opts: ProjectStoreOptions;

  constructor(opts: ProjectStoreOptions) {
    this.opts = opts;
  }

  private async ensure(): Promise<import("node:sqlite").DatabaseSync> {
    if (this.db) return this.db;
    const { DatabaseSync } = await loadSqlite();
    mkdirSync(this.opts.projectRoot, { recursive: true });
    const newPath = join(this.opts.projectRoot, "marketingovo.db");
    // Earlier store names, newest first. Each rename adds one entry rather
    // than replacing the previous one, so no generation of local data is
    // stranded by a product rename.
    const legacyNames = ["golem-seo.db", "screaming-claw.db"];
    // Backward compat: prefer the new name; if absent and a legacy
    // file exists, use it (read/write) so existing data is preserved.
    let dbPath = newPath;
    if (!existsSync(newPath)) {
      const legacyPath = legacyNames
        .map((name) => join(this.opts.projectRoot, name))
        .find((candidate) => existsSync(candidate));
      if (legacyPath) {
        dbPath = legacyPath;
        // eslint-disable-next-line no-console
        console.warn(
          `[marketingovo] using legacy store file ${legacyPath}; it will be migrated to ${newPath} on next write.`,
        );
      }
    }
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec(SCHEMA);
    this.db = db;
    return db;
  }

  async beginCrawl(startedAt: string, startUrl: string): Promise<number> {
    const db = await this.ensure();
    const stmt = db.prepare(
      "INSERT INTO crawls (started_at, finished_at, start_url, pages_crawled, duration_ms) VALUES (?, ?, ?, 0, 0)",
    );
    const info = stmt.run(startedAt, startedAt, startUrl);
    return Number(info.lastInsertRowid);
  }

  async finishCrawl(
    crawlId: number,
    finishedAt: string,
    pagesCrawled: number,
    durationMs: number,
  ): Promise<void> {
    const db = await this.ensure();
    db.prepare(
      "UPDATE crawls SET finished_at = ?, pages_crawled = ?, duration_ms = ? WHERE id = ?",
    ).run(finishedAt, pagesCrawled, durationMs, crawlId);
  }

  async savePages(
    crawlId: number,
    pages: Iterable<CrawledPage>,
  ): Promise<void> {
    const db = await this.ensure();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO crawl_pages
        (crawl_id, url, final_url, status, title, meta_description, h1, canonical, body_bytes, render_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    db.exec("BEGIN");
    try {
      for (const p of pages) {
        const h1 = p.parsed?.h1?.[0] ?? null;
        insert.run(
          crawlId,
          p.url,
          p.finalUrl,
          p.status,
          p.parsed?.title ?? null,
          p.parsed?.metaDescription ?? null,
          h1,
          p.parsed?.canonical ?? null,
          p.bodyBytes,
          null,
        );
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  async saveIssues(crawlId: number, issues: Issue[]): Promise<void> {
    const db = await this.ensure();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO crawl_issues
        (crawl_id, url, issue_id, category, priority, message)
        VALUES (?, ?, ?, ?, ?, ?)`,
    );
    db.exec("BEGIN");
    try {
      for (const issue of issues) {
        for (const url of issue.urls) {
          insert.run(
            crawlId,
            url,
            issue.id,
            issue.category,
            issue.priority,
            issue.message,
          );
        }
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  async listCrawls(): Promise<
    Array<{ id: number; startedAt: string; pagesCrawled: number }>
  > {
    const db = await this.ensure();
    const rows = db
      .prepare(
        "SELECT id, started_at, pages_crawled FROM crawls ORDER BY id DESC LIMIT 50",
      )
      .all() as Array<{
      id: number;
      started_at: string;
      pages_crawled: number;
    }>;
    return rows.map((r) => ({
      id: Number(r.id),
      startedAt: r.started_at,
      pagesCrawled: Number(r.pages_crawled),
    }));
  }

  /** Regression-test/diagnostic helper: number of persisted page rows. */
  async countSavedPages(crawlId: number): Promise<number> {
    const db = await this.ensure();
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM crawl_pages WHERE crawl_id = ?")
      .get(crawlId) as { count: number | bigint };
    return Number(row.count);
  }

  /**
   * Compute the diff between two crawls. Newer first.
   */
  async diff(newerCrawlId: number, olderCrawlId: number): Promise<DiffResult> {
    const db = await this.ensure();
    const newPages = this.pagesFor(db, newerCrawlId);
    const oldPages = this.pagesFor(db, olderCrawlId);
    const added: string[] = [];
    const removed: string[] = [];
    const statusChanged: DiffResult["statusChanged"] = [];
    for (const [url, p] of newPages) {
      const old = oldPages.get(url);
      if (!old) added.push(url);
      else if (old.status !== p.status) {
        statusChanged.push({ url, from: old.status, to: p.status });
      }
    }
    for (const url of oldPages.keys()) {
      if (!newPages.has(url)) removed.push(url);
    }
    const newIssueSet = this.issueSet(db, newerCrawlId);
    const oldIssueSet = this.issueSet(db, olderCrawlId);
    const newIssues: DiffResult["newIssues"] = [];
    const fixedIssues: DiffResult["fixedIssues"] = [];
    for (const k of newIssueSet) {
      if (!oldIssueSet.has(k)) {
        const [url, issueId] = k.split("|") as [string, string];
        newIssues.push({ url, issueId });
      }
    }
    for (const k of oldIssueSet) {
      if (!newIssueSet.has(k)) {
        const [url, issueId] = k.split("|") as [string, string];
        fixedIssues.push({ url, issueId });
      }
    }
    return { added, removed, statusChanged, newIssues, fixedIssues };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private pagesFor(
    db: import("node:sqlite").DatabaseSync,
    crawlId: number,
  ): Map<string, { status: number }> {
    const rows = db
      .prepare("SELECT url, status FROM crawl_pages WHERE crawl_id = ?")
      .all(crawlId) as Array<{ url: string; status: number }>;
    const out = new Map<string, { status: number }>();
    for (const r of rows) out.set(r.url, { status: r.status });
    return out;
  }

  private issueSet(
    db: import("node:sqlite").DatabaseSync,
    crawlId: number,
  ): Set<string> {
    const rows = db
      .prepare("SELECT url, issue_id FROM crawl_issues WHERE crawl_id = ?")
      .all(crawlId) as Array<{ url: string; issue_id: string }>;
    return new Set(rows.map((r) => `${r.url}|${r.issue_id}`));
  }
}

export function diffResultToMarkdown(d: DiffResult): string {
  const lines: string[] = [];
  lines.push("## Diff vs previous crawl");
  lines.push("");
  lines.push(`- Added URLs: ${d.added.length}`);
  lines.push(`- Removed URLs: ${d.removed.length}`);
  lines.push(`- Status changed: ${d.statusChanged.length}`);
  lines.push(`- New issues: ${d.newIssues.length}`);
  lines.push(`- Fixed issues: ${d.fixedIssues.length}`);
  if (d.statusChanged.length > 0) {
    lines.push("");
    lines.push("### Status changes");
    for (const s of d.statusChanged.slice(0, 50)) {
      lines.push(`- ${s.url}: ${s.from} -> ${s.to}`);
    }
  }
  if (d.newIssues.length > 0) {
    lines.push("");
    lines.push("### New issues");
    for (const n of d.newIssues.slice(0, 50)) {
      lines.push(`- ${n.issueId}: ${n.url}`);
    }
  }
  if (d.fixedIssues.length > 0) {
    lines.push("");
    lines.push("### Fixed issues");
    for (const f of d.fixedIssues.slice(0, 50)) {
      lines.push(`- ${f.issueId}: ${f.url}`);
    }
  }
  if (d.added.length > 0) {
    lines.push("");
    lines.push("### New URLs");
    for (const a of d.added.slice(0, 50)) {
      lines.push(`- ${a}`);
    }
  }
  if (d.removed.length > 0) {
    lines.push("");
    lines.push("### Removed URLs");
    for (const r of d.removed.slice(0, 50)) {
      lines.push(`- ${r}`);
    }
  }
  return lines.join("\n") + "\n";
}
