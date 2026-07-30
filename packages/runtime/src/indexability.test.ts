import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "./index.js";
import {
  assessEnginePageIndexability,
  summarizePageIndexability,
  type EnginePageIndexabilityEvidence,
} from "./indexability.js";

const indexable: EnginePageIndexabilityEvidence = {
  status: 200,
  finalUrl: "https://example.com/",
  contentType: "text/html",
  canonical: "https://example.com/",
  robotsMeta: null,
  xRobotsTag: null,
  robotsAllowed: true,
  htmlParsed: true,
  error: null,
};

describe("runtime page indexability", () => {
  it("does not infer indexability from a 2xx status alone", () => {
    expect(
      assessEnginePageIndexability({
        status: 200,
        finalUrl: "https://example.com/legacy",
      }),
    ).toEqual({ indexable: null, reason: "missing_content_type" });
  });

  it("reports known-result coverage separately from the indexable ratio", () => {
    const summary = summarizePageIndexability([
      indexable,
      {
        ...indexable,
        finalUrl: "https://example.com/noindex",
        robotsMeta: "noindex",
      },
      {
        ...indexable,
        finalUrl: "https://example.com/timeout",
        status: 0,
        error: "timeout",
      },
      {
        ...indexable,
        finalUrl: "https://example.com/unknown",
        canonical: "https://example.com/unknown",
        robotsAllowed: null,
      },
    ]);

    expect(summary.assessments.map((result) => result.reason)).toEqual([
      "indexable",
      "meta_noindex",
      "fetch_error",
      "robots_unknown",
    ]);
    expect(summary).toMatchObject({
      indexablePages: 1,
      knownPages: 2,
      totalPages: 4,
      value: 0.5,
      coverage: 0.5,
    });
  });

  it("returns unavailable instead of a fake zero when every page is unknown", () => {
    expect(
      summarizePageIndexability([
        { status: 0, finalUrl: "https://example.com/", error: "timeout" },
      ]),
    ).toMatchObject({ value: null, coverage: 0, knownPages: 0 });
  });

  it("persists reasons and exposes evidence coverage without fake negatives", async () => {
    const pages = [
      indexable,
      {
        ...indexable,
        finalUrl: "https://example.com/noindex",
        robotsMeta: "noindex",
      },
      {
        ...indexable,
        finalUrl: "https://example.com/timeout",
        status: 0,
        error: "timeout",
      },
      {
        ...indexable,
        finalUrl: "https://example.com/robots-unknown",
        canonical: "https://example.com/robots-unknown",
        robotsAllowed: null,
      },
    ];
    const engine = {
      async crawl() {
        return {
          runId: "indexability-persistence",
          report: {
            generatedAt: new Date().toISOString(),
            startUrl: "https://example.com/",
            durationMs: 4,
            config: {
              maxUrls: 100,
              maxRuntimeMs: 60_000,
              requestsPerSecond: 2,
            },
            summary: {
              pagesCrawled: pages.length,
              issuesByPriority: { High: 0, Medium: 0, Low: 0 },
              issuesByCategory: {},
            },
            issues: [],
            pages: pages.map((page) => ({
              ...page,
              url: page.finalUrl,
              title: null,
              contentType: page.contentType ?? "text/html",
              canonical: page.canonical ?? null,
              robotsMeta: page.robotsMeta ?? null,
              xRobotsTag: page.xRobotsTag ?? null,
              robotsAllowed: page.robotsAllowed ?? null,
              htmlParsed: page.htmlParsed ?? true,
              error: page.error ?? null,
              redirectChain: [],
              responseTimeMs: 1,
              vitals: null,
            })),
            topUrls: [],
          },
        };
      },
      reportToJson: () => "{}",
      reportToHtml: () => "<!doctype html><title>Indexability</title>",
      reportToCsv: () => "url,status\n",
    };
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-indexability-")),
      engine,
    });
    try {
      const project = await runtime.projects.create({
        name: "Indexability",
        canonicalUrl: "https://example.com/",
      });
      const run = await runtime.runs.start(
        { projectId: project.id, workflowId: "audit" },
        "indexability-persistence",
      );
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const current = await runtime.runs.get(run.id);
        if (
          current &&
          ["succeeded", "partial", "failed", "cancelled"].includes(
            current.status,
          )
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const overview = await runtime.projects.overview(project.id);
      expect(overview.indexableCoverage).toMatchObject({
        value: 0.5,
        state: "available",
        coverage: 0.5,
      });
      expect(overview.indexableCoverage.note).toContain(
        "Classified 2 of 4 crawled pages; 2 remain unknown",
      );

      const stored = runtime.listPages(run.id);
      expect(
        stored.map((page) => ({
          url: page.canonicalUrl,
          indexable: page.indexable,
          reason: page.payload.indexabilityReason,
        })),
      ).toEqual([
        {
          url: "https://example.com/",
          indexable: true,
          reason: "indexable",
        },
        {
          url: "https://example.com/noindex",
          indexable: false,
          reason: "meta_noindex",
        },
        {
          url: "https://example.com/robots-unknown",
          indexable: null,
          reason: "robots_unknown",
        },
        {
          url: "https://example.com/timeout",
          indexable: null,
          reason: "fetch_error",
        },
      ]);
    } finally {
      runtime.close();
    }
  });
});
