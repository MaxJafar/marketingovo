import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod/v4";
import type { GolemSeoClient } from "@golem-seo/sdk";
import { createGolemSeoMcpServer, PUBLIC_TOOL_NAMES } from "./index.js";

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
  server: Awaited<ReturnType<typeof createGolemSeoMcpServer>>,
): Record<string, RegisteredTool> {
  return (
    server as unknown as { _registeredTools: Record<string, RegisteredTool> }
  )._registeredTools;
}

function registeredResourceTemplates(
  server: Awaited<ReturnType<typeof createGolemSeoMcpServer>>,
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
  } as unknown as GolemSeoClient;
  return { client, issues };
}

describe("Golem SEO MCP public contract", () => {
  it("registers exactly the six approved workflow tools", async () => {
    const { client } = stubClient("running");
    const server = await createGolemSeoMcpServer({ client });

    expect(Object.keys(registeredTools(server))).toEqual([
      ...PUBLIC_TOOL_NAMES,
    ]);
    expect(PUBLIC_TOOL_NAMES).toEqual([
      "golem_seo_audit_start",
      "golem_seo_run_get",
      "golem_seo_compare_start",
      "golem_seo_keyword_research_start",
      "golem_seo_content_plan_start",
      "golem_seo_monitoring_status",
    ]);
  });

  it("exposes project context as a read-only resource without expanding the tool surface", async () => {
    const { client } = stubClient("running");
    const server = await createGolemSeoMcpServer({ client });
    const resources = registeredResourceTemplates(server);

    expect(Object.keys(registeredTools(server))).toEqual([
      ...PUBLIC_TOOL_NAMES,
    ]);
    expect(resources["golem-seo-project-context"]).toBeDefined();

    const result = await resources["golem-seo-project-context"]!.readCallback(
      new URL("golem-seo://projects/project-1/context"),
      { id: "project-1" },
      {},
    );
    expect(result.contents[0]).toMatchObject({
      uri: "golem-seo://projects/project-1/context",
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
    const tools = registeredTools(await createGolemSeoMcpServer({ client }));

    expect(
      tools.golem_seo_audit_start.inputSchema.parse({ project_id: "site-1" }),
    ).toEqual({
      project_id: "site-1",
      render_mode: "static",
      collect_vitals: false,
    });
    expect(
      tools.golem_seo_audit_start.inputSchema.safeParse({
        project_id: "site-1",
        render_mode: "browser",
      }).success,
    ).toBe(false);
    expect(
      tools.golem_seo_audit_start.inputSchema.safeParse({
        project_id: "site-1",
        credential: "must-not-exist",
      }).success,
    ).toBe(false);
    expect(
      tools.golem_seo_compare_start.inputSchema.safeParse({
        project_id: "site-1",
        competitor_urls: ["ftp://example.com"],
      }).success,
    ).toBe(false);
    expect(
      tools.golem_seo_compare_start.inputSchema.safeParse({
        project_id: "site-1",
        competitor_urls: ["https://example.com"],
        max_urls: 1.5,
      }).success,
    ).toBe(false);
    expect(
      tools.golem_seo_content_plan_start.inputSchema.safeParse({
        project_id: "site-1",
        seeds: Array.from({ length: 11 }, (_, index) => `seed-${index}`),
      }).success,
    ).toBe(false);
  });

  it("does not read issues while an asynchronous run is unfinished", async () => {
    const { client, issues } = stubClient("running");
    const server = await createGolemSeoMcpServer({ client });

    const result = await registeredTools(server).golem_seo_run_get.handler({
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
      const server = await createGolemSeoMcpServer({ client });

      const result = await registeredTools(server).golem_seo_run_get.handler({
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
    const server = await createGolemSeoMcpServer({ client });

    const result = await registeredTools(server).golem_seo_run_get.handler({
      run_id: "run-1",
      include_issues: true,
    });

    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      run: { workflowId: "keyword-research", status: "succeeded" },
      result: { profile: { seed: "seo" } },
    });
  });
});
