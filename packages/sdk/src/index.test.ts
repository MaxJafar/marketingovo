import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createGeneratedGolemSeoClient,
  GolemSeoClient,
  validateLocalApiBaseUrl,
} from "./index.js";

describe("local API trust boundary", () => {
  it.each([1, 80, 3210, 65_535])(
    "accepts and canonicalizes explicit loopback port %i",
    (port) => {
      expect(validateLocalApiBaseUrl(`http://127.0.0.1:${port}/api/v1`)).toBe(
        `http://127.0.0.1:${port}/api/v1`,
      );
    },
  );

  it.each([
    "http://localhost:3210/api/v1",
    "http://[::1]:3210/api/v1",
    "http://127.0.0.2:3210/api/v1",
    "https://127.0.0.1:3210/api/v1",
    "http://127.0.0.1/api/v1",
    "http://127.0.0.1:0/api/v1",
    "http://127.0.0.1:65536/api/v1",
    "http://user:password@127.0.0.1:3210/api/v1",
    "http://127.0.0.1:3210/api/v1/",
    "http://127.0.0.1:3210/api/v1/health",
    "http://127.0.0.1:3210/api/v1?next=https://attacker.test",
    "http://127.0.0.1:3210/api/v1#attacker",
  ])("rejects non-canonical token destination %s", (baseUrl) => {
    expect(() => validateLocalApiBaseUrl(baseUrl)).toThrow(
      /must match http:\/\/127\.0\.0\.1:<port>\/api\/v1/u,
    );
  });

  it("rejects a token-file destination before reading or fetching", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      GolemSeoClient.fromTokenFile("/path/that/must/not/be/read", {
        baseUrl: "https://attacker.test/api/v1",
        fetch: fetchImpl,
      }),
    ).rejects.toThrow(/local API URL/u);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a token only to the canonical IPv4 loopback API", async () => {
    const directory = await mkdtemp(join(tmpdir(), "golem-sdk-token-"));
    const tokenFile = join(directory, "service-token");
    await writeFile(tokenFile, "local-service-secret\n", { mode: 0o600 });
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "ok" }),
    );
    const client = await GolemSeoClient.fromTokenFile(tokenFile, {
      baseUrl: "http://127.0.0.1:3210/api/v1",
      fetch: fetchImpl,
    });

    await client.health();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [input, init] = fetchImpl.mock.calls[0]!;
    expect(String(input)).toBe("http://127.0.0.1:3210/api/v1/health");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer local-service-secret",
    );
  });

  it("uses an explicit idempotency key for targeted action verification", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ runId: "verification-run", verificationState: "queued" }),
    );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.actions.verify(
      "action/with spaces",
      "checkpoint-1",
      "verification-key-123",
    );

    const [input, init] = fetchImpl.mock.calls[0]!;
    expect(String(input)).toBe(
      "http://127.0.0.1:3210/api/v1/actions/action%2Fwith%20spaces/verify",
    );
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("idempotency-key")).toBe(
      "verification-key-123",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      checkpointId: "checkpoint-1",
    });
  });

  it("lists and updates marketer issue reviews through the high-level SDK", async () => {
    const fingerprint = "e".repeat(64);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ items: [], total: 0, offset: 50, limit: 50 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          issue: { fingerprint, status: "ignored" },
          latestRunId: "run-1",
          occurrenceCount: 2,
          adjudication: { status: "ignored" },
        }),
      );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.issues.list("project/one", {
      limit: 50,
      offset: 50,
      status: "open",
      severity: "high",
      search: "canonical url",
    });
    await client.issues.update(fingerprint, {
      projectId: "project/one",
      status: "ignored",
      note: "Accepted for this localized campaign page.",
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3210/api/v1/issues?projectId=project%2Fone&limit=50&offset=50&status=open&severity=high&search=canonical+url",
    );
    const [updateUrl, updateInit] = fetchImpl.mock.calls[1]!;
    expect(String(updateUrl)).toBe(
      `http://127.0.0.1:3210/api/v1/issues/${fingerprint}`,
    );
    expect(updateInit?.method).toBe("PATCH");
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      projectId: "project/one",
      status: "ignored",
      note: "Accepted for this localized campaign page.",
    });
  });

  it("reads, versions, and appends project context through exact scoped routes", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          projectId: "project/one",
          current: null,
          history: [],
          journal: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          projectId: "project/one",
          current: { revision: 1 },
          history: [{ revision: 1 }],
          journal: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "entry-1",
          projectId: "project/one",
          sequence: 1,
        }),
      );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });
    const profile = {
      summary: "Turn SEO evidence into verified improvements.",
      audiences: ["SEO leads"],
      markets: ["United States"],
      languages: ["English"],
      conversionGoals: ["Qualified demo request"],
      priorityTopics: ["Technical SEO automation"],
      competitors: ["example-competitor.com"],
      constraints: ["Legal review for comparative claims"],
    };

    await client.context.get("project/one");
    await client.context.update("project/one", {
      profile,
      changeSummary: "Established the shared SEO brief",
    });
    await client.context.append("project/one", {
      kind: "decision",
      title: "Prioritize verifiable fixes",
      detail: "Require a baseline and a repeat audit.",
      sourceRunId: "run/one",
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3210/api/v1/projects/project%2Fone/context",
    );
    const [updateUrl, updateInit] = fetchImpl.mock.calls[1]!;
    expect(String(updateUrl)).toBe(
      "http://127.0.0.1:3210/api/v1/projects/project%2Fone/context",
    );
    expect(updateInit?.method).toBe("PUT");
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      profile,
      changeSummary: "Established the shared SEO brief",
    });
    const [appendUrl, appendInit] = fetchImpl.mock.calls[2]!;
    expect(String(appendUrl)).toBe(
      "http://127.0.0.1:3210/api/v1/projects/project%2Fone/context/journal",
    );
    expect(appendInit?.method).toBe("POST");
    expect(JSON.parse(String(appendInit?.body))).toEqual({
      kind: "decision",
      title: "Prioritize verifiable fixes",
      detail: "Require a baseline and a repeat audit.",
      sourceRunId: "run/one",
    });
  });

  it("manages and previews project extraction rules through encoded routes", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          version: "extraction-template-catalog-v1",
          importMode: "review_required",
          templates: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ projectId: "project/one", current: null, history: [] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          projectId: "project/one",
          current: { revision: 1 },
          history: [{ revision: 1 }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          projectId: "project/one",
          requestedUrl: "https://example.com/product",
          finalUrl: "https://example.com/product",
          fields: [],
        }),
      );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });
    const rule = {
      id: "price-rule",
      label: "Price",
      selector: ".price",
      type: "text" as const,
      attribute: null,
      regex: null,
      enabled: true,
    };

    await client.extractionRules.templates();
    await client.extractionRules.get("project/one");
    await client.extractionRules.update("project/one", {
      rules: [rule],
      changeSummary: "Capture product price",
    });
    await client.extractionRules.preview("project/one", {
      url: "https://example.com/product",
      renderMode: "static",
      allowPrivateHost: false,
      rules: [rule],
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3210/api/v1/extraction-rule-templates",
    );
    const expected =
      "http://127.0.0.1:3210/api/v1/projects/project%2Fone/extraction-rules";
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(expected);
    expect(String(fetchImpl.mock.calls[2]?.[0])).toBe(expected);
    expect(fetchImpl.mock.calls[2]?.[1]?.method).toBe("PUT");
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({
      rules: [rule],
      changeSummary: "Capture product price",
    });
    expect(String(fetchImpl.mock.calls[3]?.[0])).toBe(`${expected}/preview`);
    expect(fetchImpl.mock.calls[3]?.[1]?.method).toBe("POST");
  });

  it("deletes a project only through an encoded route and explicit name confirmation", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        projectId: "project/one",
        deletedAt: "2026-07-15T13:00:00.000Z",
        counts: {
          runs: 1,
          pages: 4,
          issueInstances: 2,
          actions: 1,
          schedules: 0,
          artifacts: 4,
          contextVersions: 1,
          contextEntries: 1,
        },
        artifactCleanup: "complete",
        globalCredentialsRetained: true,
      }),
    );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.projects.delete("project/one", {
      confirmation: "Project One",
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "http://127.0.0.1:3210/api/v1/projects/project%2Fone",
    );
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({
      confirmation: "Project One",
    });
  });

  it("requests a bounded run evidence section with encoded search", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        runId: "run/one",
        state: "available",
        section: "hreflang",
        items: [],
      }),
    );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.runs.evidence("run/one", {
      section: "hreflang",
      limit: 50,
      offset: 100,
      search: "French product",
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3210/api/v1/runs/run%2Fone/evidence?section=hreflang&limit=50&offset=100&search=French+product",
    );
  });

  it("requests a bounded internal-link direction for an encoded page URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        version: "link-graph-v1",
        runId: "run/one",
        state: "available",
        direction: "outlinks",
        items: [],
      }),
    );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.runs.links("run/one", {
      pageUrl: "https://example.com/product?a=1&b=two",
      direction: "outlinks",
      limit: 25,
      offset: 50,
      search: "Pricing plan",
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3210/api/v1/runs/run%2Fone/links?pageUrl=https%3A%2F%2Fexample.com%2Fproduct%3Fa%3D1%26b%3Dtwo&direction=outlinks&limit=25&offset=50&search=Pricing+plan",
    );
  });

  it("replays a run through the idempotent encoded endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        sourceRunId: "run/one",
        configurationVersion: 1,
        configurationHash: "a".repeat(64),
        run: { id: "replay-one" },
      }),
    );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.runs.replay("run/one", "sdk-replay-key-123");

    const [input, init] = fetchImpl.mock.calls[0]!;
    expect(String(input)).toBe(
      "http://127.0.0.1:3210/api/v1/runs/run%2Fone/replay",
    );
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("idempotency-key")).toBe(
      "sdk-replay-key-123",
    );
  });

  it("compares two encoded audit run identifiers", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ scoreVersion: "regression-v1" }),
    );
    const client = new GolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "local-service-secret",
      fetch: fetchImpl,
    });

    await client.runs.compare("current/run", "baseline/run");

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3210/api/v1/runs/current%2Frun/comparison?baselineRunId=baseline%2Frun",
    );
  });

  it("exposes every OpenAPI path through a generated client without weakening token scope", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        status: "ok",
        database: "ok",
        queue: "ok",
        version: "0.11.0-alpha.0",
      }),
    );
    const client = createGeneratedGolemSeoClient({
      baseUrl: "http://127.0.0.1:3210/api/v1",
      token: "generated-client-secret",
      fetch: fetchImpl,
    });

    const { data, error } = await client.GET("/api/v1/health");

    expect(error).toBeUndefined();
    expect(data?.status).toBe("ok");
    const request = fetchImpl.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).url).toBe(
      "http://127.0.0.1:3210/api/v1/health",
    );
    expect((request as Request).headers.get("authorization")).toBe(
      "Bearer generated-client-secret",
    );
    expect((request as Request).redirect).toBe("error");
  });
});
