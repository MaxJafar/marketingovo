import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadCrawlConfig,
  buildAuthHeader,
  buildCookieHeader,
  buildUserAgent,
} from "../src/core/config.js";

describe("loadCrawlConfig (env)", () => {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    "SCREAMINGCLAW_FOLLOW_NOFOLLOW",
    "SCREAMINGCLAW_FOLLOW_EXTERNAL",
    "SCREAMINGCLAW_MAX_DEPTH",
    "SCREAMINGCLAW_BASIC_AUTH",
    "SCREAMINGCLAW_COOKIES",
    "SCREAMINGCLAW_UA_SUFFIX",
    "SCREAMINGCLAW_CONFIG",
  ];
  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns safe defaults", () => {
    const c = loadCrawlConfig();
    expect(c.followNofollow).toBe(false);
    expect(c.followExternal).toBe(false);
    expect(c.maxDepth).toBe(0);
    expect(c.basicAuth).toBeNull();
    expect(c.cookies).toEqual([]);
    expect(c.userAgentSuffix).toBe("");
  });

  it("parses env knobs", () => {
    process.env.SCREAMINGCLAW_FOLLOW_NOFOLLOW = "1";
    process.env.SCREAMINGCLAW_FOLLOW_EXTERNAL = "1";
    process.env.SCREAMINGCLAW_MAX_DEPTH = "5";
    process.env.SCREAMINGCLAW_BASIC_AUTH = "user:pass";
    process.env.SCREAMINGCLAW_COOKIES = "a=1; b=2";
    process.env.SCREAMINGCLAW_UA_SUFFIX = " (+contact@example.com)";
    const c = loadCrawlConfig();
    expect(c.followNofollow).toBe(true);
    expect(c.followExternal).toBe(true);
    expect(c.maxDepth).toBe(5);
    expect(c.basicAuth).toEqual({ username: "user", password: "pass" });
    expect(c.cookies).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "2" },
    ]);
    expect(c.userAgentSuffix).toBe(" (+contact@example.com)");
  });

  it("clamps maxDepth to a hard cap", () => {
    process.env.SCREAMINGCLAW_MAX_DEPTH = "9999";
    expect(loadCrawlConfig().maxDepth).toBe(50);
  });

  it("ignores malformed basic auth", () => {
    process.env.SCREAMINGCLAW_BASIC_AUTH = "nocolon";
    expect(loadCrawlConfig().basicAuth).toBeNull();
  });

  it("loads from JSON file when SCREAMINGCLAW_CONFIG is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "sc-cfg-"));
    const path = join(dir, "c.json");
    writeFileSync(
      path,
      JSON.stringify({
        followNofollow: true,
        maxDepth: 7,
        basicAuth: { username: "u", password: "p" },
        cookies: [{ name: "session", value: "abc" }],
        userAgentSuffix: " (+x@y)",
      }),
    );
    process.env.SCREAMINGCLAW_CONFIG = path;
    const c = loadCrawlConfig();
    expect(c.followNofollow).toBe(true);
    expect(c.maxDepth).toBe(7);
    expect(c.basicAuth).toEqual({ username: "u", password: "p" });
    expect(c.cookies).toEqual([{ name: "session", value: "abc" }]);
    expect(c.userAgentSuffix).toBe(" (+x@y)");
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects invalid JSON config", () => {
    const dir = mkdtempSync(join(tmpdir(), "sc-cfg-"));
    const path = join(dir, "c.json");
    writeFileSync(path, "not json");
    process.env.SCREAMINGCLAW_CONFIG = path;
    expect(() => loadCrawlConfig()).toThrow(/invalid JSON/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("buildAuthHeader", () => {
  it("returns null when no auth", () => {
    expect(buildAuthHeader(null)).toBeNull();
  });
  it("base64-encodes user:pass", () => {
    const h = buildAuthHeader({ username: "alice", password: "p@ss" });
    expect(h).toBe(`Basic ${Buffer.from("alice:p@ss").toString("base64")}`);
  });
});

describe("buildCookieHeader", () => {
  it("skips cookies whose domain does not match", () => {
    const h = buildCookieHeader(
      [
        { name: "a", value: "1", domain: "example.com" },
        { name: "b", value: "2", domain: "other.com" },
        { name: "c", value: "3" },
      ],
      "example.com",
    );
    expect(h).toBe("a=1; c=3");
  });
});

describe("buildUserAgent", () => {
  it("appends suffix with a single space", () => {
    expect(buildUserAgent("ScreamingClaw/0.2", "(+x)")).toBe(
      "ScreamingClaw/0.2 (+x)",
    );
  });
  it("does not double-space when suffix starts with space", () => {
    expect(buildUserAgent("ScreamingClaw/0.2", " (+x)")).toBe(
      "ScreamingClaw/0.2 (+x)",
    );
  });
  it("returns base when suffix is empty", () => {
    expect(buildUserAgent("ScreamingClaw/0.2", "")).toBe("ScreamingClaw/0.2");
  });
});
