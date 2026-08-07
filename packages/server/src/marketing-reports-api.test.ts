import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

describe("cross-channel report API", () => {
  const activeServers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const dataDir = mkdtempSync(join(tmpdir(), "marketingovo-report-api-"));
    const runtime = new MarketingovoLocalRuntime({ dataDir });
    const server = await createLocalServer({ runtime, port: 3210 });
    activeServers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = { host: HOST, authorization: `Bearer ${token}` };
    const project = await runtime.projects.create({
      name: "Report",
      canonicalUrl: "https://example.com",
    });
    return { runtime, server, project, headers };
  }

  it("generates, lists and renders the document in all three forms", async () => {
    const { server, project, headers } = await setup();

    const generated = await server.app.inject({
      method: "POST",
      url: "/api/v1/marketing-reports",
      headers,
      payload: { projectId: project.id, compare: true },
    });
    expect(generated.statusCode, generated.body).toBe(201);
    const report = generated.json() as { id: string; sections: unknown[] };
    expect(
      (report.sections as Array<{ id: string }>).map((section) => section.id),
    ).toContain("competitors");

    const html = await server.app.inject({
      method: "GET",
      url: `/api/v1/marketing-reports/${report.id}/render?format=html`,
      headers,
    });
    expect(html.statusCode).toBe(200);
    expect(html.headers["content-type"]).toContain("text/html");
    expect(html.body).toContain("Competitive landscape");

    const pdf = await server.app.inject({
      method: "GET",
      url: `/api/v1/marketing-reports/${report.id}/render?format=pdf`,
      headers,
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.headers["content-disposition"]).toContain(".pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const missing = await server.app.inject({
      method: "GET",
      url: "/api/v1/marketing-reports/nope/render?format=pdf",
      headers,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers["content-type"]).toContain(
      "application/problem+json",
    );
  });
});
