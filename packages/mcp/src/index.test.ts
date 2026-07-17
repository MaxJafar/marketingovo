import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod/v4";
import type { AgentSeoClient } from "@agentseoapp/sdk";
import {
  createAgentSeoMcpServer,
  createGolemSeoMcpServer,
  PUBLIC_TOOL_NAMES,
} from "./index.js";

type RegisteredTool = {
  inputSchema: ZodType;
  handler(input: Record<string, unknown>): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
};

type RegisteredResourceTemplate = {
  readCallback(
    uri: URL,
    variables: Record<string, string>,
    context: unknown,
  ): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string }>;
  }>;
};

function registeredTools(
  server: Awaited<ReturnType<typeof createAgentSeoMcpServer>>,
): Record<string, RegisteredTool> {
  return (
    server as unknown as { _registeredTools: Record<string, RegisteredTool> }
  )._registeredTools;
}

function registeredResourceTemplates(
  server: Awaited<ReturnType<typeof createAgentSeoMcpServer>>,
): Record<string, RegisteredResourceTemplate> {
  return (
    server as unknown as {
      _registeredResourceTemplates: Record<string, RegisteredResourceTemplate>;
    }
  )._registeredResourceTemplates;
}

function stubClient(status: string, workflowId = "audit") {
  const issues = vi.fn(async () => [{ fingerprint: "issue-1" }]);
  const client = {
    health: vi.fn(async () => ({ status: "ok" })),
    projects: {
      list: vi.fn(async () => []),
      overview: vi.fn(async () => ({})),
    },
    issues: {
      list: vi.fn(async () => ({
        items: [],
        total: 0,
        offset: 0,
        limit: 250,
      })),
    },
    context: {
      get: vi.fn(async (projectId: string) => ({
        projectId,
        current: {
          projectId,
          revision: 2,
          profile: { summary: "Evidence-led SEO" },
        },
        history: [{ revision: 2 }, { revision: 1 }],
        journal: [{ sequence: 1, kind: "decision" }],
      })),
    },
    runs: {
      start: vi.fn(async () => ({ id: "run-1", status: "queued" })),
      get: vi.fn(async () => ({ id: "run-1", status, workflowId })),
      issues,
      list: vi.fn(async () => []),
    },
    schedules: { list: vi.fn(async () => []) },
    reports: {
      get: vi.fn(async () =>
        new TextEncoder().encode(JSON.stringify({ profile: { seed: "seo" } })),
      ),
    },
  } as unknown as AgentSeoClient;
  return { client, issues };
}

describe("AGENTseo MCP public contract", () => {
  it("makes the canonical server factory primary while retaining its 1.x alias", () => {
    expect(createGolemSeoMcpServer).toBe(createAgentSeoMcpServer);
  });

  it("registers exactly the six approved workflow tools", async () => {
    const { client } = stubClient("running");
    const server = await createAgentSeoMcpServer({ client });

    expect(Object.keys(registeredTools(server))).toEqual([
      ...PUBLIC_TOOL_NAMES,
    ]);
    expect(PUBLIC_TOOL_NAMES).toEqual([
      "agentseo_audit_start",
      "agentseo_run_get",
      "agentseo_compare_start",
      "agentseo_keyword_research_start",
      "agentseo_content_plan_start",
      "agentseo_monitoring_status",
    ]);
  });

  it("exposes project context as a read-only resource without expanding the tool surface", async () => {
    const { client } = stubClient("running");
    const server = await createAgentSeoMcpServer({ client });
    const resources = registeredResourceTemplates(server);

    expect(Object.keys(registeredTools(server))).toEqual([
      ...PUBLIC_TOOL_NAMES,
    ]);
    expect(resources["agentseo-project-context"]).toBeDefined();

    const result = await resources["agentseo-project-context"]!.readCallback(
      new URL("agentseo://projects/project-1/context"),
      { id: "project-1" },
      {},
    );
    expect(result.contents[0]).toMatchObject({
      uri: "agentseo://projects/project-1/context",
      mimeType: "application/json",
    });
    expect(JSON.parse(result.contents[0]!.text!)).toMatchObject({
      projectId: "project-1",
      current: { revision: 2, profile: { summary: "Evidence-led SEO" } },
      journal: [{ sequence: 1, kind: "decision" }],
    });
    expect(client.context.get).toHaveBeenCalledWith("project-1");
  });

  it("projects strict canonical JSON Schemas into MCP runtime validation", async () => {
    const { client } = stubClient("running");
    const tools = registeredTools(await createAgentSeoMcpServer({ client }));

    expect(
      tools.agentseo_audit_start.inputSchema.parse({ project_id: "site-1" }),
    ).toEqual({
      project_id: "site-1",
      render_mode: "static",
      collect_vitals: false,
    });
    expect(
      tools.agentseo_audit_start.inputSchema.safeParse({
        project_id: "site-1",
        render_mode: "browser",
      }).success,
    ).toBe(false);
    expect(
      tools.agentseo_audit_start.inputSchema.safeParse({
        project_id: "site-1",
        credential: "must-not-exist",
      }).success,
    ).toBe(false);
    expect(
      tools.agentseo_compare_start.inputSchema.safeParse({
        project_id: "site-1",
        competitor_urls: ["ftp://example.com"],
      }).success,
    ).toBe(false);
    expect(
      tools.agentseo_compare_start.inputSchema.safeParse({
        project_id: "site-1",
        competitor_urls: ["https://example.com"],
        max_urls: 1.5,
      }).success,
    ).toBe(false);
    expect(
      tools.agentseo_content_plan_start.inputSchema.safeParse({
        project_id: "site-1",
        seeds: Array.from({ length: 11 }, (_, index) => `seed-${index}`),
      }).success,
    ).toBe(false);
  });

  it("does not read issues while an asynchronous run is unfinished", async () => {
    const { client, issues } = stubClient("running");
    const server = await createAgentSeoMcpServer({ client });

    const result = await registeredTools(server).agentseo_run_get.handler({
      run_id: "run-1",
      include_issues: true,
    });

    expect(issues).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      run: { id: "run-1", status: "running" },
      issues: [],
    });
  });

  it.each(["succeeded", "partial"])(
    "returns canonical issues for a %s run",
    async (status) => {
      const { client, issues } = stubClient(status);
      const server = await createAgentSeoMcpServer({ client });

      const result = await registeredTools(server).agentseo_run_get.handler({
        run_id: "run-1",
        include_issues: true,
      });

      expect(issues).toHaveBeenCalledWith("run-1");
      expect(JSON.parse(result.content[0]!.text).issues).toEqual([
        { fingerprint: "issue-1" },
      ]);
    },
  );

  it("returns persisted research output for a terminal research workflow", async () => {
    const { client } = stubClient("succeeded", "keyword-research");
    const server = await createAgentSeoMcpServer({ client });

    const result = await registeredTools(server).agentseo_run_get.handler({
      run_id: "run-1",
      include_issues: true,
    });

    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      run: { workflowId: "keyword-research", status: "succeeded" },
      result: { profile: { seed: "seo" } },
    });
  });
});
