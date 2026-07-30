import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(
  body: unknown,
  status = 200,
  contentType = "application/json",
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

async function loadClient() {
  return import("../api/client");
}

describe("apiRequest session flow", () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("restores an existing session before reading a versioned envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          csrf: "csrf-existing",
          expiresAt: "2026-07-16T00:00:00Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { value: 12 },
          meta: { state: "stale", generatedAt: "2026-07-15T00:00:00Z" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    const result = await apiRequest<{ value: number }>(
      "/overview?siteId=site-1",
    );

    expect(result.data.value).toBe(12);
    expect(result.meta.state).toBe("stale");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/session",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/overview?siteId=site-1",
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );
  });

  it("exchanges a fragment token once, removes it, and protects a mutation with CSRF", async () => {
    window.history.replaceState(
      null,
      "",
      "/#token=one-time-bootstrap-token-1234567890",
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          csrf: "csrf-bootstrap",
          expiresAt: "2026-07-16T00:00:00Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: "run-1" }, meta: { state: "fresh" } }, 202),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    await apiRequest<{ id: string }>("/runs", {
      method: "POST",
      body: JSON.stringify({ siteId: "site-1" }),
    });

    const bootstrapInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/session/bootstrap");
    expect(bootstrapInit.method).toBe("POST");
    expect(JSON.parse(String(bootstrapInit.body))).toEqual({
      token: "one-time-bootstrap-token-1234567890",
    });
    expect(window.location.hash).toBe("");

    const mutationInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(mutationInit.headers);
    expect(headers.get("X-AGENTseo-CSRF")).toBe("csrf-bootstrap");
    expect(headers.get("X-AGENTseo-Client")).toBe("dashboard");
    expect(headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("adds a fresh idempotency key to an action verification start", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrf: "csrf-verification" }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: { runId: "verify-run-1", verificationState: "queued" },
            meta: { state: "fresh" },
          },
          202,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    await apiRequest("/actions/action%2Fone/verify", {
      method: "POST",
      body: JSON.stringify({ checkpointId: "checkpoint-1" }),
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get("X-AGENTseo-CSRF")).toBe("csrf-verification");
    expect(headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("adds a fresh idempotency key to a run replay", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrf: "csrf-replay" }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              sourceRunId: "run-1",
              configurationVersion: 1,
              configurationHash: "a".repeat(64),
              run: { id: "run-2", status: "queued" },
            },
            meta: { state: "fresh" },
          },
          202,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    await apiRequest("/runs/run%2Fone/replay", { method: "POST" });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get("X-AGENTseo-CSRF")).toBe("csrf-replay");
    expect(headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("deduplicates the session handshake across concurrent API requests", async () => {
    let releaseSession: ((response: Response) => void) | undefined;
    const pendingSession = new Promise<Response>((resolve) => {
      releaseSession = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => pendingSession)
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [] }, meta: { state: "missing" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [] }, meta: { state: "missing" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    const sites = apiRequest("/sites");
    const actions = apiRequest("/actions?siteId=site-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    releaseSession?.(jsonResponse({ csrf: "csrf-shared" }));
    await Promise.all([sites, actions]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/v1/session"),
    ).toHaveLength(1);
  });

  it("parses problem+json errors without fabricating data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrf: "csrf-error-test" }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            type: "https://golemworkers.com/problems/source-unavailable",
            title: "Source unavailable",
            status: 503,
            detail: "Search Console did not respond",
            code: "source_unavailable",
          },
          503,
          "application/problem+json",
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    await expect(apiRequest("/overview")).rejects.toEqual(
      expect.objectContaining({
        status: 503,
        code: "source_unavailable",
        message: "Search Console did not respond",
      }),
    );
  });

  it("keeps the HTTP status when an API error body is malformed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrf: "csrf-malformed-test" }))
      .mockResolvedValueOnce(
        new Response("{not-json", {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await loadClient();

    await expect(apiRequest("/system/health")).rejects.toEqual(
      expect.objectContaining({
        status: 502,
        message: "Request failed with status 502",
      }),
    );
  });

  it("normalizes session network failures into the dashboard unavailable state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const { apiRequest } = await loadClient();

    await expect(apiRequest("/sites")).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        code: "api_unavailable",
        message:
          "The AGENTseo API is unavailable. Check the local service and try again.",
      }),
    );
  });

  it("rejects a successful session response that omits its CSRF token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ expiresAt: "2026-07-16T00:00:00Z" })),
    );
    const { apiRequest } = await loadClient();

    await expect(apiRequest("/sites")).rejects.toEqual(
      expect.objectContaining({
        status: 502,
        code: "invalid_session_response",
      }),
    );
  });

  it("downloads an authenticated project bundle with CSRF and the vendor media type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrf: "csrf-export" }))
      .mockResolvedValueOnce(
        new Response('{"version":2}', {
          status: 200,
          headers: { "content-type": "application/vnd.agentseo.project+json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { apiDownload } = await loadClient();

    const bundle = await apiDownload("/export", {
      method: "POST",
      body: JSON.stringify({ projectId: "project-1" }),
    });

    expect(bundle.size).toBeGreaterThan(0);
    expect(bundle.type).toBe("application/vnd.agentseo.project+json");
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/vnd.agentseo.project+json");
    expect(headers.get("X-AGENTseo-CSRF")).toBe("csrf-export");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});

describe("withQuery", () => {
  it("encodes non-empty query values", async () => {
    const { withQuery } = await loadClient();
    expect(
      withQuery("/pages", { siteId: "site & one", cursor: undefined }),
    ).toBe("/pages?siteId=site+%26+one");
  });
});
