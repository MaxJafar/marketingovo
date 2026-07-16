import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractionRule } from "@agentseoapp/contracts";
import { ExtractionRulesError, GolemLocalRuntime } from "./index.js";

const rule = (
  id: string,
  label: string,
  selector: string,
  overrides: Partial<ExtractionRule> = {},
): ExtractionRule => ({
  id,
  label,
  selector,
  type: "text",
  attribute: null,
  regex: null,
  enabled: true,
  ...overrides,
});

function engine(crawls: Array<Record<string, unknown>>) {
  return {
    crawl: async (input: Record<string, unknown>) => {
      crawls.push(input);
      return {
        runId: `engine-${crawls.length}`,
        report: {
          generatedAt: new Date().toISOString(),
          startUrl: String(input.startUrl),
          durationMs: 1,
          config: { maxUrls: 1, maxRuntimeMs: 1_000, requestsPerSecond: 1 },
          summary: {
            pagesCrawled: 1,
            issuesByPriority: { High: 0, Medium: 0, Low: 0 },
            issuesByCategory: {},
          },
          issues: [],
          pages: [
            {
              url: String(input.startUrl),
              finalUrl: String(input.startUrl),
              status: 200,
              title: "Extraction fixture",
              contentType: "text/html",
              canonical: String(input.startUrl),
              robotsMeta: null,
              xRobotsTag: null,
              robotsAllowed: true,
              htmlParsed: true,
              error: null,
              redirectChain: [],
              responseTimeMs: 1,
              vitals: null,
            },
          ],
          topUrls: [],
        },
      };
    },
    previewExtraction: vi.fn(async (input: Record<string, unknown>) => {
      const rules = input.rules as Array<{ label: string }>;
      return {
        requestedUrl: String(input.url),
        finalUrl: String(input.url),
        statusCode: 200,
        contentType: "text/html; charset=utf-8",
        renderMode:
          input.renderMode === "js" ? ("js" as const) : ("static" as const),
        responseTimeMs: 12,
        fields: rules.map((candidate) => ({
          label: candidate.label,
          value: candidate.label === "Price" ? "$19.00" : null,
        })),
      };
    }),
    reportToJson: (value: unknown) => JSON.stringify(value),
    reportToHtml: () => "<!doctype html><title>Extraction rules</title>",
    reportToCsv: () => "url,status\n",
  };
}

async function waitForTerminal(runtime: GolemLocalRuntime, runId: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const run = await runtime.runs.get(runId);
    if (
      run &&
      ["succeeded", "partial", "failed", "cancelled"].includes(run.status)
    )
      return run;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Run ${runId} did not finish`);
}

describe("versioned project extraction rules", () => {
  const runtimes: GolemLocalRuntime[] = [];
  afterEach(() => runtimes.splice(0).forEach((runtime) => runtime.close()));

  function setup() {
    const crawls: Array<Record<string, unknown>> = [];
    const stub = engine(crawls);
    const runtime = new GolemLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "golem-extraction-rules-")),
      engine: stub,
    });
    runtimes.push(runtime);
    return { runtime, stub, crawls };
  }

  it("serves a validated, review-required template catalog without shared mutable state", async () => {
    const { runtime } = setup();
    const project = await runtime.projects.create({
      name: "Template catalog",
      canonicalUrl: "https://example.com/",
    });
    const first = await runtime.extractionRules.templates();
    expect(first).toMatchObject({
      version: "extraction-template-catalog-v1",
      importMode: "review_required",
    });
    expect(first.templates.map((template) => template.id)).toEqual([
      "social-preview-meta",
      "editorial-article-meta",
      "commerce-product-meta",
      "migration-template-markers",
    ]);
    const imported = first.templates.flatMap((template) =>
      template.rules.map((candidate) => ({
        ...candidate,
        id: `${template.id}-${candidate.id}`,
      })),
    );
    await expect(
      runtime.extractionRules.update({
        projectId: project.id,
        rules: imported,
        changeSummary: "Validate every built-in extraction template",
      }),
    ).resolves.toMatchObject({ current: { rules: imported } });

    first.templates[0]!.name = "Mutated caller copy";
    const second = await runtime.extractionRules.templates();
    expect(second.templates[0]?.name).toBe("Social preview metadata");
  });

  it("versions validated rules and previews only enabled fields on the exact project origin", async () => {
    const { runtime, stub } = setup();
    const project = await runtime.projects.create({
      name: "Extraction workspace",
      canonicalUrl: "https://example.com/",
    });
    const price = rule("price-rule", " Price ", " [itemprop='price'] ");
    const author = rule("author-rule", "Author", ".author", {
      enabled: false,
    });

    const first = await runtime.extractionRules.update({
      projectId: project.id,
      rules: [price, author],
      changeSummary: "Capture product evidence",
    });
    expect(first?.current).toMatchObject({
      revision: 1,
      configurationHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      rules: [
        { id: "price-rule", label: "Price", selector: "[itemprop='price']" },
        { id: "author-rule", enabled: false },
      ],
    });

    const second = await runtime.extractionRules.update({
      projectId: project.id,
      rules: [price],
      changeSummary: "Remove the unused author field",
    });
    expect(second?.history.map((version) => version.revision)).toEqual([2, 1]);

    const preview = await runtime.extractionRules.preview({
      projectId: project.id,
      url: "https://example.com/products/widget#offer",
      renderMode: "static",
      allowPrivateHost: false,
      rules: [price, author],
    });
    expect(preview).toMatchObject({
      requestedUrl: "https://example.com/products/widget",
      statusCode: 200,
      fields: [{ ruleId: "price-rule", label: "Price", value: "$19.00" }],
    });
    expect(stub.previewExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/products/widget",
        allowPrivateHost: false,
        rules: [expect.objectContaining({ label: "Price" })],
      }),
    );

    await expect(
      runtime.extractionRules.preview({
        projectId: project.id,
        url: "https://attacker.example/",
        rules: [price],
      }),
    ).rejects.toMatchObject({ code: "preview_url_out_of_scope" });
    await expect(
      runtime.extractionRules.update({
        projectId: project.id,
        rules: [rule("unsafe", "Unsafe", "body", { regex: "(a+)+$" })],
        changeSummary: "Unsafe expression",
      }),
    ).rejects.toBeInstanceOf(ExtractionRulesError);
    expect(
      (await runtime.extractionRules.get(project.id))?.current?.revision,
    ).toBe(2);
  });

  it("snapshots a rule revision for new audits and preserves it through replay", async () => {
    const { runtime, crawls } = setup();
    const project = await runtime.projects.create({
      name: "Replay extraction rules",
      canonicalUrl: "https://example.com/",
    });
    await runtime.extractionRules.update({
      projectId: project.id,
      rules: [rule("price-v1", "Price v1", ".price")],
      changeSummary: "Initial price field",
    });

    const source = await runtime.runs.start(
      { projectId: project.id, workflowId: "audit" },
      "extraction-source-run",
    );
    expect(runtime.database.getRunOptions(source.id)).toMatchObject({
      extractionRuleRevision: 1,
    });
    await waitForTerminal(runtime, source.id);

    await runtime.extractionRules.update({
      projectId: project.id,
      rules: [rule("price-v2", "Price v2", ".sale-price")],
      changeSummary: "Use the sale price field",
    });
    const replay = await runtime.runs.replay(
      source.id,
      "replay-extraction-source",
    );
    expect(replay).not.toBeNull();
    expect(runtime.database.getRunOptions(replay!.run.id)).toMatchObject({
      extractionRuleRevision: 1,
    });
    await waitForTerminal(runtime, replay!.run.id);

    const current = await runtime.runs.start(
      { projectId: project.id, workflowId: "audit" },
      "extraction-current-run",
    );
    expect(runtime.database.getRunOptions(current.id)).toMatchObject({
      extractionRuleRevision: 2,
    });
    await waitForTerminal(runtime, current.id);

    expect(crawls.map((crawl) => crawl.extractors)).toEqual([
      [expect.objectContaining({ label: "Price v1", selector: ".price" })],
      [expect.objectContaining({ label: "Price v1", selector: ".price" })],
      [
        expect.objectContaining({
          label: "Price v2",
          selector: ".sale-price",
        }),
      ],
    ]);
  }, 15_000);
});
