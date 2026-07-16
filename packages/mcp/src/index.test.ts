import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GolemIntelClient } from "@golem-intel/sdk";
import { GolemIntelClient as HttpClient } from "@golem-intel/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_TOOL_NAMES,
  createGolemIntelMcpServer,
  createGolemIntelMcpToolHandlers,
} from "./index.js";
import {
  createAuthorizedMcpFetch,
  createGolemIntelMcpHttpHandler,
} from "./http.js";

const LOCKED_TOOLS = [
  "golem_intel_research_start",
  "golem_intel_compare_start",
  "golem_intel_run_get",
  "golem_intel_search",
  "golem_intel_entity_get",
  "golem_intel_monitoring_status",
] as const;

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
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
  const runList = vi.fn().mockResolvedValue([]);
  const search = vi.fn().mockResolvedValue([{ id: "search-1" }]);
  const entity = vi.fn().mockResolvedValue({ id: "entity-1" });
  const monitoringStatus = vi.fn().mockResolvedValue({ daemon: "available" });
  return {
    client: {
      research: { start: researchStart },
      comparisons: { start: compareStart },
      runs: { get: runGet, report: runReport, list: runList },
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

function parsedText(result: { content: { text: string }[] }): unknown {
  return JSON.parse(result.content[0]?.text ?? "null") as unknown;
}

describe("Golem Intel MCP surface", () => {
  it("registers exactly the six locked high-level tools", async () => {
    const { client } = fakeClient();
    const server = await createGolemIntelMcpServer({ client });
    const registered = Object.keys(
      (
        server as unknown as {
          _registeredTools: Record<string, unknown>;
        }
      )._registeredTools,
    );
    expect(PUBLIC_TOOL_NAMES).toEqual(LOCKED_TOOLS);
    expect(registered).toEqual(LOCKED_TOOLS);
    expect(registered.join(" ")).not.toMatch(
      /contact|credential|policy|delet|outreach|employment|collector|connector_run/iu,
    );
    await server.close();
  });

  it("maps research and comparison inputs to bounded SDK requests", async () => {
    const { client, calls } = fakeClient();
    const handlers = createGolemIntelMcpToolHandlers(client);

    expect(
      parsedText(
        await handlers.researchStart({
          project_id: "project-1",
          question: "What materially changed?",
          target_ids: ["northstar"],
        }),
      ),
    ).toEqual({ id: "research-run" });
    expect(calls.researchStart).toHaveBeenCalledWith({
      project_id: "project-1",
      question: "What materially changed?",
      target_ids: ["northstar"],
      source_budget: 20,
    });

    expect(
      parsedText(
        await handlers.compareStart({
          project_id: "project-1",
          target_ids: ["northstar", "orbit"],
          goal: "Compare observed engagement",
        }),
      ),
    ).toEqual({ id: "compare-run" });
    expect(calls.compareStart).toHaveBeenCalledWith({
      project_id: "project-1",
      target_ids: ["northstar", "orbit"],
      goal: "Compare observed engagement",
      connector_ids: ["fixture.competitive-pulse"],
      simulate: "none",
    });
  });

  it("maps read tools and only retrieves an available requested report", async () => {
    const { client, calls } = fakeClient();
    const handlers = createGolemIntelMcpToolHandlers(client);

    expect(parsedText(await handlers.runGet({ run_id: "run-1" }))).toEqual({
      run: { id: "run-1", report_available: true },
      report: { schema_version: "v1" },
    });
    expect(calls.runGet).toHaveBeenCalledWith("run-1");
    expect(calls.runReport).toHaveBeenCalledWith("run-1");

    calls.runReport.mockClear();
    await handlers.runGet({ run_id: "run-1", include_report: false });
    expect(calls.runReport).not.toHaveBeenCalled();

    expect(
      parsedText(await handlers.search({ q: "velocity", limit: 7 })),
    ).toEqual([{ id: "search-1" }]);
    expect(calls.search).toHaveBeenCalledWith("velocity", 7);
    expect(
      parsedText(await handlers.entityGet({ entity_id: "entity-1" })),
    ).toEqual({ id: "entity-1" });
    expect(calls.entity).toHaveBeenCalledWith("entity-1");
    expect(parsedText(await handlers.monitoringStatus({}))).toEqual({
      daemon: "available",
    });
    expect(calls.monitoringStatus).toHaveBeenCalledOnce();
  });

  it("keeps bearer material out of URLs and console output", async () => {
    const secret = "S".repeat(43);
    const requests: Request[] = [];
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const client = new HttpClient({
      baseUrl: "http://127.0.0.1:7465",
      token: secret,
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    await createGolemIntelMcpToolHandlers(client).search({ q: "market" });
    expect(requests[0]?.url).toBe(
      "http://127.0.0.1:7465/v1/search?q=market&limit=20",
    );
    expect(requests[0]?.url).not.toContain(secret);
    expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${secret}`);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("fails closed when configured with a non-loopback API URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "golem-intel-mcp-"));
    temporaryDirectories.push(directory);
    const tokenFile = join(directory, "service-token");
    await writeFile(tokenFile, `${"T".repeat(43)}\n`, { mode: 0o600 });
    await chmod(tokenFile, 0o600);
    await expect(
      createGolemIntelMcpServer({
        baseUrl: "http://attacker.invalid:7465",
        tokenFile,
      }),
    ).rejects.toThrow(/exact http:\/\/127\.0\.0\.1:<port> origin/u);
  });

  it("serves the same surface over authenticated loopback Streamable HTTP", async () => {
    const { client } = fakeClient();
    const token = "H".repeat(43);
    const handler = createGolemIntelMcpHttpHandler(client);
    const fetchMcp = createAuthorizedMcpFetch(handler, {
      origin: "http://127.0.0.1:7467",
      token,
    });
    try {
      const unauthorized = await fetchMcp(
        new Request("http://127.0.0.1:7467/mcp", {
          method: "POST",
          headers: {
            host: "127.0.0.1:7467",
            "content-type": "application/json",
          },
          body: "{}",
        }),
      );
      expect(unauthorized.status).toBe(401);

      const rejectedHost = await fetchMcp(
        new Request("http://127.0.0.1:7467/mcp", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            host: "attacker.invalid:7467",
            "content-type": "application/json",
          },
          body: "{}",
        }),
      );
      expect(rejectedHost.status).toBe(403);

      const initialized = await fetchMcp(
        new Request("http://127.0.0.1:7467/mcp", {
          method: "POST",
          headers: {
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${token}`,
            host: "127.0.0.1:7467",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "golem-test", version: "1.0.0" },
            },
          }),
        }),
      );
      const payload = await initialized.text();
      expect(initialized.status).toBe(200);
      expect(payload).toContain("golem-intel");
      expect(payload).not.toContain(token);
    } finally {
      await handler.close();
    }
  });
});
