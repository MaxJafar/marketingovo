import { describe, expect, it } from "vitest";
import { parseExactAuditUrls } from "../pages/audits";
import { exactUrlHostname } from "../lib/url";

describe("exact audit URL scope", () => {
  it("normalizes fragments and removes duplicate entries", () => {
    expect(
      parseExactAuditUrls(
        "https://example.com/pricing#offer\nhttps://example.com/docs, https://example.com/pricing",
      ),
    ).toEqual(["https://example.com/pricing", "https://example.com/docs"]);
  });

  it("rejects empty, invalid, and non-http inputs", () => {
    expect(() => parseExactAuditUrls(" ")).toThrow("at least one");
    expect(() => parseExactAuditUrls("not-a-url")).toThrow("Invalid URL");
    expect(() => parseExactAuditUrls("file:///tmp/a")).toThrow(
      "Unsupported URL scheme",
    );
  });

  it("normalizes exact host approvals without widening their scope", () => {
    expect(exactUrlHostname("https://EXAMPLE.com./path")).toBe("example.com");
    expect(exactUrlHostname("http://[::1]:3210/")).toBe("::1");
    expect(exactUrlHostname("file:///tmp/site.html")).toBeNull();
    expect(exactUrlHostname("not-a-url")).toBeNull();
  });
});
