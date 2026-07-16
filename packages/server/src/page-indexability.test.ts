import { describe, expect, it } from "vitest";
import {
  dashboardPageIndexability,
  storedIndexabilityReason,
} from "./page-indexability.js";

describe("stored page indexability mapping", () => {
  it.each([
    [true, "indexable", "indexable"],
    [false, "robots_blocked", "blocked"],
    [false, "meta_noindex", "noindex"],
    [false, "x_robots_noindex", "noindex"],
    [false, "canonicalized", "canonicalized"],
    [null, "robots_unknown", "unknown"],
  ] as const)("maps %s / %s to %s", (value, reason, expected) => {
    expect(dashboardPageIndexability(value, reason)).toBe(expected);
  });

  it("keeps legacy false rows blocked and unknown rows unknown", () => {
    expect(dashboardPageIndexability(false, null)).toBe("blocked");
    expect(dashboardPageIndexability(null, null)).toBe("unknown");
  });

  it("reads only a non-empty string reason from the JSON payload", () => {
    expect(storedIndexabilityReason({ indexabilityReason: "redirect" })).toBe(
      "redirect",
    );
    expect(storedIndexabilityReason({ indexabilityReason: 42 })).toBeNull();
    expect(storedIndexabilityReason({ indexabilityReason: "" })).toBeNull();
  });
});
