import { describe, expect, it } from "vitest";
import {
  canonicalizeIssueUrl,
  issueFingerprint,
  issueToInstances,
  scorePriorityV1,
} from "../src/core/entities.js";

describe("canonical issue entities", () => {
  it("uses module + rule + canonical URL as the stable fingerprint", () => {
    const canonical = canonicalizeIssueUrl(
      "HTTPS://Example.COM:443/path#section",
    );
    expect(canonical).toBe("https://example.com/path");
    expect(issueFingerprint("onpage", "title-missing", canonical)).toBe(
      issueFingerprint("onpage", "title-missing", "https://example.com/path"),
    );
    expect(issueFingerprint("technical", "title-missing", canonical)).not.toBe(
      issueFingerprint("onpage", "title-missing", canonical),
    );
  });

  it("creates one canonical IssueInstance per affected URL", () => {
    const instances = issueToInstances(
      {
        id: "title-missing",
        category: "On-page",
        priority: "High",
        message: "Title is missing",
        urls: ["https://example.com/a#x", "https://example.com/b"],
      },
      "onpage",
      "2026-07-15T00:00:00.000Z",
    );
    expect(instances).toHaveLength(2);
    expect(instances[0]).toMatchObject({
      ruleId: "title-missing",
      moduleId: "onpage",
      canonicalUrl: "https://example.com/a",
      severity: "high",
      status: "open",
    });
  });
});

describe("priority-v1", () => {
  it("implements the public formula exactly", () => {
    expect(
      scorePriorityV1({
        severity: 1,
        organicExposure: 0.8,
        conversionExposure: 0.6,
        urlReach: 0.4,
        confidence: 0.9,
        effort: "medium",
      }),
    ).toBe(59.25);
  });

  it("rejects out-of-range and fake missing values", () => {
    expect(() =>
      scorePriorityV1({
        severity: 1,
        organicExposure: Number.NaN,
        conversionExposure: 0,
        urlReach: 0,
        confidence: 1,
        effort: "low",
      }),
    ).toThrow(/organicExposure/);
  });
});
