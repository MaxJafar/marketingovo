import { describe, expect, it } from "vitest";
import {
  competitorDashboardItems,
  keywordDashboardWorkspace,
  parseResearchArtifact,
} from "./research-dashboard.js";

describe("research dashboard projections", () => {
  it("projects real keyword and cluster evidence without fake volume or coverage", () => {
    const workspace = keywordDashboardWorkspace({
      keywordProfiles: [
        {
          profile: {
            seed: "technical seo",
            intent: { intent: "informational" },
            strength: 78,
            providerUsage: {
              actualCostUsd: 0.0042,
              billableRequests: 2,
              unreportedBillableRequests: 1,
              freeRequests: 2,
            },
            variants: [
              { term: "technical seo audit", intent: { intent: "commercial" } },
            ],
          },
        },
      ],
      clusters: {
        profile: {
          clusters: [
            {
              hub: "technical seo",
              members: ["technical seo", "site audit"],
              spokes: ["crawl budget"],
              summary:
                "A technical SEO pillar with audit and crawl-budget spokes.",
            },
          ],
        },
      },
    });
    expect(workspace.opportunities).toHaveLength(2);
    expect(workspace.opportunities[0]).toMatchObject({
      keyword: "technical seo",
      opportunityScore: 78,
      volume: null,
      difficulty: null,
    });
    expect(workspace.clusters[0]).toMatchObject({
      name: "technical seo",
      keywords: 3,
      contentCoverage: null,
    });
    expect(workspace.providerUsage).toEqual({
      actualCostUsd: 0.0042,
      billableRequests: 2,
      unreportedBillableRequests: 1,
      freeRequests: 2,
    });
  });

  it("excludes the owned site and labels a crawl-derived technical health proxy", () => {
    const items = competitorDashboardItems({
      generatedAt: "2026-07-15T00:00:00.000Z",
      sites: [
        {
          finalUrl: "https://owned.example/",
          pagesCrawled: 5,
          issuesByPriority: {},
        },
        {
          finalUrl: "https://competitor.example/",
          pagesCrawled: 10,
          issuesByPriority: { High: 2, Medium: 2, Low: 4 },
          error: null,
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      domain: "competitor.example",
      technicalHealth: 80,
      sharedKeywords: null,
      keywordGaps: null,
    });
  });

  it("bounds and safely parses stored JSON artifacts", () => {
    expect(parseResearchArtifact(Buffer.from('{"ok":true}'))).toEqual({
      ok: true,
    });
    expect(parseResearchArtifact(Buffer.from("not-json"))).toBeNull();
    expect(
      parseResearchArtifact(new Uint8Array(4 * 1024 * 1024 + 1)),
    ).toBeNull();
  });
});
