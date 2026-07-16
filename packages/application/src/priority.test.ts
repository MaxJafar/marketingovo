import { describe, expect, it } from "vitest";
import { priorityScoreV1FromInputs, scorePriorityV1 } from "./priority.js";

describe("priority-v1", () => {
  it("matches the published formula when all sources are present", () => {
    const result = scorePriorityV1({
      severity: 1,
      organicExposure: 0.8,
      conversionExposure: 0.6,
      urlReach: 0.5,
      confidence: 0.9,
      effort: "low",
    });
    expect(result.priorityScore).toBe(80.5);
    expect(result.scoreInputs.unavailable).toEqual([]);
  });

  it("does not turn missing integration data into a fake zero", () => {
    const result = scorePriorityV1({
      severity: "high",
      organicExposure: null,
      conversionExposure: null,
      urlReach: 0.4,
      confidence: 0.9,
      effort: "medium",
    });
    expect(result.scoreInputs.organicExposure).toBeNull();
    expect(result.scoreInputs.conversionExposure).toBeNull();
    expect(result.scoreInputs.unavailable).toEqual([
      "organic_exposure",
      "conversion_exposure",
    ]);
    expect(result.scoreInputs.confidence).toBeLessThan(0.9);
    expect(result.priorityScore).toBeGreaterThan(0);
  });

  it("re-scores a reviewed action scope without penalizing confidence twice", () => {
    const original = scorePriorityV1({
      severity: "high",
      organicExposure: null,
      conversionExposure: null,
      urlReach: 0.8,
      confidence: 0.9,
      effort: "medium",
    });
    const narrowedInputs = { ...original.scoreInputs, urlReach: 0.4 };

    expect(priorityScoreV1FromInputs(original.scoreInputs, "medium")).toBe(
      original.priorityScore,
    );
    expect(priorityScoreV1FromInputs(narrowedInputs, "medium")).toBeLessThan(
      original.priorityScore,
    );
    expect(narrowedInputs.confidence).toBe(original.scoreInputs.confidence);
  });
});
