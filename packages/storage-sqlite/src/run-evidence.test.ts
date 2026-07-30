import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentSeoDatabase } from "./database.js";

describe("stored run evidence pagination", () => {
  it("filters versioned page evidence by section, search and stable offsets", () => {
    const database = new AgentSeoDatabase({
      path: join(
        mkdtempSync(join(tmpdir(), "marketingovo-evidence-db-")),
        "marketingovo.db",
      ),
    });
    try {
      const project = database.createProject({
        name: "Evidence",
        canonicalUrl: "https://example.com/",
      });
      const run = database.insertRun({
        id: "run-evidence-storage",
        projectId: project.id,
        workflowId: "audit",
      });
      database.replacePages(run.id, [
        {
          canonicalUrl: "https://example.com/a",
          statusCode: 200,
          title: "Alpha page",
          indexable: true,
          payload: {
            evidenceVersion: 1,
            sourceUrl: "https://example.com/a",
            crawlDepth: 0,
            redirectChain: [],
            hreflang: {
              alternates: [{ lang: "en" }],
            },
            extractions: [{ label: "price", value: "10" }],
          },
        },
        {
          canonicalUrl: "https://example.com/b",
          statusCode: 200,
          title: "Beta page",
          indexable: true,
          payload: {
            evidenceVersion: 1,
            sourceUrl: "https://example.com/old-b",
            crawlDepth: 1,
            redirectChain: ["https://example.com/b"],
            hreflang: null,
            extractions: [],
          },
        },
        {
          canonicalUrl: "https://example.com/legacy",
          statusCode: 200,
          title: "Legacy page",
          indexable: null,
          payload: { sourceUrl: "https://example.com/legacy" },
        },
      ]);

      expect(
        database.listPageEvidence(run.id, {
          section: "crawl",
          limit: 1,
          offset: 1,
        }),
      ).toMatchObject({
        total: 3,
        pageCount: 3,
        evidencePageCount: 2,
        pages: [{ canonicalUrl: "https://example.com/b" }],
      });
      expect(
        database.listPageEvidence(run.id, {
          section: "redirects",
          limit: 10,
          offset: 0,
        }),
      ).toMatchObject({
        total: 1,
        pages: [{ canonicalUrl: "https://example.com/b" }],
      });
      expect(
        database.listPageEvidence(run.id, {
          section: "hreflang",
          limit: 10,
          offset: 0,
        }),
      ).toMatchObject({ total: 1 });
      expect(
        database.listPageEvidence(run.id, {
          section: "extractions",
          limit: 10,
          offset: 0,
          search: "alpha",
        }),
      ).toMatchObject({
        total: 1,
        pages: [{ canonicalUrl: "https://example.com/a" }],
      });
    } finally {
      database.close();
    }
  });
});
