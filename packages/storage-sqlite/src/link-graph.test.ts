import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentSeoDatabase } from "./database.js";

describe("immutable internal-link graph", () => {
  it("normalizes aliases and serves bounded inlink and outlink evidence", () => {
    const database = new AgentSeoDatabase({
      path: join(
        mkdtempSync(join(tmpdir(), "marketingovo-link-db-")),
        "marketingovo.db",
      ),
    });
    try {
      const project = database.createProject({
        name: "Links",
        canonicalUrl: "https://example.com/",
      });
      const run = database.insertRun({
        id: "link-graph-run",
        projectId: project.id,
        workflowId: "audit",
      });
      database.replacePages(run.id, [
        {
          canonicalUrl: "https://example.com/",
          statusCode: 200,
          title: "Home",
          indexable: true,
          payload: {
            evidenceVersion: 1,
            linkGraphVersion: 1,
            sourceUrl: "https://example.com/",
            crawlDepth: 0,
            internalLinks: [
              {
                targetUrl: "https://example.com/pricing",
                occurrences: 2,
                followOccurrences: 1,
                nofollowOccurrences: 1,
                anchorTexts: ["Pricing", "Compare plans"],
                placements: ["navigation", "main"],
              },
              {
                targetUrl: "https://example.com/old-docs",
                occurrences: 1,
                followOccurrences: 1,
                nofollowOccurrences: 0,
                anchorTexts: ["Old docs"],
                placements: ["footer"],
              },
              {
                targetUrl: "https://example.com/missing",
                occurrences: 1,
                followOccurrences: 1,
                nofollowOccurrences: 0,
                anchorTexts: ["Missing"],
                placements: ["main"],
              },
              {
                targetUrl: "https://example.com/broken",
                occurrences: 1,
                followOccurrences: 1,
                nofollowOccurrences: 0,
                anchorTexts: ["Broken destination"],
                placements: ["main"],
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
            evidenceVersion: 1,
            linkGraphVersion: 1,
            sourceUrl: "https://example.com/pricing",
            crawlDepth: 1,
            internalLinks: [],
          },
        },
        {
          canonicalUrl: "https://example.com/docs",
          statusCode: 200,
          title: "Documentation",
          indexable: true,
          payload: {
            evidenceVersion: 1,
            linkGraphVersion: 1,
            sourceUrl: "https://example.com/old-docs",
            redirectChain: ["https://example.com/docs"],
            crawlDepth: 1,
            internalLinks: [],
          },
        },
        {
          canonicalUrl: "https://example.com/broken",
          statusCode: 404,
          title: null,
          indexable: false,
          payload: {
            evidenceVersion: 1,
            linkGraphVersion: 1,
            sourceUrl: "https://example.com/broken",
            crawlDepth: 1,
            internalLinks: [],
          },
        },
      ]);

      expect(
        database.listPageLinkMetrics(run.id).get("https://example.com/"),
      ).toMatchObject({
        state: "available",
        outlinkTargets: 4,
        outlinkOccurrences: 5,
      });
      expect(
        database.listPageLinkMetrics(run.id).get("https://example.com/pricing"),
      ).toMatchObject({ inlinkSources: 1, inlinkOccurrences: 2 });

      expect(database.getRunLinkGraphSnapshot(run.id)).toMatchObject({
        pageCount: 4,
        graphPageCount: 4,
        items: [
          expect.objectContaining({
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/broken",
            targetState: "broken",
          }),
          expect.objectContaining({
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/missing",
            targetState: "uncrawled",
          }),
          expect.objectContaining({
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/old-docs",
            targetPageUrl: "https://example.com/docs",
            targetState: "redirected",
          }),
          expect.objectContaining({
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/pricing",
            targetState: "direct",
          }),
        ],
      });

      const outbound = database.getPageLinkExplorerData(
        run.id,
        "https://example.com/",
        { direction: "outlinks", limit: 10, offset: 0 },
      );
      expect(outbound).toMatchObject({
        total: 4,
        pageCount: 4,
        graphPageCount: 4,
        summary: {
          outlinkTargets: 4,
          outlinkOccurrences: 5,
          brokenOutlinkTargets: 1,
          redirectedOutlinkTargets: 1,
          uncrawledOutlinkTargets: 1,
        },
      });
      expect(outbound?.items).toEqual([
        expect.objectContaining({
          targetUrl: "https://example.com/broken",
          targetState: "broken",
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/old-docs",
          targetPageUrl: "https://example.com/docs",
          targetState: "redirected",
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/missing",
          targetPageUrl: null,
          targetState: "uncrawled",
        }),
        expect.objectContaining({
          targetUrl: "https://example.com/pricing",
          occurrences: 2,
          followOccurrences: 1,
          nofollowOccurrences: 1,
          anchorTexts: ["Pricing", "Compare plans"],
        }),
      ]);

      const inbound = database.getPageLinkExplorerData(
        run.id,
        "https://example.com/pricing",
        { direction: "inlinks", limit: 10, offset: 0, search: "home" },
      );
      expect(inbound).toMatchObject({
        total: 1,
        summary: { inlinkSources: 1, inlinkOccurrences: 2 },
        items: [
          {
            sourceUrl: "https://example.com/",
            sourceTitle: "Home",
            targetUrl: "https://example.com/pricing",
          },
        ],
      });
    } finally {
      database.close();
    }
  });
});
