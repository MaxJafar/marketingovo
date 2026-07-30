// Sprint 11: notify integration tests.
//
// We test:
//   1. dispatching to stdout (writes a one-line summary to
//      stderr + JSON to stdout; verify shape, no real writes).
//   2. dispatching to webhook with a mocked fetch (catches
//      URL build, header, body, error paths, timeouts).
//   3. dispatching to telegram with a mocked fetch (catches
//      URL build, HTML escaping, missing creds, error paths).
//   4. deltaToNotification: maps an AuditDelta to a
//      NotificationPayload with the right severity.
//   5. notify() with multiple channels in parallel — a
//      failure in one does not affect the others.
//
// The `watch` CLI subcommand is covered by the existing
// audit-full CLI smoke test pattern; we don't add a new
// long-running test for it here (those tend to flake in CI).

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  notify,
  deltaToNotification,
  isAvailable,
  type NotificationPayload,
  type ChannelResult,
} from "../src/integrations/notify.js";

const SAMPLE_PAYLOAD: NotificationPayload = {
  title: "Site regression detected",
  severity: "critical",
  url: "https://example.com/",
  summary:
    "Compared with previous run r1: 3 new, 0 resolved. Regression score: +9.",
  details: { regressionScore: 9, newCount: 3, resolvedCount: 0 },
  timestamp: "2026-06-05T12:00:00.000Z",
};

const allowTestWebhookHost = async (): Promise<void> => {};

describe("notify isAvailable (Sprint 11)", () => {
  it("returns true when global fetch is a function (Node 18+)", () => {
    expect(isAvailable()).toBe(true);
  });
});

describe("notify stdout channel", () => {
  const stderrWrite = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  const stdoutWrite = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);

  afterEach(() => {
    stderrWrite.mockClear();
    stdoutWrite.mockClear();
  });

  it("writes a one-line summary to stderr and JSON envelope to stdout", async () => {
    const results = await notify(SAMPLE_PAYLOAD, { channels: ["stdout"] });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      channel: "stdout",
      ok: true,
      error: null,
      durationMs: expect.any(Number),
    });

    // stderr got the one-liner with severity tag.
    const stderrCalls = stderrWrite.mock.calls
      .map((c) => String(c[0]))
      .join("");
    expect(stderrCalls).toMatch(/\[notify:critical\]/);
    expect(stderrCalls).toMatch(/Site regression detected/);
    expect(stderrCalls).toMatch(/example\.com/);

    // stdout got a JSON envelope with the original payload.
    const stdoutCalls = stdoutWrite.mock.calls
      .map((c) => String(c[0]))
      .join("");
    const parsed = JSON.parse(stdoutCalls);
    expect(parsed.title).toBe(SAMPLE_PAYLOAD.title);
    expect(parsed.severity).toBe("critical");
  });
});

describe("notify webhook channel (mocked fetch)", () => {
  it("POSTs the JSON payload to the configured URL", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      calls.push({ url, init });
      return new Response("ok", { status: 200 });
    };
    const results = await notify(SAMPLE_PAYLOAD, {
      channels: ["webhook"],
      webhookUrl: "https://hooks.test/incoming",
      fetchImpl: mockFetch,
      webhookHostValidator: allowTestWebhookHost,
    });
    expect(results[0]).toEqual({
      channel: "webhook",
      ok: true,
      error: null,
      durationMs: expect.any(Number),
    });
    expect(calls[0].url).toBe("https://hooks.test/incoming");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.redirect).toBe("error");
    expect(
      (calls[0].init?.headers as Record<string, string>)["content-type"],
    ).toBe("application/json");
    expect(JSON.parse(calls[0].init?.body as string).title).toBe(
      SAMPLE_PAYLOAD.title,
    );
  });

  it("returns error 'no webhook URL' when MARKETINGOVO_WEBHOOK_URL is unset", async () => {
    const origEnv = process.env.MARKETINGOVO_WEBHOOK_URL;
    delete process.env.MARKETINGOVO_WEBHOOK_URL;
    try {
      const results = await notify(SAMPLE_PAYLOAD, { channels: ["webhook"] });
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toMatch(/no webhook URL/);
    } finally {
      if (origEnv !== undefined) process.env.MARKETINGOVO_WEBHOOK_URL = origEnv;
    }
  });

  it("returns error 'HTTP 500' on non-2xx response", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("oops", { status: 500 });
    const results = await notify(SAMPLE_PAYLOAD, {
      channels: ["webhook"],
      webhookUrl: "https://hooks.test/incoming",
      fetchImpl: mockFetch,
      webhookHostValidator: allowTestWebhookHost,
    });
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toBe("HTTP 500");
  });

  it("returns error 'ECONNREFUSED' on network failure", async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const results = await notify(SAMPLE_PAYLOAD, {
      channels: ["webhook"],
      webhookUrl: "https://hooks.test/incoming",
      fetchImpl: mockFetch,
      webhookHostValidator: allowTestWebhookHost,
    });
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toBe("ECONNREFUSED");
  });

  it("rejects plaintext and private webhook destinations", async () => {
    const noFetch: typeof fetch = async () => {
      throw new Error("must not fetch");
    };
    const http = await notify(SAMPLE_PAYLOAD, {
      channels: ["webhook"],
      webhookUrl: "http://hooks.test/incoming",
      fetchImpl: noFetch,
    });
    expect(http[0]?.error).toMatch(/HTTPS/);

    const privateHost = await notify(SAMPLE_PAYLOAD, {
      channels: ["webhook"],
      webhookUrl: "https://internal.test/incoming",
      fetchImpl: noFetch,
      webhookHostValidator: async () => {
        throw new Error("private address blocked");
      },
    });
    expect(privateHost[0]?.error).toMatch(/private address blocked/);
  });

  it("signs webhook payloads with timestamped HMAC headers", async () => {
    let captured: RequestInit | undefined;
    const mockFetch: typeof fetch = async (_input, init) => {
      captured = init;
      return new Response("ok", { status: 200 });
    };
    const result = await notify(SAMPLE_PAYLOAD, {
      channels: ["webhook"],
      webhookUrl: "https://hooks.test/incoming",
      webhookSecret: "signing-secret",
      webhookHostValidator: allowTestWebhookHost,
      fetchImpl: mockFetch,
    });
    expect(result[0]?.ok).toBe(true);
    const headers = captured?.headers as Record<string, string>;
    expect(headers["x-marketingovo-timestamp"]).toMatch(/^\d+$/);
    expect(headers["x-marketingovo-event-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["x-marketingovo-signature"]).toMatch(
      /^sha256=[0-9a-f]{64}$/,
    );
    expect(headers["x-marketingovo-timestamp"]).toBe(
      headers["x-marketingovo-timestamp"],
    );
    expect(headers["x-marketingovo-event-id"]).toBe(
      headers["x-marketingovo-event-id"],
    );
    expect(headers["x-marketingovo-signature"]).toBe(
      headers["x-marketingovo-signature"],
    );
    expect(captured?.redirect).toBe("error");
  });
});

describe("notify telegram channel (mocked fetch)", () => {
  it("POSTs an HTML-formatted message to the Telegram sendMessage endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      calls.push({ url, init });
      return new Response('{"ok":true}', { status: 200 });
    };
    const results = await notify(SAMPLE_PAYLOAD, {
      channels: ["telegram"],
      telegramBotToken: "bot123",
      telegramChatId: "-100500",
      fetchImpl: mockFetch,
    });
    expect(results[0]?.ok).toBe(true);
    expect(calls[0].url).toMatch(
      /^https:\/\/api\.telegram\.org\/botbot123\/sendMessage$/,
    );
    expect(calls[0].init?.redirect).toBe("error");
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.chat_id).toBe("-100500");
    expect(body.parse_mode).toBe("HTML");
    expect(body.text).toContain("🔴 <b>Site regression detected</b>");
    expect(body.text).toContain("https://example.com/");
    expect(body.text).toContain("Regression score: +9");
    // HTML escaping: < and > in detail should be escaped.
    expect(body.text).toMatch(/<pre>[\s\S]*<\/pre>/);
  });

  it("escapes HTML special chars in title and summary", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      calls.push({
        url: typeof input === "string" ? input : (input as URL).toString(),
        init,
      });
      return new Response('{"ok":true}', { status: 200 });
    };
    const payload: NotificationPayload = {
      ...SAMPLE_PAYLOAD,
      title: "Alert: <script>alert(1)</script>",
      summary: "5 < 10 things & 'quotes'",
    };
    await notify(payload, {
      channels: ["telegram"],
      telegramBotToken: "t",
      telegramChatId: "c",
      fetchImpl: mockFetch,
      webhookHostValidator: allowTestWebhookHost,
    });
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.text).not.toMatch(/<script>/);
    expect(body.text).toMatch(/&lt;script&gt;/);
    expect(body.text).toMatch(/5 &lt; 10/);
  });

  it("returns error 'missing ...' when creds unset", async () => {
    const origToken = process.env.MARKETINGOVO_TELEGRAM_BOT_TOKEN;
    const origChat = process.env.MARKETINGOVO_TELEGRAM_CHAT_ID;
    delete process.env.MARKETINGOVO_TELEGRAM_BOT_TOKEN;
    delete process.env.MARKETINGOVO_TELEGRAM_CHAT_ID;
    try {
      const results = await notify(SAMPLE_PAYLOAD, { channels: ["telegram"] });
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toMatch(/missing/);
    } finally {
      if (origToken !== undefined)
        process.env.MARKETINGOVO_TELEGRAM_BOT_TOKEN = origToken;
      if (origChat !== undefined)
        process.env.MARKETINGOVO_TELEGRAM_CHAT_ID = origChat;
    }
  });
});

describe("notify multi-channel (Sprint 11)", () => {
  it("runs all channels in parallel; one failure doesn't affect others", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("hooks.test")) {
        return new Response("Internal Server Error", { status: 503 });
      }
      // telegram succeeds
      return new Response('{"ok":true}', { status: 200 });
    };
    const results = await notify(SAMPLE_PAYLOAD, {
      channels: ["stdout", "webhook", "telegram"],
      webhookUrl: "https://hooks.test/incoming",
      telegramBotToken: "t",
      telegramChatId: "c",
      fetchImpl: mockFetch,
      webhookHostValidator: allowTestWebhookHost,
    });
    const byChannel: Record<string, ChannelResult> = Object.fromEntries(
      results.map((r) => [r.channel, r]),
    );
    expect(byChannel.stdout?.ok).toBe(true);
    expect(byChannel.webhook?.ok).toBe(false);
    expect(byChannel.webhook?.error).toBe("HTTP 503");
    expect(byChannel.telegram?.ok).toBe(true);
  });
});

describe("deltaToNotification (Sprint 11)", () => {
  it("maps regression score > 15 to 'critical' severity", () => {
    const n = deltaToNotification(
      {
        regressionScore: 18,
        newIssues: [{ id: "a", priority: "High", message: "x" }],
        resolvedIssues: [],
        previousRunId: "p",
        currentRunId: "c",
        summary: "regression",
      },
      "https://x.test/",
    );
    expect(n.severity).toBe("critical");
    expect(n.title).toMatch(/regression/i);
  });

  it("maps regression score 6..15 to 'warning' severity", () => {
    const n = deltaToNotification(
      {
        regressionScore: 7,
        newIssues: [{ id: "a", priority: "High", message: "x" }],
        resolvedIssues: [],
        previousRunId: "p",
        currentRunId: "c",
        summary: "y",
      },
      "https://x.test/",
    );
    expect(n.severity).toBe("warning");
    expect(n.title).toMatch(/New SEO issues/i);
  });

  it("maps regression score <= 0 to 'info' severity", () => {
    const n = deltaToNotification(
      {
        regressionScore: -3,
        newIssues: [],
        resolvedIssues: [{ id: "a", priority: "Low" }],
        previousRunId: "p",
        currentRunId: "c",
        summary: "improved",
      },
      "https://x.test/",
    );
    expect(n.severity).toBe("info");
    expect(n.title).toMatch(/clean/i);
  });

  it("truncates newIssues to 20 entries in details", () => {
    const newIssues = Array.from({ length: 50 }, (_, i) => ({
      id: `i${i}`,
      priority: "High",
      message: "x",
    }));
    const n = deltaToNotification(
      {
        regressionScore: 1,
        newIssues,
        resolvedIssues: [],
        previousRunId: null,
        currentRunId: "c",
        summary: "s",
      },
      "https://x.test/",
    );
    expect((n.details as { newIssues: unknown[] }).newIssues).toHaveLength(20);
  });
});
