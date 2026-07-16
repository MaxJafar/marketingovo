import { describe, expect, it } from "vitest";
import {
  calculateControlAdjustedOutcome,
  selectMatchedControlCohort,
  technicalVerificationVerdict,
} from "./flight-recorder.js";

describe("Impact Flight Recorder", () => {
  it("selects deterministic same-template controls without reusing pages", () => {
    const result = selectMatchedControlCohort(
      ["https://example.com/products/a", "https://example.com/products/b"],
      [
        {
          url: "https://example.com/products/a",
          clicks: 100,
          impressions: 900,
        },
        { url: "https://example.com/products/b", clicks: 50, impressions: 500 },
        { url: "https://example.com/products/c", clicks: 90, impressions: 850 },
        { url: "https://example.com/products/d", clicks: 55, impressions: 520 },
        { url: "https://example.com/blog/post", clicks: 95, impressions: 870 },
      ],
    );

    expect(result.coverage).toBe(1);
    expect(result.matches).toEqual([
      expect.objectContaining({
        targetUrl: "https://example.com/products/a",
        controlUrl: "https://example.com/products/c",
        templateMatched: true,
      }),
      expect.objectContaining({
        targetUrl: "https://example.com/products/b",
        controlUrl: "https://example.com/products/d",
        templateMatched: true,
      }),
    ]);
  });

  it("keeps incomplete technical checks inconclusive", () => {
    const result = technicalVerificationVerdict({
      targetUrls: ["https://example.com/a", "https://example.com/b"],
      crawledUrls: ["https://example.com/a"],
      issues: [],
      ruleId: "canonical-missing",
      moduleId: "technical",
    });
    expect(result).toMatchObject({ state: "inconclusive", coverage: 0.5 });
  });

  it("separates a regressed issue from a technically verified cohort", () => {
    const base = {
      targetUrls: ["https://example.com/a"],
      crawledUrls: ["https://example.com/a"],
      ruleId: "canonical-missing",
      moduleId: "technical",
    };
    expect(technicalVerificationVerdict({ ...base, issues: [] }).state).toBe(
      "verified",
    );
    expect(
      technicalVerificationVerdict({
        ...base,
        issues: [
          {
            fingerprint: "1234567890abcdef",
            ruleId: "canonical-missing",
            moduleId: "technical",
            canonicalUrl: "https://example.com/a",
            severity: "high",
            title: "Canonical missing",
            description: "Add a canonical URL.",
            evidence: [],
            firstSeenAt: "2026-07-01T00:00:00.000Z",
            lastSeenAt: "2026-07-15T00:00:00.000Z",
            status: "open",
          },
        ],
      }).state,
    ).toBe("regressed");
  });

  it("calculates observed change relative to a matched control", () => {
    const outcome = calculateControlAdjustedOutcome({
      targetPre: 100,
      targetPost: 120,
      controlPre: 200,
      controlPost: 210,
      targetCoverage: 1,
      controlCoverage: 1,
    });
    expect(outcome.state).toBe("observed");
    expect(outcome.targetChange).toBeCloseTo(0.2);
    expect(outcome.controlChange).toBeCloseTo(0.05);
    expect(outcome.controlAdjustedChange).toBeCloseTo(0.15);
    expect(outcome.limitations[0]).toContain("not proof of causality");
  });

  it("never turns missing or weak cohort data into a zero outcome", () => {
    expect(
      calculateControlAdjustedOutcome({
        targetPre: null,
        targetPost: 10,
        controlPre: 5,
        controlPost: 6,
        targetCoverage: 1,
        controlCoverage: 1,
      }),
    ).toMatchObject({
      state: "inconclusive",
      controlAdjustedChange: null,
      confidence: null,
    });
    expect(
      calculateControlAdjustedOutcome({
        targetPre: 10,
        targetPost: 12,
        controlPre: 10,
        controlPost: 11,
        targetCoverage: 0.5,
        controlCoverage: 1,
      }).state,
    ).toBe("inconclusive");
  });
});
