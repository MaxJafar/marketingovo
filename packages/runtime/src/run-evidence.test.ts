import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Report as EngineReport } from "@agentseoapp/core";
import { AgentSeoLocalRuntime } from "./index.js";

const generatedAt = "2026-07-15T12:00:00.000Z";

function evidenceReport(startUrl: string): EngineReport {
  const root = "https://example.com/";
  const fr = "https://example.com/fr";
  const redirected = "https://example.com/new";
  return {
    generatedAt,
    startUrl,
    durationMs: 10,
    config: { maxUrls: 10, maxRuntimeMs: 10_000, requestsPerSecond: 5 },
    summary: {
      pagesCrawled: 3,
      issuesByPriority: { High: 0, Medium: 0, Low: 0 },
      issuesByCategory: {},
    },
    sitemap: {
      origin: "https://example.com",
      sourceUrl: "https://example.com/sitemap.xml",
      state: "available",
      statusCode: 200,
      pageUrls: [root, redirected, "https://example.com/ghost"],
      files: [
        {
          url: "https://example.com/sitemap.xml",
          kind: "urlset",
          statusCode: 200,
          locCount: 3,
        },
      ],
      warnings: [],
    },
    issues: [],
    pages: [
      {
        url: root,
        finalUrl: root,
        status: 200,
        title: "Home",
        contentType: "text/html",
        canonical: root,
        robotsMeta: null,
        xRobotsTag: null,
        robotsAllowed: true,
        htmlParsed: true,
        error: null,
        redirectChain: [],
        responseTimeMs: 4,
        vitals: null,
        crawlDepth: 0,
        discoveredFrom: null,
        htmlLang: "en",
        hreflang: {
          sourceUrl: root,
          finalUrl: root,
          htmlLang: "en",
          selfLanguage: "en",
          hasXDefault: false,
          alternates: [
            {
              lang: "en",
              declaredUrl: root,
              resolvedUrl: root,
              selfReference: true,
              targetState: "self",
              targetStatusCode: 200,
              reciprocal: "not_applicable",
              expectedReturnLanguage: "en",
              observedReturnLanguages: [],
            },
            {
              lang: "fr",
              declaredUrl: fr,
              resolvedUrl: fr,
              selfReference: false,
              targetState: "crawled",
              targetStatusCode: 200,
              reciprocal: "matched",
              expectedReturnLanguage: "en",
              observedReturnLanguages: ["en"],
            },
          ],
        },
        extractions: [{ label: "price", value: "19.00" }],
        internalLinks: [
          {
            targetUrl: fr,
            occurrences: 2,
            followOccurrences: 1,
            nofollowOccurrences: 1,
            anchorTexts: ["French", "Version française"],
            placements: ["navigation", "footer"],
          },
          {
            targetUrl: "https://example.com/old",
            occurrences: 1,
            followOccurrences: 1,
            nofollowOccurrences: 0,
            anchorTexts: ["Product"],
            placements: ["main"],
          },
          {
            targetUrl: "https://example.com/not-crawled",
            occurrences: 1,
            followOccurrences: 1,
            nofollowOccurrences: 0,
            anchorTexts: ["Missing page"],
            placements: ["main"],
          },
        ],
      },
      {
        url: fr,
        finalUrl: fr,
        status: 200,
        title: "French",
        contentType: "text/html",
        canonical: fr,
        robotsMeta: null,
        xRobotsTag: null,
        robotsAllowed: true,
        htmlParsed: true,
        error: null,
        redirectChain: [],
        responseTimeMs: 4,
        vitals: null,
        crawlDepth: 1,
        discoveredFrom: root,
        htmlLang: "fr",
        hreflang: null,
        extractions: [],
        internalLinks: [
          {
            targetUrl: root,
            occurrences: 1,
            followOccurrences: 1,
            nofollowOccurrences: 0,
            anchorTexts: ["Home"],
            placements: ["navigation"],
          },
        ],
      },
      {
        url: "https://example.com/old",
        finalUrl: redirected,
        status: 200,
        title: "New",
        contentType: "text/html",
        canonical: redirected,
        robotsMeta: null,
        xRobotsTag: null,
        robotsAllowed: true,
        htmlParsed: true,
        error: null,
        redirectChain: [redirected],
        responseTimeMs: 2,
        vitals: null,
        crawlDepth: 1,
        discoveredFrom: root,
        htmlLang: "en",
        hreflang: null,
        extractions: [],
        internalLinks: [],
      },
    ],
    topUrls: [],
  };
}

async function waitForTerminal(runtime: AgentSeoLocalRuntime, runId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await runtime.runs.get(runId);
    if (run && ["succeeded", "partial", "failed"].includes(run.status))
      return run;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return runtime.runs.get(runId);
}

describe("run evidence runtime", () => {
  let runtime: AgentSeoLocalRuntime | undefined;
  afterEach(() => runtime?.close());

  it("persists a versioned summary and paginates evidence without losing totals", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "agentseo-run-evidence-"));
    const root = "https://example.com/";
    const fr = "https://example.com/fr";
    const redirected = "https://example.com/new";
    const report = evidenceReport("https://example.com/");
    runtime = new AgentSeoLocalRuntime({
      dataDir,
      engine: {
        crawl: async () => ({ report, runId: "engine-run" }),
        reportToJson: (value) => JSON.stringify(value),
        reportToHtml: () => "<!doctype html><title>Evidence</title>",
        reportToCsv: () => "url,status\n",
      },
    });
    const project = await runtime.projects.create({
      name: "Evidence",
      canonicalUrl: "https://example.com/",
    });
    const run = await runtime.runs.start(
      { projectId: project.id, workflowId: "audit" },
      "run-evidence-test",
    );
    expect((await waitForTerminal(runtime, run.id))?.status).toBe("succeeded");
    expect(
      existsSync(join(dataDir, "artifacts", run.id, "run-evidence.json")),
    ).toBe(true);

    const crawl = await runtime.runs.evidence(run.id, {
      section: "crawl",
      limit: 1,
      offset: 0,
    });
    expect(crawl).toMatchObject({
      state: "available",
      generatedAt,
      pageInfo: { total: 3, nextOffset: 1 },
      items: [{ kind: "crawl", crawlDepth: 0 }],
      sitemap: {
        state: "available",
        declaredUrls: 3,
        discoveredIndexableUrls: 3,
        matchedIndexableUrls: 2,
        coverage: 2 / 3,
        missingIndexable: { total: 1, urls: ["https://example.com/fr"] },
        declaredNotCrawled: {
          total: 1,
          urls: ["https://example.com/ghost"],
        },
      },
    });

    const redirect = await runtime.runs.evidence(run.id, {
      section: "redirects",
      limit: 50,
      offset: 0,
    });
    expect(redirect?.items).toEqual([
      expect.objectContaining({
        kind: "redirect",
        hopCount: 1,
        chain: ["https://example.com/old", "https://example.com/new"],
      }),
    ]);
    const hreflang = await runtime.runs.evidence(run.id, {
      section: "hreflang",
      limit: 50,
      offset: 0,
    });
    expect(hreflang?.items[0]).toMatchObject({
      kind: "hreflang",
      selfLanguage: "en",
      alternates: [
        expect.any(Object),
        { reciprocal: "matched", observedReturnLanguages: ["en"] },
      ],
    });
    const extraction = await runtime.runs.evidence(run.id, {
      section: "extractions",
      limit: 50,
      offset: 0,
      search: "home",
    });
    expect(extraction?.items).toEqual([
      expect.objectContaining({
        kind: "extraction",
        fields: [{ label: "price", value: "19.00", truncated: false }],
      }),
    ]);

    const outlinks = await runtime.runs.links(run.id, {
      pageUrl: root,
      direction: "outlinks",
      limit: 2,
      offset: 0,
    });
    expect(outlinks).toMatchObject({
      version: "link-graph-v1",
      state: "available",
      page: { url: root, crawlDepth: 0 },
      summary: {
        inlinkSources: 1,
        outlinkTargets: 3,
        outlinkOccurrences: 4,
        redirectedOutlinkTargets: 1,
        uncrawledOutlinkTargets: 1,
      },
      pageInfo: { total: 3, nextOffset: 2 },
    });
    expect(outlinks?.items).toEqual([
      expect.objectContaining({
        targetUrl: "https://example.com/old",
        targetPageUrl: redirected,
        targetState: "redirected",
      }),
      expect.objectContaining({
        targetUrl: "https://example.com/not-crawled",
        targetState: "uncrawled",
      }),
    ]);
    const inlinks = await runtime.runs.links(run.id, {
      pageUrl: fr,
      direction: "inlinks",
      limit: 50,
      offset: 0,
      search: "French",
    });
    expect(inlinks?.items).toEqual([
      expect.objectContaining({
        sourceUrl: root,
        sourceTitle: "Home",
        occurrences: 2,
        nofollowOccurrences: 1,
      }),
    ]);
  });

  it("fails closed when the evidence artifact no longer matches its checksum", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "agentseo-run-evidence-"));
    const report = evidenceReport("https://example.com/");
    runtime = new AgentSeoLocalRuntime({
      dataDir,
      engine: {
        crawl: async () => ({ report, runId: "engine-run" }),
        reportToJson: (value) => JSON.stringify(value),
        reportToHtml: () => "<!doctype html>",
        reportToCsv: () => "url,status\n",
      },
    });
    const project = await runtime.projects.create({
      name: "Integrity",
      canonicalUrl: "https://example.com/",
    });
    const run = await runtime.runs.start({ projectId: project.id });
    expect((await waitForTerminal(runtime, run.id))?.status).toBe("succeeded");
    writeFileSync(
      join(dataDir, "artifacts", run.id, "run-evidence.json"),
      "{}",
    );

    const evidence = await runtime.runs.evidence(run.id, {
      section: "crawl",
      limit: 50,
      offset: 0,
    });
    expect(evidence).toMatchObject({
      state: "partial",
      sitemap: {
        state: "not_captured",
        declaredUrls: null,
        matchedIndexableUrls: null,
      },
    });
    expect(evidence?.warnings.join(" ")).toContain("integrity check");
  });
});
