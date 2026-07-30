import { describe, expect, it, vi } from "vitest";
import {
  AgentIntelClient,
  bootstrapDashboardSession,
  importCitationPolicy,
  parseServerSentEvent,
} from "./client.js";
import type { ImportEvidenceEntry } from "./client.js";

describe("AgentIntelClient", () => {
  it("exposes complete inert imported evidence citations", () => {
    const evidence: ImportEvidenceEntry = {
      observation_id: "obs-1",
      entity_id: "northstar-labs",
      entity_name: "Northstar Labs",
      platform: "youtube",
      content_id: null,
      dimension: null,
      metric: "followers",
      metric_definition_version: "v1",
      numerator: null,
      denominator: null,
      value: 100,
      unit: "followers",
      published_at: null,
      observed_at: "2026-07-01T00:00:00Z",
      recorded_at: "2026-07-01T00:00:00Z",
      valid_from: "2026-07-01T00:00:00Z",
      valid_to: null,
      source_url: "https://example.invalid/northstar",
      native_id: "native-1",
      connector_version: "local.competitive-pulse-import@1.0.0",
      classification: "observed",
      confidence: 1,
      artifact_hash: "a".repeat(64),
      extraction_pointer: "obs-1",
      freshness_seconds: 0,
      availability: "available",
      coverage: 1,
      acquisition_mode: "user_import",
      data_class: "public",
      permitted_purpose: "competitive_research",
      retention_until: "2026-10-01T00:00:00Z",
      rights_state: "permitted",
    };
    expect(evidence.source_url).toBe("https://example.invalid/northstar");
    expect(evidence.native_id).toBe("native-1");
    expect(evidence.observed_at).toBe("2026-07-01T00:00:00Z");
    expect(importCitationPolicy).toEqual({
      version: "source-reference.v1",
      rendering: "escaped_inert_text",
      clickable: false,
      navigation: "forbidden",
    });
  });

  it("parses a typed SSE event", () => {
    expect(
      parseServerSentEvent(
        'id: 1\nevent: progress\ndata: {"id":"evt","run_id":"run","sequence":1,"stage":"collect","level":"info","message":"ok","progress":0.2,"recorded_at":"2026-01-01T00:00:00Z"}',
      ),
    ).toMatchObject({ run_id: "run", sequence: 1, progress: 0.2 });
  });

  it("sends the bearer token without exposing it in the URL", async () => {
    let request: Request | undefined;
    const client = new AgentIntelClient({
      token: "local-secret",
      fetch: async (input, init) => {
        request = new Request(input, init);
        return new Response(
          JSON.stringify({
            status: "ok",
            version: "test",
            database: "available",
            worker: "available",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    await client.health();
    expect(request?.headers.get("authorization")).toBe("Bearer local-secret");
    expect(request?.url).not.toContain("local-secret");
    expect(request?.redirect).toBe("error");
  });

  it("exchanges a one-time ticket without persisting or authorizing it", async () => {
    let request: Request | undefined;
    const session = await bootstrapDashboardSession("a".repeat(43), {
      baseUrl: "http://127.0.0.1:7465",
      fetch: async (input, init) => {
        request = new Request(input, init);
        return new Response(
          JSON.stringify({
            csrf: "csrf-token-with-sufficient-entropy-123456",
            expires_at: "2026-01-01T01:00:00Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    expect(session.csrf).toContain("csrf-token");
    expect(request?.credentials).toBe("same-origin");
    expect(request?.redirect).toBe("error");
    expect(request?.headers.has("authorization")).toBe(false);
    await expect(request?.json()).resolves.toEqual({ token: "a".repeat(43) });
  });

  it("uses session CSRF only on mutations", async () => {
    const requests: Request[] = [];
    const client = new AgentIntelClient({
      baseUrl: "http://127.0.0.1:7465",
      csrfToken: "session-csrf",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        const path = new URL(String(input)).pathname;
        return new Response(
          path.endsWith("/health")
            ? JSON.stringify({
                status: "ok",
                version: "test",
                database: "available",
                worker: "available",
              })
            : JSON.stringify({
                id: "run",
                project_id: "project",
                workflow: "compare",
                status: "queued",
                progress: 0,
                stage: "queued",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    await client.health();
    await client.comparisons.start({
      project_id: "project",
      target_ids: ["one", "two"],
      connector_ids: ["fixture.competitive-pulse"],
      simulate: "none",
    });
    expect(requests[0]?.headers.has("x-agentintel-csrf")).toBe(false);
    expect(requests[1]?.headers.get("x-agentintel-csrf")).toBe("session-csrf");
  });

  it.each([
    "https://127.0.0.1:7465",
    "http://localhost:7465",
    "http://evil.example:7465",
    "http://user:pass@127.0.0.1:7465",
    "http://127.0.0.1:7465/",
    "http://127.0.0.1:7465/v1",
    "http://127.0.0.1:7465?token=leak",
    "http://127.0.0.1:7465#fragment",
    "http://[::1]:7465",
    "http://127.0.0.1",
    "http://127.0.0.1:0",
    "http://127.0.0.1:65536",
  ])("rejects unsafe API origin %s before a token can be sent", (baseUrl) => {
    const fetcher = vi.fn<typeof globalThis.fetch>();
    expect(
      () =>
        new AgentIntelClient({
          baseUrl,
          token: "sensitive-service-token",
          fetch: fetcher,
        }),
    ).toThrow(/exact http:\/\/127\.0\.0\.1:<port> origin/u);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an unsafe session origin before starting the exchange", async () => {
    const fetcher = vi.fn<typeof globalThis.fetch>();
    await expect(
      bootstrapDashboardSession("a".repeat(43), {
        baseUrl: "http://attacker.invalid:7465",
        fetch: fetcher,
      }),
    ).rejects.toThrow(/exact http:\/\/127\.0\.0\.1:<port> origin/u);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reconnects an interrupted event stream from its last sequence", async () => {
    const requests: Request[] = [];
    let call = 0;
    const encoder = new TextEncoder();
    const client = new AgentIntelClient({
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        call += 1;
        if (call === 1) {
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    'id: 1\ndata: {"id":"evt-1","run_id":"run","sequence":1,"stage":"collect","level":"info","message":"one","progress":0.2,"recorded_at":"2026-01-01T00:00:00Z"}\n\n',
                  ),
                );
                setTimeout(
                  () => controller.error(new Error("connection reset")),
                  0,
                );
              },
            }),
            { status: 200 },
          );
        }
        return new Response(
          `id: 2\r\ndata: {"id":"evt-2","run_id":"run","sequence":2,"stage":"analyze","level":"info","message":"two","progress":0.8,"recorded_at":"2026-01-01T00:00:01Z"}\r\n\r\n`,
          { status: 200 },
        );
      },
    });
    const events = [];
    for await (const event of client.streamRunEvents("run", {
      reconnect: true,
      maxReconnects: 1,
      reconnectDelayMs: 0,
    })) {
      events.push(event);
    }
    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.has("last-event-id")).toBe(false);
    expect(requests[1]?.headers.get("last-event-id")).toBe("1");
  });

  it("cancels the reader when an event consumer stops early", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const client = new AgentIntelClient({
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'id: 1\ndata: {"id":"evt-1","run_id":"run","sequence":1,"stage":"collect","level":"info","message":"one","progress":0.2,"recorded_at":"2026-01-01T00:00:00Z"}\n\n',
                ),
              );
            },
            cancel() {
              cancelled = true;
            },
          }),
          { status: 200 },
        ),
    });

    for await (const _event of client.streamRunEvents("run")) break;

    expect(cancelled).toBe(true);
  });
});
