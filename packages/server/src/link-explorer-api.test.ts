import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GolemLocalRuntime } from "@agentseoapp/runtime";
import { createLocalServer } from "./index.js";

describe("internal-link explorer API", () => {
  it("keeps the page inventory on the latest audit and serves immutable edges", async () => {
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-link-api-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    try {
      const project = await runtime.projects.create({
        name: "Link graph",
        canonicalUrl: "https://example.com/",
      });
      const completedAt = "2026-07-16T12:00:00.000Z";
      runtime.database.insertRun({
        id: "link-api-audit",
        projectId: project.id,
        workflowId: "audit",
      });
      runtime.database.updateRun("link-api-audit", {
        status: "succeeded",
        startedAt: completedAt,
        completedAt,
        progress: 1,
      });
      runtime.database.replacePages("link-api-audit", [
        {
          canonicalUrl: "https://example.com/",
          statusCode: 200,
          title: "Home",
          indexable: true,
          payload: {
            linkGraphVersion: 1,
            crawlDepth: 0,
            sourceUrl: "https://example.com/",
            vitals: { lcp: 2_000, cls: 0.05, ttfb: 600 },
            internalLinks: [
              {
                targetUrl: "https://example.com/pricing",
                occurrences: 2,
                followOccurrences: 1,
                nofollowOccurrences: 1,
                anchorTexts: ["Pricing", "Compare plans"],
                placements: ["navigation", "main"],
              },
            ],
          },
        },
        {
          canonicalUrl: "https://example.com/pricing",
          statusCode: 200,
          title: "Pricing",
          indexable: true,
          payload: {
            linkGraphVersion: 1,
            crawlDepth: 1,
            sourceUrl: "https://example.com/pricing",
            vitals: { lcp: 4_500, cls: 0.08, ttfb: 700 },
            internalLinks: [],
          },
        },
      ]);
      runtime.database.replacePerformanceData({
        runId: "link-api-audit",
        projectId: project.id,
        windows: [],
        pages: [
          {
            runId: "link-api-audit",
            projectId: project.id,
            period: "current",
            canonicalUrl: "https://example.com/",
            crawlMatched: true,
            clicks: 12,
            impressions: 120,
            ctr: 0.1,
            position: 4,
            sessions: 20,
            pageViews: 30,
            engagementRate: 0.8,
            keyEvents: 3,
          },
        ],
        queries: [],
      });
      runtime.database.replaceIssues(
        "link-api-audit",
        project.id,
        [
          {
            fingerprint: "home-canonical",
            ruleId: "canonical-missing",
            moduleId: "technical",
            canonicalUrl: "https://example.com/",
            severity: "high",
            title: "Canonical missing",
            description: "The home page has no canonical declaration.",
            evidence: [],
            firstSeenAt: completedAt,
            lastSeenAt: completedAt,
            status: "open",
          },
        ],
        { resolveMissing: true },
      );
      runtime.database.insertRun({
        id: "newer-keyword-run",
        projectId: project.id,
        workflowId: "keyword-research",
      });
      runtime.database.updateRun("newer-keyword-run", {
        status: "succeeded",
        startedAt: "2026-07-16T13:00:00.000Z",
        completedAt: "2026-07-16T13:00:00.000Z",
        progress: 1,
      });

      const token = readFileSync(server.serviceTokenPath, "utf8").trim();
      const headers = {
        host: "127.0.0.1:3210",
        authorization: `Bearer ${token}`,
      };
      const inventory = await server.app.inject({
        method: "GET",
        url: `/api/v1/pages?siteId=${project.id}`,
        headers: { ...headers, "x-golem-client": "dashboard" },
      });
      expect(inventory.statusCode).toBe(200);
      expect(inventory.json().data.items).toEqual([
        expect.objectContaining({
          runId: "link-api-audit",
          url: "https://example.com/",
          linkGraphState: "available",
          inlinkSources: 0,
          outlinkTargets: 1,
          outlinkOccurrences: 2,
          organicClicks: 12,
          organicKeyEvents: 3,
          issues: 1,
          coreWebVitals: "pass",
        }),
        expect.objectContaining({
          runId: "link-api-audit",
          url: "https://example.com/pricing",
          inlinkSources: 1,
          inlinkOccurrences: 2,
          organicClicks: null,
          organicKeyEvents: null,
          issues: 0,
          coreWebVitals: "fail",
        }),
      ]);

      const response = await server.app.inject({
        method: "GET",
        url: "/api/v1/runs/link-api-audit/links?pageUrl=https%3A%2F%2Fexample.com%2Fpricing&direction=inlinks",
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        version: "link-graph-v1",
        runId: "link-api-audit",
        state: "available",
        direction: "inlinks",
        summary: { inlinkSources: 1, inlinkOccurrences: 2 },
        items: [
          {
            sourceUrl: "https://example.com/",
            sourceTitle: "Home",
            targetUrl: "https://example.com/pricing",
            anchorTexts: ["Pricing", "Compare plans"],
          },
        ],
      });

      const missing = await server.app.inject({
        method: "GET",
        url: "/api/v1/runs/link-api-audit/links?pageUrl=https%3A%2F%2Fexample.com%2Fmissing&direction=outlinks",
        headers,
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(missing.json()).toMatchObject({
        code: "link_page_not_found",
      });
    } finally {
      await server.close();
    }
  });
});
