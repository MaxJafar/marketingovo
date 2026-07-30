import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Report as EngineReport } from "@marketingovo/core";
import { MarketingovoLocalRuntime } from "./index.js";

async function waitForTerminalRun(
  runtime: MarketingovoLocalRuntime,
  runId: string,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await runtime.runs.get(runId);
    if (
      run &&
      ["succeeded", "partial", "failed", "cancelled"].includes(run.status)
    ) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run ${runId} did not finish`);
}

describe("run-specific SEO Health history", () => {
  it("stores an unavailable first delta and a real prior-audit delta thereafter", async () => {
    let call = 0;
    const engine = {
      async crawl(options: { startUrl: string }) {
        call += 1;
        const hasHighIssue = call === 1;
        const generatedAt = `2026-07-${call === 1 ? "14" : "15"}T12:00:00.000Z`;
        const report = {
          generatedAt,
          startUrl: options.startUrl,
          durationMs: 5,
          config: {
            maxUrls: 10,
            maxRuntimeMs: 60_000,
            requestsPerSecond: 2,
          },
          summary: {
            pagesCrawled: 1,
            issuesByPriority: {
              High: hasHighIssue ? 1 : 0,
              Medium: 0,
              Low: 0,
            },
            issuesByCategory: hasHighIssue ? { technical: 1 } : {},
          },
          issues: hasHighIssue
            ? [
                {
                  id: "missing-canonical",
                  category: "technical",
                  priority: "High",
                  message: "Canonical is missing",
                  urls: [options.startUrl],
                  moduleId: "technical",
                },
              ]
            : [],
          pages: [
            {
              url: options.startUrl,
              finalUrl: options.startUrl,
              status: 200,
              title: "Home",
              contentType: "text/html",
              canonical: options.startUrl,
              robotsMeta: null,
              xRobotsTag: null,
              robotsAllowed: true,
              htmlParsed: true,
              error: null,
              redirectChain: [],
              responseTimeMs: 1,
              vitals: null,
            },
          ],
          topUrls: [],
        } as unknown as EngineReport;
        return { runId: `engine-health-${call}`, report };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Health history</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-health-history-")),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "Health history",
        canonicalUrl: "https://example.com/",
      });
      const first = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "health-first",
      );
      expect((await waitForTerminalRun(runtime, first.id)).status).toBe(
        "succeeded",
      );
      expect(await runtime.projects.overview(project.id)).toMatchObject({
        seoHealth: { value: 50, state: "available" },
        healthChange: { value: null, state: "unavailable" },
      });

      const second = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "health-second",
      );
      expect((await waitForTerminalRun(runtime, second.id)).status).toBe(
        "succeeded",
      );
      expect(await runtime.projects.overview(project.id)).toMatchObject({
        seoHealth: { value: 100, state: "available" },
        healthChange: { value: 50, state: "available" },
      });

      const changes = runtime.database
        .listMetricHistory(project.id)
        .filter(({ key }) => key === "health_change");
      expect(changes.map(({ metric }) => metric.value)).toEqual([null, 50]);
    } finally {
      runtime.close();
    }
  });
});
