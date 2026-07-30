import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  MemoryCredentialStore,
  type CredentialRef,
} from "@marketingovo/credentials";
import { AgentSeoDatabase } from "@marketingovo/storage-sqlite";
import { discoverLegacyData, importLegacyData } from "./index.js";

const GSC_SECRET = "gsc-refresh-never-leak";
const GA4_SECRET = "ga4-refresh-never-leak";
const SERPAPI_SECRET = "serpapi-never-leak";
const PSI_SECRET = "psi-never-leak";
const DATAFORSEO_LOGIN = "legacy@example.com";
const DATAFORSEO_PASSWORD = "dataforseo-never-leak";
const ALL_SECRETS = [
  GSC_SECRET,
  GA4_SECRET,
  SERPAPI_SECRET,
  PSI_SECRET,
  DATAFORSEO_LOGIN,
  DATAFORSEO_PASSWORD,
];

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const mode = (path: string): number => statSync(path).mode & 0o777;

function createLegacyCrawlDatabase(path: string): void {
  const database = new DatabaseSync(path);
  try {
    database.exec(`
      CREATE TABLE crawls (
        id INTEGER PRIMARY KEY,
        start_url TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE TABLE crawl_pages (
        crawl_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        final_url TEXT,
        status INTEGER,
        title TEXT,
        meta_description TEXT,
        h1 TEXT,
        canonical TEXT
      );
      CREATE TABLE crawl_issues (
        crawl_id INTEGER NOT NULL,
        issue_id TEXT,
        category TEXT,
        priority TEXT,
        message TEXT,
        url TEXT
      );
      INSERT INTO crawls(id, start_url, started_at, finished_at)
      VALUES(7, 'https://example.com/', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:10.000Z');
      INSERT INTO crawl_pages(crawl_id, url, final_url, status, title, meta_description, h1, canonical)
      VALUES(7, 'https://example.com/legacy', 'https://example.com/legacy', 200, 'Legacy page', 'Imported description', 'Legacy heading', 'https://example.com/legacy');
      INSERT INTO crawl_issues(crawl_id, issue_id, category, priority, message, url)
      VALUES(7, 'legacy-canonical', 'Technical', 'Medium', 'Legacy canonical mismatch', 'https://example.com/legacy');
    `);
  } finally {
    database.close();
  }
}

async function credentialText(
  store: MemoryCredentialStore,
  ref: CredentialRef,
): Promise<string> {
  const bytes = await store.get(ref);
  expect(bytes).not.toBeNull();
  try {
    return Buffer.from(bytes!).toString("utf8");
  } finally {
    bytes?.fill(0);
  }
}

function assertNoSecrets(value: string | Uint8Array): void {
  const serialized =
    typeof value === "string" ? value : Buffer.from(value).toString("utf8");
  for (const secret of ALL_SECRETS) expect(serialized).not.toContain(secret);
}

describe("legacy v0 importer", () => {
  it("non-destructively and idempotently imports audits, crawls, schedules, rules, and every supported credential source", async () => {
    const root = mkdtempSync(join(tmpdir(), "golem-legacy-"));
    const source = join(root, "source");
    const destination = join(root, "destination");
    mkdirSync(source);

    const audits = join(source, "audits.json");
    const crawlDatabase = join(source, "crawls.db");
    const schedule = join(source, "schedule.json");
    const rules = join(source, "custom-rules.json");
    const gscToken = join(source, "gsc-token.json");
    const ga4Token = join(source, "ga4-token.json");
    writeFileSync(
      audits,
      JSON.stringify({
        runs: {
          old: {
            id: "old",
            startUrl: "https://example.com/",
            requestedAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:01:00.000Z",
            status: "completed",
            issues: [
              {
                id: "missing-title",
                priority: "High",
                message: "Missing title",
                urls: ["https://example.com/a"],
              },
            ],
          },
        },
      }),
    );
    createLegacyCrawlDatabase(crawlDatabase);
    writeFileSync(
      schedule,
      JSON.stringify({
        jobs: [
          {
            name: "daily",
            startUrl: "https://example.com/",
            intervalMinutes: 1_440,
            timezone: "Europe/London",
            nextRunAt: "2030-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    writeFileSync(
      rules,
      JSON.stringify({
        rules: [
          {
            id: "legacy-footer",
            match: "contains",
            value: "Legal notice",
            expect: "present",
          },
        ],
      }),
    );
    writeFileSync(gscToken, JSON.stringify({ refresh_token: GSC_SECRET }));
    writeFileSync(ga4Token, JSON.stringify({ refresh_token: GA4_SECRET }));

    const environment = {
      GOLEMSEO_SERPAPI_KEY: SERPAPI_SECRET,
      GOLEMSEO_PSI_API_KEY: PSI_SECRET,
      GOLEMSEO_DATAFORSEO_LOGIN: DATAFORSEO_LOGIN,
      GOLEMSEO_DATAFORSEO_PASSWORD: DATAFORSEO_PASSWORD,
    };
    const inputPaths = [
      audits,
      crawlDatabase,
      schedule,
      rules,
      gscToken,
      ga4Token,
    ];
    const originals = new Map(
      inputPaths.map((path) => [
        path,
        { bytes: readFileSync(path), sha256: sha256(path), mode: mode(path) },
      ]),
    );

    const discovery = discoverLegacyData(source, environment);
    expect(discovery).toMatchObject({
      auditFiles: [audits],
      crawlDatabases: [crawlDatabase],
      scheduleFiles: [schedule],
      customRuleFiles: [rules],
      environmentKeys: Object.keys(environment).sort(),
    });
    expect(discovery.tokenFiles).toEqual([
      { provider: "google-search-console", path: gscToken },
      { provider: "google-analytics-4", path: ga4Token },
    ]);

    const credentialStore = new MemoryCredentialStore();
    const receipt = await importLegacyData({
      sourceDirectory: source,
      destinationDirectory: destination,
      credentialStore,
      environment,
    });
    expect(receipt.originalsModified).toBe(false);
    expect(receipt.counts).toEqual({
      projects: 1,
      runs: 2,
      pages: 1,
      issues: 2,
      schedules: 1,
      credentials: 5,
      customRuleFiles: 1,
    });
    expect(
      receipt.inputs.map(({ path, sha256: digest }) => [path, digest]).sort(),
    ).toEqual(
      inputPaths.map((path) => [path, originals.get(path)!.sha256]).sort(),
    );
    assertNoSecrets(JSON.stringify(receipt));

    for (const [path, original] of originals) {
      expect(readFileSync(path)).toEqual(original.bytes);
      expect(sha256(path)).toBe(original.sha256);
      if (process.platform !== "win32") expect(mode(path)).toBe(original.mode);
    }

    const databasePath = join(destination, "marketingovo.db");
    const database = new AgentSeoDatabase({ path: databasePath });
    try {
      const projects = database.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.canonicalUrl).toBe("https://example.com/");
      const runs = database.listRuns(projects[0]!.id);
      expect(runs).toHaveLength(2);
      expect(
        runs.reduce(
          (count, run) => count + database.listPages(run.id).length,
          0,
        ),
      ).toBe(1);
      expect(
        runs.reduce(
          (count, run) => count + database.listIssues(run.id).length,
          0,
        ),
      ).toBe(2);
      expect(database.listSchedules(projects[0]!.id)).toEqual([
        expect.objectContaining({
          cron: "0 0 */1 * *",
          timezone: "Europe/London",
          enabled: true,
          nextRunAt: "2030-01-01T00:00:00.000Z",
        }),
      ]);
      expect(database.listIntegrations()).toHaveLength(5);
      assertNoSecrets(JSON.stringify(database.listIntegrations()));
    } finally {
      database.close();
    }
    assertNoSecrets(readFileSync(databasePath));

    expect(
      await credentialText(credentialStore, {
        provider: "google-search-console",
        account: "legacy-import",
        kind: "oauth-token",
      }),
    ).toBe(JSON.stringify({ refresh_token: GSC_SECRET }));
    expect(
      await credentialText(credentialStore, {
        provider: "google-analytics-4",
        account: "legacy-import",
        kind: "oauth-token",
      }),
    ).toBe(JSON.stringify({ refresh_token: GA4_SECRET }));
    expect(
      await credentialText(credentialStore, {
        provider: "serpapi",
        account: "legacy-import",
        kind: "credentials",
      }),
    ).toBe(JSON.stringify({ apiKey: SERPAPI_SECRET }));
    expect(
      await credentialText(credentialStore, {
        provider: "pagespeed-insights",
        account: "legacy-import",
        kind: "credentials",
      }),
    ).toBe(JSON.stringify({ apiKey: PSI_SECRET }));
    expect(
      await credentialText(credentialStore, {
        provider: "dataforseo",
        account: "legacy-import",
        kind: "credentials",
      }),
    ).toBe(
      JSON.stringify({
        login: DATAFORSEO_LOGIN,
        password: DATAFORSEO_PASSWORD,
      }),
    );

    const copiedRules = join(
      destination,
      "legacy-import",
      "rules",
      "custom-rules.json",
    );
    expect(readFileSync(copiedRules)).toEqual(readFileSync(rules));
    if (process.platform !== "win32") {
      expect(mode(destination)).toBe(0o700);
      expect(mode(databasePath)).toBe(0o600);
      expect(mode(copiedRules)).toBe(0o600);
    }

    const second = await importLegacyData({
      sourceDirectory: source,
      destinationDirectory: destination,
      credentialStore,
      environment,
    });
    expect(second.counts).toEqual({
      projects: 0,
      runs: 0,
      pages: 0,
      issues: 0,
      schedules: 0,
      credentials: 0,
      customRuleFiles: 0,
    });
    const reopened = new AgentSeoDatabase({ path: databasePath });
    try {
      expect(reopened.listProjects()).toHaveLength(1);
      expect(reopened.listRuns()).toHaveLength(2);
      expect(reopened.listSchedules()).toHaveLength(1);
      expect(reopened.listIntegrations()).toHaveLength(5);
    } finally {
      reopened.close();
    }
    for (const [path, original] of originals) {
      expect(sha256(path)).toBe(original.sha256);
      expect(readFileSync(path)).toEqual(original.bytes);
    }
    for (const receiptFile of readdirSync(
      join(destination, "migration-receipts"),
    )) {
      assertNoSecrets(
        readFileSync(
          join(destination, "migration-receipts", receiptFile),
          "utf8",
        ),
      );
      if (process.platform !== "win32") {
        expect(mode(join(destination, "migration-receipts", receiptFile))).toBe(
          0o600,
        );
      }
    }
  });
});
