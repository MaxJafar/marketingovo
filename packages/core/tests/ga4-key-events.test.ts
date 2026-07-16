import { describe, expect, it } from "vitest";
import {
  reportToJson,
  reportToMarkdown,
  type Report,
} from "../src/core/report/index.js";

function reportWithKeyEvents(): Report {
  return {
    generatedAt: "2026-07-15T12:00:00.000Z",
    startUrl: "https://example.com/",
    durationMs: 10,
    config: {
      maxUrls: 10,
      maxRuntimeMs: 1_000,
      requestsPerSecond: 1,
    },
    summary: {
      pagesCrawled: 0,
      issuesByPriority: { High: 0, Medium: 0, Low: 0 },
      issuesByCategory: {},
    },
    issues: [],
    pages: [],
    topUrls: [],
    realData: {
      periodStart: "2026-06-15",
      periodEnd: "2026-07-15",
      gsc: [],
      ga4: [
        {
          page: "/landing",
          sessions: 20,
          pageViews: 25,
          engagementRate: 0.6,
          bounceRate: 0.4,
          avgSessionDuration: 45,
          keyEvents: 7,
        },
      ],
      topQueries: [],
      sitemaps: [],
      errors: [],
    },
  };
}

describe("GA4 key-event reports", () => {
  it("serializes keyEvents as the only canonical GA4 outcome field", () => {
    const serialized = JSON.parse(reportToJson(reportWithKeyEvents())) as {
      realData: { ga4: Array<Record<string, unknown>> };
    };

    expect(serialized.realData.ga4[0]).toMatchObject({ keyEvents: 7 });
    expect(serialized.realData.ga4[0]).not.toHaveProperty("conversions");
  });

  it("reads conversions only as a legacy saved-report fallback", () => {
    const legacy = reportWithKeyEvents() as unknown as Report & {
      realData: { ga4: Array<Record<string, unknown>> };
    };
    const row = legacy.realData.ga4[0]!;
    delete row.keyEvents;
    row.conversions = 7;

    const markdown = reportToMarkdown(legacy);
    expect(markdown).toContain("Key events");
    expect(markdown).toContain(
      "| /landing | 20 | 25 | 60.0% | 40.0% | 45.0 | 7 |",
    );
  });
});
