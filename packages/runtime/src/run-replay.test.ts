import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Report as EngineReport } from "@marketingovo/core";
import { AgentSeoLocalRuntime } from "./index.js";

function report(startUrl: string): EngineReport {
  return {
    generatedAt: new Date().toISOString(),
    startUrl,
    durationMs: 1,
    config: { maxUrls: 10, maxRuntimeMs: 10_000, requestsPerSecond: 2 },
    summary: {
      pagesCrawled: 1,
      issuesByPriority: { High: 0, Medium: 0, Low: 0 },
      issuesByCategory: {},
    },
    issues: [],
    pages: [
      {
        url: startUrl,
        finalUrl: startUrl,
        status: 200,
        title: "Replay fixture",
        contentType: "text/html",
        canonical: startUrl,
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
  };
}

async function terminal(runtime: AgentSeoLocalRuntime, runId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await runtime.runs.get(runId);
    if (
      run &&
      ["succeeded", "partial", "failed", "cancelled"].includes(run.status)
    ) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return runtime.runs.get(runId);
}

describe("local run replay", () => {
  let runtime: AgentSeoLocalRuntime | undefined;
  afterEach(() => runtime?.close());

  it("copies the stored configuration into one idempotent run without mutating its source", async () => {
    const crawlInputs: Array<Record<string, unknown>> = [];
    runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-run-replay-")),
      engine: {
        crawl: async (input: Record<string, unknown>) => {
          crawlInputs.push(input);
          return {
            runId: `engine-${crawlInputs.length}`,
            report: report(String(input.startUrl)),
          };
        },
        reportToJson: (value) => JSON.stringify(value),
        reportToHtml: () => "<!doctype html><title>Replay</title>",
        reportToCsv: () => "url,status\n",
      },
    });
    const project = await runtime.projects.create({
      name: "Replay",
      canonicalUrl: "https://example.com/",
    });
    const options = {
      renderMode: "js",
      collectVitals: true,
      maxUrls: 5,
      exactUrls: ["https://example.com/", "https://example.com/pricing"],
    };
    const source = await runtime.runs.start(
      { projectId: project.id, workflowId: "audit", options },
      "source-run-replay",
    );
    expect((await terminal(runtime, source.id))?.status).toBe("succeeded");
    const sourceRecord = await runtime.runs.get(source.id);
    const sourceOptions = runtime.database.getRunOptions(source.id);
    const sourcePages = runtime.database.listPages(source.id);
    const sourceEvents = runtime.listRunEvents(source.id);

    const first = await runtime.runs.replay(source.id, "replay-request-1");
    const repeated = await runtime.runs.replay(source.id, "replay-request-1");

    expect(first).not.toBeNull();
    expect(first).toMatchObject({
      sourceRunId: source.id,
      configurationVersion: 1,
      configurationHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(first?.run.id).not.toBe(source.id);
    expect(repeated?.run.id).toBe(first?.run.id);
    expect(repeated?.configurationHash).toBe(first?.configurationHash);
    expect((await terminal(runtime, first!.run.id))?.status).toBe("succeeded");

    expect(runtime.database.getRunOptions(first!.run.id)).toEqual(
      sourceOptions,
    );
    expect(await runtime.runs.get(source.id)).toEqual(sourceRecord);
    expect(runtime.database.listPages(source.id)).toEqual(sourcePages);
    expect(runtime.listRunEvents(source.id)).toEqual(sourceEvents);
    expect(runtime.database.listRuns(project.id)).toHaveLength(2);
    expect(
      runtime
        .listRunEvents(first!.run.id)
        .filter((event) => event.type === "run.replay_queued"),
    ).toEqual([
      expect.objectContaining({
        payload: {
          sourceRunId: source.id,
          configurationVersion: 1,
          configurationHash: first!.configurationHash,
        },
      }),
    ]);
    expect(crawlInputs).toHaveLength(2);
    expect(crawlInputs[1]).toMatchObject({
      renderMode: "js",
      collectVitals: true,
      exactUrls: options.exactUrls,
      seedUrls: options.exactUrls,
      limits: expect.objectContaining({ maxUrls: 5 }),
    });
  });

  it("fails closed for missing, active, and unsupported source runs", async () => {
    runtime = new AgentSeoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-run-replay-")),
    });
    const project = await runtime.projects.create({
      name: "Replay guard",
      canonicalUrl: "https://example.com/",
    });
    expect(await runtime.runs.replay("missing", "replay-request-2")).toBeNull();

    const active = runtime.database.insertRun({
      id: "active-source",
      projectId: project.id,
      workflowId: "audit",
      options: { maxUrls: 1 },
    });
    await expect(
      runtime.runs.replay(active.id, "replay-request-3"),
    ).rejects.toMatchObject({
      code: "source_run_not_terminal",
      status: 409,
    });

    const unsupported = runtime.database.insertRun({
      id: "unsupported-source",
      projectId: project.id,
      workflowId: "legacy-audit",
    });
    runtime.database.updateRun(unsupported.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
    });
    await expect(
      runtime.runs.replay(unsupported.id, "replay-request-4"),
    ).rejects.toMatchObject({
      code: "source_workflow_unsupported",
      status: 409,
    });
  });
});
