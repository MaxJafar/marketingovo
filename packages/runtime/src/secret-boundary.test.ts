import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { EncryptedFileCredentialStore } from "@marketingovo/credentials";
import { ConsoleLogger, type Report as EngineReport } from "@marketingovo/core";
import { createDatabaseBackup } from "@marketingovo/storage-sqlite";
import { AgentSeoLocalRuntime } from "./index.js";

const CANARY = "psi-runtime-canary-Z9y8X7w6V5u4";
const TEST_TIMEOUT_MS = 60_000;

function reportWithAccidentalCredentialEcho(apiKey: string): EngineReport {
  const generatedAt = "2026-07-15T12:00:00.000Z";
  return {
    generatedAt,
    startUrl: "https://example.com/",
    durationMs: 10,
    config: {
      maxUrls: 1,
      maxRuntimeMs: 30_000,
      requestsPerSecond: 1,
    },
    summary: {
      pagesCrawled: 1,
      issuesByPriority: { High: 1, Medium: 0, Low: 0 },
      issuesByCategory: { Performance: 1 },
    },
    issues: [
      {
        id: "provider-echo",
        moduleId: "pagespeed-insights",
        category: "Performance",
        priority: "High",
        // Deliberately unlabeled: only run-scoped exact-value redaction can
        // catch this class of accidental provider echo.
        message: `Provider response accidentally echoed ${apiKey}`,
        urls: ["https://example.com/"],
        fix: "Reconnect the provider and retry the measurement.",
        detail: {
          apiKey,
          nested: {
            authorization: `Bearer ${apiKey}`,
            endpoint: `https://provider.test/result?token=${apiKey}`,
          },
        },
      },
    ],
    pages: [
      {
        url: "https://example.com/",
        finalUrl: "https://example.com/",
        status: 200,
        title: "Example",
        contentType: "text/html",
        canonical: "https://example.com/",
        robotsMeta: null,
        xRobotsTag: null,
        robotsAllowed: true,
        htmlParsed: true,
        redirectChain: [],
        responseTimeMs: 10,
        error: `upstream apiKey=${apiKey}`,
        vitals: null,
      },
    ],
    topUrls: [],
  } as EngineReport;
}

async function waitForTerminalRun(
  runtime: AgentSeoLocalRuntime,
  runId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof runtime.runs.get>>>> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = await runtime.runs.get(runId);
    if (
      run &&
      ["succeeded", "partial", "failed", "cancelled"].includes(run.status)
    ) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for the secret-boundary audit");
}

function expectFileNotToContain(path: string, secret: string): void {
  expect(readFileSync(path).includes(Buffer.from(secret))).toBe(false);
}

describe("runtime secret serialization boundary", () => {
  it(
    "keeps a run credential only in the decryptable vault and out of DB, events, reports, exports, backups, and logs",
    async () => {
      const dataDir = mkdtempSync(
        join(tmpdir(), "marketingovo-secret-boundary-"),
      );
      const vaultPath = join(dataDir, "vault", "credentials.json");
      const credentialStore = new EncryptedFileCredentialStore(
        vaultPath,
        "a strong boundary test password",
      );
      const renderedInputs: string[] = [];
      const runtime = new AgentSeoLocalRuntime({
        dataDir,
        credentialStore,
        engine: {
          async crawl(options) {
            const apiKey = (options.pageSpeedInsights as { apiKey: string })
              .apiKey;
            expect(apiKey).toBe(CANARY);
            return {
              runId: "secret-boundary-engine-run",
              report: reportWithAccidentalCredentialEcho(apiKey),
            };
          },
          reportToJson(report) {
            const serialized = JSON.stringify(report);
            renderedInputs.push(serialized);
            return serialized;
          },
          reportToHtml(report) {
            const serialized = JSON.stringify(report);
            renderedInputs.push(serialized);
            return `<!doctype html><title>Report</title><pre>${serialized}</pre>`;
          },
          reportToCsv(report) {
            const serialized = JSON.stringify(report);
            renderedInputs.push(serialized);
            return `field,value\nreport,${JSON.stringify(serialized)}\n`;
          },
        },
      });

      try {
        const project = await runtime.projects.create({
          name: "Secret boundary",
          canonicalUrl: "https://example.com/",
        });
        const saved = await runtime.integrations.saveSecret(
          "pagespeed-insights",
          "default",
          "credentials",
          Buffer.from(JSON.stringify({ apiKey: CANARY })),
        );
        expect(JSON.stringify(saved)).not.toContain(CANARY);

        const started = await runtime.runs.start(
          { projectId: project.id, workflowId: "audit" },
          "secret-boundary-run",
        );
        const completed = await waitForTerminalRun(runtime, started.id);
        expect(completed.status).toBe("succeeded");

        const publicState = JSON.stringify({
          run: completed,
          issues: await runtime.runs.issues(started.id),
          actions: await runtime.actions.list(project.id),
          pages: runtime.database.listPages(started.id),
          events: runtime.listRunEvents(started.id),
          modules: runtime.database.listRunModules(started.id),
          integrations: await runtime.integrations.list(project.id),
        });
        expect(publicState).not.toContain(CANARY);
        expect(publicState).toContain("[REDACTED]");

        expect(renderedInputs).toHaveLength(3);
        for (const rendered of renderedInputs) {
          expect(rendered).not.toContain(CANARY);
          expect(rendered).toContain("[REDACTED]");
        }

        const artifacts = runtime.database.listProjectArtifacts(project.id);
        expect(artifacts.map((artifact) => artifact.kind).sort()).toEqual([
          "report.csv",
          "report.html",
          "report.json",
          "report.pdf",
          "run-evidence.json",
        ]);
        for (const artifact of artifacts) {
          expectFileNotToContain(artifact.path, CANARY);
        }
        for (const format of ["json", "html", "csv", "pdf"] as const) {
          const bytes = await runtime.reports.get(started.id, format);
          expect(bytes).not.toBeNull();
          expect(Buffer.from(bytes!).includes(Buffer.from(CANARY))).toBe(false);
          if (format === "pdf") {
            const pdf = await PDFDocument.load(bytes!);
            expect(pdf.getTitle()).toBe("Marketingovo audit");
          }
        }

        const bundle = await runtime.exportProject(project.id);
        expect(Buffer.from(bundle).includes(Buffer.from(CANARY))).toBe(false);
        const parsedBundle = JSON.parse(
          Buffer.from(bundle).toString("utf8"),
        ) as {
          secretsIncluded: boolean;
          artifacts: Array<{ contentIncluded: boolean }>;
        };
        expect(parsedBundle.secretsIncluded).toBe(false);
        expect(
          parsedBundle.artifacts.every((item) => item.contentIncluded),
        ).toBe(true);

        const backup = await createDatabaseBackup(
          runtime.database,
          join(dataDir, "backups", "secret-boundary.db"),
        );
        expectFileNotToContain(backup.path, CANARY);
        for (const databaseFile of [
          join(dataDir, "marketingovo.db"),
          join(dataDir, "marketingovo.db-wal"),
          join(dataDir, "marketingovo.db-shm"),
        ]) {
          if (existsSync(databaseFile))
            expectFileNotToContain(databaseFile, CANARY);
        }
        expectFileNotToContain(vaultPath, CANARY);

        const stored = await credentialStore.get({
          provider: "pagespeed-insights",
          account: "default",
          kind: "credentials",
        });
        expect(Buffer.from(stored!).toString("utf8")).toContain(CANARY);
        stored!.fill(0);

        const consoleOutput = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);
        try {
          new ConsoleLogger().error(`provider failed apiKey=${CANARY}`, {
            nested: { accessToken: CANARY },
          });
          const serialized = consoleOutput.mock.calls
            .map((call) => String(call[0]))
            .join("\n");
          expect(serialized).not.toContain(CANARY);
          expect(serialized).toContain("[REDACTED]");
        } finally {
          consoleOutput.mockRestore();
        }
      } finally {
        runtime.close();
      }
    },
    TEST_TIMEOUT_MS,
  );
});
