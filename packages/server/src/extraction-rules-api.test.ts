import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

function extractionEngine() {
  return {
    previewExtraction: vi.fn(async (input: Record<string, unknown>) => ({
      requestedUrl: String(input.url),
      finalUrl: String(input.url),
      statusCode: 200,
      contentType: "text/html",
      renderMode:
        input.renderMode === "js" ? ("js" as const) : ("static" as const),
      responseTimeMs: 8,
      fields: (input.rules as Array<{ label: string }>).map((rule) => ({
        label: rule.label,
        value: "$29.00",
      })),
    })),
    crawl: async () => {
      throw new Error("not used");
    },
    reportToJson: (value: unknown) => JSON.stringify(value),
    reportToHtml: () => "<!doctype html>",
    reportToCsv: () => "url,status\n",
  };
}

describe("project extraction-rule API", () => {
  const servers: LocalServer[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const engine = extractionEngine();
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-extraction-api-")),
      engine,
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: "127.0.0.1:3210",
      authorization: `Bearer ${token}`,
    };
    const project = await runtime.projects.create({
      name: "Extraction API",
      canonicalUrl: "https://example.com/",
    });
    return { engine, project, server, headers };
  }

  it("serves the canonical review-required template catalog and dashboard envelope", async () => {
    const { server, headers } = await setup();
    const canonical = await server.app.inject({
      method: "GET",
      url: "/api/v1/extraction-rule-templates",
      headers,
    });
    expect(canonical.statusCode).toBe(200);
    expect(canonical.json()).toMatchObject({
      version: "extraction-template-catalog-v1",
      importMode: "review_required",
      templates: expect.arrayContaining([
        expect.objectContaining({
          id: "social-preview-meta",
          rules: expect.arrayContaining([
            expect.objectContaining({ label: "Open Graph title" }),
          ]),
        }),
      ]),
    });

    const dashboard = await server.app.inject({
      method: "GET",
      url: "/api/v1/extraction-rule-templates",
      headers: { ...headers, "x-marketingovo-client": "dashboard" },
    });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      data: { importMode: "review_required" },
      meta: { state: "fresh" },
    });
  });

  it("versions rules and previews drafts through canonical and dashboard contracts", async () => {
    const { engine, project, server, headers } = await setup();
    const path = `/api/v1/projects/${project.id}/extraction-rules`;
    const rule = {
      id: "price-rule",
      label: "Price",
      selector: "[itemprop='price']",
      type: "text",
      attribute: null,
      regex: null,
      enabled: true,
    };

    const empty = await server.app.inject({
      method: "GET",
      url: path,
      headers,
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({
      projectId: project.id,
      current: null,
      history: [],
    });

    const saved = await server.app.inject({
      method: "PUT",
      url: path,
      headers: { ...headers, "x-marketingovo-client": "dashboard" },
      payload: {
        rules: [rule],
        changeSummary: "Capture product prices",
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      data: {
        projectId: project.id,
        current: {
          revision: 1,
          configurationHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          rules: [rule],
        },
      },
      meta: { state: "fresh" },
    });

    const preview = await server.app.inject({
      method: "POST",
      url: `${path}/preview`,
      headers: { ...headers, "x-marketingovo-client": "dashboard" },
      payload: {
        url: "https://example.com/product",
        renderMode: "static",
        allowPrivateHost: false,
        rules: [rule],
      },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      data: {
        projectId: project.id,
        statusCode: 200,
        fields: [{ ruleId: "price-rule", value: "$29.00" }],
      },
    });
    expect(engine.previewExtraction).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/product" }),
    );
  });

  it("fails closed for unsafe rules and out-of-scope preview targets and publishes both routes", async () => {
    const { project, server, headers } = await setup();
    const path = `/api/v1/projects/${project.id}/extraction-rules`;
    const unsafeRule = {
      id: "unsafe-rule",
      label: "Unsafe",
      selector: "body",
      type: "text",
      attribute: null,
      regex: "(a+)+$",
      enabled: true,
    };
    const unsafe = await server.app.inject({
      method: "PUT",
      url: path,
      headers,
      payload: { rules: [unsafeRule], changeSummary: "Unsafe expression" },
    });
    expect(unsafe.statusCode).toBe(422);
    expect(unsafe.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(unsafe.json()).toMatchObject({ code: "invalid_extraction_rules" });

    const outside = await server.app.inject({
      method: "POST",
      url: `${path}/preview`,
      headers,
      payload: {
        url: "https://attacker.example/",
        rules: [{ ...unsafeRule, regex: null }],
      },
    });
    expect(outside.statusCode).toBe(422);
    expect(outside.json()).toMatchObject({ code: "preview_url_out_of_scope" });

    const openapi = await server.app.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
      headers,
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths).toHaveProperty(
      "/api/v1/projects/{id}/extraction-rules",
    );
    expect(openapi.json().paths).toHaveProperty(
      "/api/v1/extraction-rule-templates",
    );
    expect(openapi.json().paths).toHaveProperty(
      "/api/v1/projects/{id}/extraction-rules/preview",
    );
  });
});
