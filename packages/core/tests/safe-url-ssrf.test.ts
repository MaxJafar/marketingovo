import { describe, expect, it } from "vitest";
import {
  normalizeUrl,
  resolveSafeEgressTarget,
  UnsafeUrlError,
} from "../src/core/safe-url.js";

// A crawler fetches URLs it was given and URLs it discovered, so it is a natural
// SSRF vehicle. This corpus is the list of shapes that have worked against real
// crawlers; it exists so a refactor cannot quietly reopen one.
//
// The architecture that makes most of these safe is resolve-then-check: the
// address actually dialled is validated after DNS, not the string. That covers
// the numeric-shorthand family for free, because the resolver expands it.

describe("normalizeUrl rejects unsafe URL shapes before any lookup", () => {
  it("refuses non-HTTP schemes", () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://example.com/",
      "ftp://example.com/",
      "data:text/html,<script>",
    ]) {
      expect(() => normalizeUrl(url)).toThrow(UnsafeUrlError);
    }
  });

  it("refuses credentials embedded in the URL", () => {
    // These would be sent to whatever the host resolves to and would then
    // persist in stored evidence, reports and logs.
    for (const url of [
      "https://user:pass@example.com/",
      "https://user@example.com/",
      "http://:secret@example.com/",
    ]) {
      expect(() => normalizeUrl(url)).toThrow(/credentials must not travel/u);
    }
  });

  it("refuses well-known non-HTTP service ports", () => {
    for (const [port, service] of [
      ["22", "ssh"],
      ["25", "smtp"],
      ["3306", "mysql"],
      ["5432", "postgres"],
      ["6379", "redis"],
      ["9200", "elasticsearch"],
      ["11211", "memcached"],
      ["27017", "mongodb"],
    ] as const) {
      expect(
        () => normalizeUrl(`http://example.com:${port}/`),
        `${service} on ${port} must be refused`,
      ).toThrow(/well-known non-HTTP service/u);
    }
  });

  it("still accepts ordinary sites on non-default HTTP ports", () => {
    // A blocklist rather than an allowlist: refusing everything but 80/443
    // would break legitimate sites while adding nothing, because internal
    // targets are already blocked by address.
    for (const url of [
      "https://example.com/",
      "http://example.com:8080/rss",
      "http://example.com:3000/feed.xml",
      "https://sub.domain.example.com/blog/atom.xml",
    ]) {
      expect(() => normalizeUrl(url)).not.toThrow();
    }
  });
});

describe("resolveSafeEgressTarget blocks internal targets after DNS", () => {
  const blocked: Array<[string, string]> = [
    ["loopback literal", "http://127.0.0.1:3210/"],
    // The shorthand family is expanded by the resolver, so checking the
    // resolved address covers forms a string check would miss.
    ["loopback shorthand", "http://127.1/"],
    ["loopback as integer", "http://2130706433/"],
    ["loopback in hex", "http://0x7f.0.0.1/"],
    ["loopback in octal", "http://0177.0.0.1/"],
    ["localhost by name", "http://localhost/admin"],
    ["ipv6 loopback", "http://[::1]/"],
    ["aws metadata", "http://169.254.169.254/latest/meta-data/"],
    ["metadata as integer", "http://2852039166/"],
    ["rfc1918 ten", "http://10.0.0.5/"],
    ["rfc1918 192", "http://192.168.1.1/"],
    ["link local", "http://169.254.10.1/"],
    ["unspecified", "http://0.0.0.0/"],
  ];

  for (const [name, url] of blocked) {
    it(`refuses ${name}`, async () => {
      await expect(resolveSafeEgressTarget(url)).rejects.toThrow();
    });
  }
});
