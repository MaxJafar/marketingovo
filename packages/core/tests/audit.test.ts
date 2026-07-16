import { describe, it, expect, vi } from "vitest";
import { AuditLog, redactSecrets } from "../src/core/audit.js";
import { ConsoleLogger } from "../src/core/logger.js";
import { Writable } from "node:stream";

function makeBuffer(): { stream: Writable; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { stream, lines };
}

describe("AuditLog", () => {
  it("emits one JSON line per event", () => {
    const { stream, lines } = makeBuffer();
    const log = new AuditLog("run-test", stream);
    log.info("crawl_start", { url: "https://example.com" });
    log.warn("rate_limited", { host: "example.com" });
    log.error("fetch_failed", { url: "https://example.com/x", status: 500 });
    expect(lines.length).toBe(3);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.runId).toBe("run-test");
      expect(parsed.ts).toMatch(/T/);
    }
  });

  it("redacts obvious secrets", () => {
    const { stream, lines } = makeBuffer();
    const log = new AuditLog("run-test", stream);
    log.info("headers", {
      authorization: "Bearer abc",
      Cookie: "session=1",
      "X-API-Key": "k",
      url: "https://example.com",
    });
    const parsed = JSON.parse(lines[0]!);
    const data = parsed.data as Record<string, unknown>;
    expect(data.authorization).toBe("[REDACTED]");
    expect(data.Cookie).toBe("[REDACTED]");
    expect(data["X-API-Key"]).toBe("[REDACTED]");
    expect(data.url).toBe("https://example.com");
  });

  it("recursively redacts camelCase secrets and credentials embedded in URLs", () => {
    const { stream, lines } = makeBuffer();
    const log = new AuditLog("run-test", stream);
    log.info("nested", {
      clientSecret: "client-secret",
      nested: {
        accessToken: "access-token",
        headers: [{ refresh_token: "refresh-token" }],
      },
      url: "https://api.example.test/path?api_key=secret&safe=1",
      error: "request failed with Bearer abc.def",
    });
    const data = JSON.parse(lines[0]!).data;
    expect(data.clientSecret).toBe("[REDACTED]");
    expect(data.nested.accessToken).toBe("[REDACTED]");
    expect(data.nested.headers[0].refresh_token).toBe("[REDACTED]");
    expect(data.url).toContain("api_key=[REDACTED]");
    expect(data.error).toBe("request failed with Bearer [REDACTED]");
  });

  it("redacts exact run credentials even when a provider echoes them without a label", () => {
    const secret = "provider-canary-z9Y8x7W6";
    const shared = { message: `provider echoed ${secret}` };
    const redacted = redactSecrets(
      {
        first: shared,
        second: shared,
        assignment: `apiKey=${secret}`,
      },
      { exactValues: [secret] },
    ) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).not.toContain(secret);
    expect(redacted.first).toEqual({ message: "provider echoed [REDACTED]" });
    expect(redacted.second).toEqual(redacted.first);
    expect(redacted.assignment).toBe("apiKey=[REDACTED]");
  });

  it("applies the same redaction to ConsoleLogger context", () => {
    const output = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      new ConsoleLogger().info("request failed apiKey=message-secret", {
        telegramBotToken: "bot-secret",
        nested: { password: "password-secret" },
      });
      const line = output.mock.calls.map((call) => String(call[0])).join("\n");
      expect(line).not.toContain("bot-secret");
      expect(line).not.toContain("password-secret");
      expect(line).not.toContain("message-secret");
      expect(line).toContain("[REDACTED]");
    } finally {
      output.mockRestore();
    }
  });

  it("works with no stream", () => {
    const log = new AuditLog("run-test", null);
    expect(() => log.info("x")).not.toThrow();
  });
});
