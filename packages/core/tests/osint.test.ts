import { describe, expect, it } from "vitest";
import type { CrawlOutcome } from "../src/orchestrator.js";
import type { CrawledPage } from "../src/checks/index.js";
import type { Report } from "../src/core/report/index.js";
import {
  runOsintResearch,
  type OsintResearchOptions,
} from "../src/integrations/osint.js";

const NOW = new Date("2026-08-03T12:00:00.000Z");

function page(
  url: string,
  parsed: NonNullable<CrawledPage["parsed"]>,
): CrawledPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: "text/html",
    responseTimeMs: 12,
    bodyBytes: 512,
    redirectChain: [],
    headers: { server: "example" },
    robotsAllowed: true,
    parsed,
    error: null,
    fetchDurationMs: 12,
    extractions: [],
  };
}

function parsed(
  url: string,
  overrides: Partial<NonNullable<CrawledPage["parsed"]>> = {},
) {
  return {
    finalUrl: url,
    htmlLang: "en",
    title: "Example company",
    metaDescription: "A public example company.",
    canonical: url,
    robotsMeta: null,
    hreflang: [],
    h1: [],
    h2: [],
    images: [],
    imagesWithoutDimensions: [],
    picturesMissingImg: 0,
    internalLinks: [],
    externalLinks: ["https://www.linkedin.com/company/example"],
    nofollowLinks: [],
    wordCount: 10,
    text: "Example",
    hasViewport: true,
    viewportContent: "width=device-width",
    domNodeCount: 10,
    duplicateIds: [],
    ogTitle: null,
    ogDescription: null,
    jsonLd: [
      JSON.stringify({
        "@context": "https://schema.org",
        sameAs: ["https://www.youtube.com/@example"],
      }),
    ],
    ...overrides,
  };
}

function outcome(target: string, pages: CrawledPage[]): CrawlOutcome {
  return {
    report: {
      startUrl: target,
      sitemap: {
        origin: target,
        state: "available",
        sourceUrl: `${target}/sitemap.xml`,
        statusCode: 200,
        files: [],
        pageUrls: [target, `${target}about`],
        warnings: [],
      },
    } as unknown as Report,
    runId: "crawl-1",
    index: {
      startUrl: target,
      pages: new Map(pages.map((item) => [item.url, item])),
      robots: new Map(),
      finishedAt: NOW.toISOString(),
      durationMs: 42,
      config: {} as CrawlOutcome["index"]["config"],
    },
  };
}

function baseOptions(
  overrides: Partial<OsintResearchOptions> = {},
): OsintResearchOptions {
  return {
    targetUrls: ["https://example.com/"],
    now: NOW,
    crawlFn: async (options) => {
      const target = options.startUrl;
      return outcome(target, [page(target, parsed(target))]);
    },
    cadenceFn: async (target) => ({
      target,
      cadence: null,
      unavailable: "no-feed-discovered",
    }),
    ...overrides,
  };
}

describe("public-web OSINT dossier", () => {
  it("keeps exact profile links and sameAs claims as an evidence graph", async () => {
    const dossier = await runOsintResearch(baseOptions());
    const target = dossier.targets[0]!;

    expect(dossier.schemaVersion).toBe("osint-dossier.v1");
    expect(dossier.policy.personalData).toBe("disabled");
    expect(target.evidence.some((item) => item.kind === "social-profile")).toBe(
      true,
    );
    expect(
      target.evidence.some((item) => item.kind === "structured-identity"),
    ).toBe(true);
    expect(target.relationships.some((item) => item.type === "same_as")).toBe(
      true,
    );
    expect(target.relationships.some((item) => item.type === "links_to")).toBe(
      true,
    );
  });

  it("keeps missing feed evidence unavailable instead of inventing a zero", async () => {
    const dossier = await runOsintResearch(baseOptions());
    const cadence = dossier.targets[0]!.evidence.find(
      (item) => item.kind === "publishing-cadence",
    );
    expect(cadence?.state).toBe("insufficient");
    expect(cadence?.value).toBeNull();
    expect(
      dossier.findings.some((item) => item.title.includes("publishing")),
    ).toBe(false);
  });

  it("preserves a failed target as a bounded, cited state", async () => {
    const dossier = await runOsintResearch(
      baseOptions({
        targetUrls: ["https://bad.example/"],
        crawlFn: async () => {
          throw new Error("blocked by egress policy");
        },
      }),
    );
    expect(dossier.coverage.state).toBe("missing");
    expect(dossier.targets[0]?.status).toBe("failed");
    expect(dossier.targets[0]?.error).toContain("egress");
    expect(dossier.findings[0]?.actionable).toBe(false);
  });

  it("caps the target set so a pasted list cannot become an unbounded scan", async () => {
    const dossier = await runOsintResearch(
      baseOptions({
        targetUrls: Array.from(
          { length: 12 },
          (_, index) => `https://example-${index}.com/`,
        ),
      }),
    );
    expect(dossier.targets).toHaveLength(5);
    expect(dossier.coverage.targetsRequested).toBe(5);
  });

  it("keeps malformed targets safe to serialize as failed evidence", async () => {
    const dossier = await runOsintResearch(
      baseOptions({ targetUrls: ["not-a-url"] }),
    );
    expect(dossier.targets[0]?.status).toBe("failed");
    expect(dossier.targets[0]?.evidence[0]?.sourceUrl).toBeNull();
  });

  it("deduplicates equivalent public target URLs before spending the budget", async () => {
    const dossier = await runOsintResearch(
      baseOptions({
        targetUrls: [
          "https://example.com",
          "https://example.com/",
          "https://other.example/",
        ],
      }),
    );
    expect(dossier.coverage.targetsRequested).toBe(2);
    expect(dossier.targets.map((target) => target.targetUrl)).toEqual([
      "https://example.com/",
      "https://other.example/",
    ]);
  });
});
