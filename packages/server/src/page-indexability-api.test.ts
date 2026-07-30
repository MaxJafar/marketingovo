import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer } from "./index.js";

describe("dashboard page indexability API", () => {
  it("maps persisted evidence reasons to marketer-facing states", async () => {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-page-api-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    try {
      const project = await runtime.projects.create({
        name: "Indexability",
        canonicalUrl: "https://example.com/",
      });
      runtime.database.insertRun({
        id: "page-api-run",
        projectId: project.id,
        workflowId: "audit",
      });
      runtime.database.updateRun("page-api-run", {
        status: "succeeded",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        progress: 1,
      });
      runtime.database.replacePages("page-api-run", [
        {
          canonicalUrl: "https://example.com/noindex",
          statusCode: 200,
          title: "Noindex",
          indexable: false,
          payload: { indexabilityReason: "meta_noindex" },
        },
        {
          canonicalUrl: "https://example.com/canonicalized",
          statusCode: 200,
          title: "Canonicalized",
          indexable: false,
          payload: { indexabilityReason: "canonicalized" },
        },
        {
          canonicalUrl: "https://example.com/unknown",
          statusCode: 200,
          title: "Unknown",
          indexable: null,
          payload: { indexabilityReason: "robots_unknown" },
        },
      ]);
      runtime.database.upsertMetric(
        project.id,
        "page-api-run",
        "indexable_coverage",
        {
          value: 0.5,
          state: "available",
          source: "crawl",
          observedAt: new Date().toISOString(),
          coverage: 2 / 3,
          note: "Classified 2 of 3 crawled pages; 1 remains unknown.",
        },
      );

      const token = readFileSync(server.serviceTokenPath, "utf8").trim();
      const response = await server.app.inject({
        method: "GET",
        url: `/api/v1/pages?siteId=${project.id}`,
        headers: {
          host: "127.0.0.1:3210",
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.items).toEqual([
        expect.objectContaining({
          indexability: "canonicalized",
          indexabilityReason: "canonicalized",
        }),
        expect.objectContaining({
          indexability: "noindex",
          indexabilityReason: "meta_noindex",
        }),
        expect.objectContaining({
          indexability: "unknown",
          indexabilityReason: "robots_unknown",
        }),
      ]);

      const overview = await server.app.inject({
        method: "GET",
        url: `/api/v1/overview?siteId=${project.id}`,
        headers: {
          host: "127.0.0.1:3210",
          authorization: `Bearer ${token}`,
        },
      });
      expect(overview.statusCode).toBe(200);
      expect(overview.json().data.indexableCoverage).toMatchObject({
        value: 50,
        note: "Classified 2 of 3 crawled pages; 1 remains unknown.",
      });
      expect(overview.json().data.indexableCoverage.coverage).toBeCloseTo(
        200 / 3,
      );
    } finally {
      await server.close();
    }
  });
});
