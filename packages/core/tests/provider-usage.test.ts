import { describe, expect, it } from "vitest";
import {
  extractDataForSeoCost,
  providerUsage,
} from "../src/integrations/provider-usage.js";

describe("provider usage accounting", () => {
  it("sums only finite non-negative DataForSEO task costs", () => {
    expect(
      extractDataForSeoCost({
        tasks: [
          { cost: 0.001 },
          { cost: 0.0025 },
          { cost: -1 },
          { cost: Number.NaN },
          { result: [] },
        ],
      }),
    ).toBeCloseTo(0.0035, 8);
  });

  it("keeps an unreported billable cost unavailable instead of faking zero", () => {
    expect(providerUsage("billable", true)).toEqual({
      requestMade: true,
      billable: true,
      actualCostUsd: null,
      costSource: "not-reported",
    });
  });

  it("marks a completed keyless source as known-free", () => {
    expect(providerUsage("free", true)).toEqual({
      requestMade: true,
      billable: false,
      actualCostUsd: 0,
      costSource: "free",
    });
  });
});
