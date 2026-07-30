import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod/v4";
import type { AgentSeoClient } from "@marketingovo/sdk";
import { createAgentSeoMcpServer, PUBLIC_TOOL_NAMES } from "./index.js";

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
      evidence: vi.fn(async () => ({
        section: "crawl",
        version: 1,
        items: [{ url: "https://example.com/a" }],
        total: 1,
        offset: 0,
        limit: 50,
      })),
      links: vi.fn(async () => ({
        linkGraphVersion: 1,
        available: true,
        items: [{ target: "https://example.com/b", anchor: "b" }],
        total: 1,
        offset: 0,
        limit: 50,
      })),
      compare: vi.fn(async () => ({
        version: "regression-v1",
        newIssues: [],
        resolvedIssues: [],
      })),
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

describe("Marketingovo MCP public contract", () => {
  it("makes the canonical server factory primary while retaining its 1.x alias", () => {
    expect(createAgentSeoMcpServer).toBe(createAgentSeoMcpServer);
  });

  it("registers exactly the nine approved workflow tools", async () => {
    const { client } = stubClient("running");
    const server = await createAgentSeoMcpServer({ client });

    expect(Object.keys(registeredTools(server))).toEqual([
      ...PUBLIC_TOOL_NAMES,
    ]);
    expect(PUBLIC_TOOL_NAMES).toEqual([
      "marketingovo_audit_start",
      "marketingovo_run_get",
      "marketingovo_run_evidence",
      "marketingovo_run_links",
      "marketingovo_run_compare",
      "marketingovo_compare_start",
      "marketingovo_keyword_research_start",
      "marketingovo_content_plan_start",
      "marketingovo_monitoring_status",
    ]);
  });

  it("passes evidence pagination through untouched and defaults the section", async () => {
    const { client } = stubClient("succeeded");
    const server = await createAgentSeoMcpServer({ client });
    const tool = registeredTools(server).marketingovo_run_evidence;

    await tool.handler({ run_id: "run-1" });
    expect(client.runs.evidence).toHaveBeenCalledWith("run-1", {
      section: "crawl",
    });

    await tool.handler({
      run_id: "run-1",
      section: "redirects",
      search: "/pricing",
      limit: 10,
      offset: 20,
    });
    expect(client.runs.evidence).toHaveBeenLastCalledWith("run-1", {
      section: "redirects",
      search: "/pricing",
      limit: 10,
      offset: 20,
    });
  });

  it("rejects an evidence section the API does not serve", async () => {
    const { client } = stubClient("succeeded");
    const server = await createAgentSeoMcpServer({ client });
    const tool = registeredTools(server).marketingovo_run_evidence;

    expect(
      tool.inputSchema.safeParse({ run_id: "run-1", section: "sitemaps" })
        .success,
    ).toBe(false);
  });

  it("requires an http page URL for the link explorer", async () => {
    const { client } = stubClient("succeeded");
    const server = await createAgentSeoMcpServer({ client });
    const tool = registeredTools(server).marketingovo_run_links;

    expect(
      tool.inputSchema.safeParse({
        run_id: "run-1",
        page_url: "file:///etc/passwd",
      }).success,
    ).toBe(false);

    await tool.handler({
      run_id: "run-1",
      page_url: "https://example.com/a",
    });
    expect(client.runs.links).toHaveBeenCalledWith("run-1", {
      pageUrl: "https://example.com/a",
      direction: "inlinks",
    });
  });

  it("delegates run comparison to the server instead of recomputing it", async () => {
    const { client } = stubClient("succeeded");
    const server = await createAgentSeoMcpServer({ client });
    const tool = registeredTools(server).marketingovo_run_compare;

    const result = await tool.handler({
      run_id: "run-2",
      baseline_run_id: "run-1",
    });
    expect(client.runs.compare).toHaveBeenCalledWith("run-2", "run-1");
    expect(result.content[0].text).toContain("regression-v1");
  });

  it("exposes project context as a read-only resource without expanding the tool surface", async () => {
    const { client } = stubClient("running");
    const server = await createAgentSeoMcpServer({ client });
    const resources = registeredResourceTemplates(server);

    expect(Object.keys(registeredTools(server))).toEqual([
      ...PUBLIC_TOOL_NAMES,
    ]);
    expect(resources["marketingovo-project-context"]).toBeDefined();

    const result = await resources[
      "marketingovo-project-context"
    ]!.readCallback(
      new URL("marketingovo://projects/project-1/context"),
      { id: "project-1" },
      {},
    );
    expect(result.contents[0]).toMatchObject({
      uri: "marketingovo://projects/project-1/context",
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
      tools.marketingovo_audit_start.inputSchema.parse({
        project_id: "site-1",
      }),
    ).toEqual({
      project_id: "site-1",
      render_mode: "static",
      collect_vitals: false,
    });
    expect(
      tools.marketingovo_audit_start.inputSchema.safeParse({
        project_id: "site-1",
        render_mode: "browser",
      }).success,
    ).toBe(false);
    expect(
      tools.marketingovo_audit_start.inputSchema.safeParse({
        project_id: "site-1",
        credential: "must-not-exist",
      }).success,
    ).toBe(false);
    expect(
      tools.marketingovo_compare_start.inputSchema.safeParse({
        project_id: "site-1",
        competitor_urls: ["ftp://example.com"],
      }).success,
    ).toBe(false);
    expect(
      tools.marketingovo_compare_start.inputSchema.safeParse({
        project_id: "site-1",
        competitor_urls: ["https://example.com"],
        max_urls: 1.5,
      }).success,
    ).toBe(false);
    expect(
      tools.marketingovo_content_plan_start.inputSchema.safeParse({
        project_id: "site-1",
        seeds: Array.from({ length: 11 }, (_, index) => `seed-${index}`),
      }).success,
    ).toBe(false);
  });

  it("does not read issues while an asynchronous run is unfinished", async () => {
    const { client, issues } = stubClient("running");
    const server = await createAgentSeoMcpServer({ client });

    const result = await registeredTools(server).marketingovo_run_get.handler({
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

      const result = await registeredTools(server).marketingovo_run_get.handler(
        {
          run_id: "run-1",
          include_issues: true,
        },
      );

      expect(issues).toHaveBeenCalledWith("run-1");
      expect(JSON.parse(result.content[0]!.text).issues).toEqual([
        { fingerprint: "issue-1" },
      ]);
    },
  );

  it("returns persisted research output for a terminal research workflow", async () => {
    const { client } = stubClient("succeeded", "keyword-research");
    const server = await createAgentSeoMcpServer({ client });

    const result = await registeredTools(server).marketingovo_run_get.handler({
      run_id: "run-1",
      include_issues: true,
    });

    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      run: { workflowId: "keyword-research", status: "succeeded" },
      result: { profile: { seed: "seo" } },
    });
  });
});
