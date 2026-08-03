import { describe, expect, it } from "vitest";
import {
  competitorDashboardItems,
  keywordDashboardWorkspace,
  osintDashboardWorkspace,
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

  it("compares repeat OSINT passes without turning a failed crawl into removals", () => {
    const evidence = (
      id: string,
      label: string,
      value: unknown,
      state = "available",
    ) => ({
      id,
      kind: "public-channel",
      label,
      value,
      state,
      sourceUrl: "https://example.com/",
      sourceClass: "public_web",
      observedAt: "2026-08-03T12:00:00.000Z",
      confidence: 1,
    });
    const baseline = {
      generatedAt: "2026-08-02T12:00:00.000Z",
      targets: [
        {
          targetUrl: "https://example.com/",
          status: "available",
          evidence: [
            evidence("same", "Security page", "/security"),
            evidence("removed", "Press page", "/press"),
          ],
        },
        {
          targetUrl: "https://blocked.example/",
          status: "available",
          evidence: [evidence("blocked", "Profile", "https://x.com/acme")],
        },
      ],
    };
    const current = {
      generatedAt: "2026-08-03T12:00:00.000Z",
      targets: [
        {
          targetUrl: "https://example.com/",
          status: "available",
          evidence: [
            evidence("same", "Security page", "/security", "contradictory"),
            evidence("added", "About page", "/about"),
          ],
        },
        {
          targetUrl: "https://blocked.example/",
          status: "failed",
          evidence: [
            evidence("fetch", "Target fetch", "blocked", "insufficient"),
          ],
        },
      ],
    };

    const workspace = osintDashboardWorkspace(current, baseline);
    expect(workspace).toMatchObject({
      compared: true,
      previousGeneratedAt: "2026-08-02T12:00:00.000Z",
    });
    expect(workspace.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetUrl: "https://example.com/",
          change: "changed",
          label: "Security page",
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/",
          change: "added",
          label: "About page",
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/",
          change: "removed",
          label: "Press page",
        }),
      ]),
    );
    expect(
      workspace.changes.some(
        (item) =>
          (item as { targetUrl?: string }).targetUrl ===
          "https://blocked.example/",
      ),
    ).toBe(false);
  });
});
