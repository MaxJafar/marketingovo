import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GolemIntelClient } from "@golem-intel/sdk";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import type { TSchema } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import openClawPlugin, {
  createGolemIntelOpenClawTools,
  type GolemIntelOpenClawConfig,
  type GolemIntelOpenClawExecutionContext,
  type GolemIntelOpenClawToolBuilder,
} from "./index.js";

const LOCKED_TOOLS = [
  "golem_intel_research_start",
  "golem_intel_compare_start",
  "golem_intel_run_get",
  "golem_intel_search",
  "golem_intel_entity_get",
  "golem_intel_monitoring_status",
] as const;

interface CapturedTool {
  name: string;
  optional?: boolean;
  parameters: TSchema;
  execute(
    params: Record<string, unknown>,
    config: GolemIntelOpenClawConfig,
    context: GolemIntelOpenClawExecutionContext,
  ): unknown | Promise<unknown>;
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

function fakeClient() {
  const researchStart = vi.fn().mockResolvedValue({ id: "research-run" });
  const compareStart = vi.fn().mockResolvedValue({ id: "compare-run" });
  const runGet = vi.fn().mockResolvedValue({
    id: "run-1",
    report_available: true,
  });
  const runReport = vi.fn().mockResolvedValue({ schema_version: "v1" });
  const search = vi.fn().mockResolvedValue([{ id: "search-1" }]);
  const entity = vi.fn().mockResolvedValue({ id: "entity-1" });
  const monitoringStatus = vi.fn().mockResolvedValue({ daemon: "available" });
  return {
    client: {
      research: { start: researchStart },
      comparisons: { start: compareStart },
      runs: { get: runGet, report: runReport },
      search,
      entity,
      monitoringStatus,
    } as unknown as GolemIntelClient,
    calls: {
      researchStart,
      compareStart,
      runGet,
      runReport,
      search,
      entity,
      monitoringStatus,
    },
  };
}

function captureTools(client: GolemIntelClient): {
  tools: CapturedTool[];
  resolveClient: ReturnType<typeof vi.fn>;
} {
  const tools: CapturedTool[] = [];
  const builder: GolemIntelOpenClawToolBuilder = (definition) => {
    tools.push(definition as unknown as CapturedTool);
    return definition;
  };
  const resolveClient = vi.fn().mockResolvedValue(client);
  createGolemIntelOpenClawTools(builder, resolveClient);
  return { tools, resolveClient };
}

function byName(tools: CapturedTool[], name: string): CapturedTool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing test tool: ${name}`);
  return tool;
}

async function privateTokenFile(
  content = `${"T".repeat(43)}\n`,
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "golem-intel-openclaw-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "service-token");
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}

describe("Golem Intel OpenClaw surface", () => {
  it("publishes exactly the six locked high-level tools", () => {
    const metadata = getToolPluginMetadata(openClawPlugin);
    expect(metadata?.id).toBe("golem-intel");
    expect(metadata?.tools.map((tool) => tool.name)).toEqual(LOCKED_TOOLS);
    const serializedSchemas = JSON.stringify(
      metadata?.tools.map((tool) => tool.parameters),
    );
    expect(serializedSchemas).not.toMatch(
      /contact|credential|service[_-]?token|policy|delet|outreach|employment|collector/iu,
    );
  });

  it("maps research and comparison inputs to bounded SDK requests", async () => {
    const { client, calls } = fakeClient();
    const { tools } = captureTools(client);
    const context = {};
    const config = { serverUrl: "http://127.0.0.1:7465" };

    await byName(tools, LOCKED_TOOLS[0]).execute(
      {
        project_id: "project-1",
        question: "What materially changed?",
        target_ids: ["northstar"],
      },
      config,
      context,
    );
    expect(calls.researchStart).toHaveBeenCalledWith({
      project_id: "project-1",
      question: "What materially changed?",
      target_ids: ["northstar"],
      source_budget: 20,
    });

    await byName(tools, LOCKED_TOOLS[1]).execute(
      {
        project_id: "project-1",
        target_ids: ["northstar", "orbit"],
        goal: "Compare observed engagement",
      },
      config,
      context,
    );
    expect(calls.compareStart).toHaveBeenCalledWith({
      project_id: "project-1",
      target_ids: ["northstar", "orbit"],
      goal: "Compare observed engagement",
      connector_ids: ["fixture.competitive-pulse"],
      simulate: "none",
    });
  });

  it("maps read inputs and only fetches a requested available report", async () => {
    const { client, calls } = fakeClient();
    const { tools } = captureTools(client);
    const config = { serverUrl: "http://127.0.0.1:7465" };

    await expect(
      byName(tools, LOCKED_TOOLS[2]).execute({ run_id: "run-1" }, config, {}),
    ).resolves.toEqual({
      run: { id: "run-1", report_available: true },
      report: { schema_version: "v1" },
    });
    expect(calls.runGet).toHaveBeenCalledWith("run-1");
    expect(calls.runReport).toHaveBeenCalledWith("run-1");

    calls.runReport.mockClear();
    await byName(tools, LOCKED_TOOLS[2]).execute(
      { run_id: "run-1", include_report: false },
      config,
      {},
    );
    expect(calls.runReport).not.toHaveBeenCalled();

    await byName(tools, LOCKED_TOOLS[3]).execute(
      { q: "velocity", limit: 7 },
      config,
      {},
    );
    expect(calls.search).toHaveBeenCalledWith("velocity", 7);
    await byName(tools, LOCKED_TOOLS[4]).execute(
      { entity_id: "entity-1" },
      config,
      {},
    );
    expect(calls.entity).toHaveBeenCalledWith("entity-1");
    await byName(tools, LOCKED_TOOLS[5]).execute({}, config, {});
    expect(calls.monitoringStatus).toHaveBeenCalledOnce();
  });

  it("checks cancellation before starting an open-world workflow", async () => {
    const { client } = fakeClient();
    const { tools, resolveClient } = captureTools(client);
    const controller = new AbortController();
    controller.abort();
    await expect(
      byName(tools, LOCKED_TOOLS[0]).execute(
        {
          project_id: "project-1",
          question: "What changed?",
          target_ids: ["northstar"],
        },
        {},
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
    expect(resolveClient).not.toHaveBeenCalled();
  });

  it("keeps token-file bearer material out of URLs and console output", async () => {
    const secret = "T".repeat(43);
    const tokenFile = await privateTokenFile(`${secret}\n`);
    const requests: Request[] = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetcher);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const definitions: CapturedTool[] = [];
    createGolemIntelOpenClawTools((definition) => {
      definitions.push(definition as unknown as CapturedTool);
      return definition;
    });

    await byName(definitions, LOCKED_TOOLS[3]).execute(
      { q: "market" },
      {
        serverUrl: "http://127.0.0.1:7465",
        tokenFile,
      },
      {},
    );
    expect(requests[0]?.url).toBe(
      "http://127.0.0.1:7465/v1/search?q=market&limit=20",
    );
    expect(requests[0]?.url).not.toContain(secret);
    expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${secret}`);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("fails closed on hostile origins and malformed token files", async () => {
    const validTokenFile = await privateTokenFile();
    const malformedTokenFile = await privateTokenFile("not-a-service-token");
    const definitions: CapturedTool[] = [];
    createGolemIntelOpenClawTools((definition) => {
      definitions.push(definition as unknown as CapturedTool);
      return definition;
    });
    const search = byName(definitions, LOCKED_TOOLS[3]);

    await expect(
      search.execute(
        { q: "market" },
        {
          serverUrl: "http://attacker.invalid:7465",
          tokenFile: validTokenFile,
        },
        {},
      ),
    ).rejects.toThrow(/exact http:\/\/127\.0\.0\.1:<port> origin/u);
    await expect(
      search.execute(
        { q: "market" },
        {
          serverUrl: "http://127.0.0.1:7465",
          tokenFile: malformedTokenFile,
        },
        {},
      ),
    ).rejects.toThrow(/exactly 43 base64url characters/u);
  });
});
