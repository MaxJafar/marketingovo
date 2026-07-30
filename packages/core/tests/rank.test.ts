import { describe, expect, it } from "vitest";
import {
  deriveRankMovement,
  summarizeRanks,
  type RankObservation,
} from "../src/core/rank.js";

function ranked(observedAt: string, position: number): RankObservation {
  return {
    observedAt,
    outcome: "ranked",
    position,
    rankingUrl: `https://example.com/p${position}`,
    resultsExamined: 100,
    provider: "serpapi",
  };
}

function absent(observedAt: string, depth = 100): RankObservation {
  return {
    observedAt,
    outcome: "absent",
    position: null,
    rankingUrl: null,
    resultsExamined: depth,
    provider: "serpapi",
  };
}

function unmeasured(observedAt: string, reason: string): RankObservation {
  return {
    observedAt,
    outcome: "unmeasured",
    position: null,
    rankingUrl: null,
    resultsExamined: null,
    provider: "serpapi",
    failureReason: reason,
  };
}

describe("rank movement", () => {
  it("expresses improvement as places gained, since a lower number is better", () => {
    const movement = deriveRankMovement([
      ranked("2026-07-01", 8),
      ranked("2026-07-08", 5),
    ])!;
    expect(movement.direction).toBe("improved");
    expect(movement.delta).toBe(3);
  });

  it("reports a decline with a negative delta", () => {
    const movement = deriveRankMovement([
      ranked("2026-07-01", 5),
      ranked("2026-07-08", 9),
    ])!;
    expect(movement.direction).toBe("declined");
    expect(movement.delta).toBe(-4);
  });

  it("orders by observation time, not by array order", () => {
    const movement = deriveRankMovement([
      ranked("2026-07-08", 5),
      ranked("2026-07-01", 8),
    ])!;
    expect(movement.direction).toBe("improved");
    expect(movement.current.observedAt).toBe("2026-07-08");
  });

  it("has no movement to report on a first check", () => {
    const movement = deriveRankMovement([ranked("2026-07-01", 4)])!;
    expect(movement.direction).toBe("first-observation");
    expect(movement.delta).toBeNull();
    expect(movement.previous).toBeNull();
  });

  // A provider outage is not a ranking loss. Reporting it as one is how a rank
  // chart manufactures a crisis.
  it("refuses to call a failed check a decline", () => {
    const movement = deriveRankMovement([
      ranked("2026-07-01", 4),
      unmeasured("2026-07-08", "provider timeout"),
    ])!;
    expect(movement.direction).toBe("indeterminate");
    expect(movement.delta).toBeNull();
    expect(movement.note).toMatch(/unknown rather than lost/i);
  });

  it("refuses to compare against a baseline that was never measured", () => {
    const movement = deriveRankMovement([
      unmeasured("2026-07-01", "no credential"),
      ranked("2026-07-08", 4),
    ])!;
    expect(movement.direction).toBe("indeterminate");
    expect(movement.delta).toBeNull();
  });

  // Entering and leaving the results are real events, but the *distance* is
  // not knowable, so no delta may be invented for them.
  it("reports entry without inventing the distance gained", () => {
    const movement = deriveRankMovement([
      absent("2026-07-01"),
      ranked("2026-07-08", 7),
    ])!;
    expect(movement.direction).toBe("entered");
    expect(movement.delta).toBeNull();
    expect(movement.note).toMatch(/size of the gain is unknown/i);
  });

  it("reports loss without inventing how far it fell", () => {
    const movement = deriveRankMovement([
      ranked("2026-07-01", 7),
      absent("2026-07-08"),
    ])!;
    expect(movement.direction).toBe("lost");
    expect(movement.delta).toBeNull();
    expect(movement.note).toMatch(/How far it fell is unknown/i);
  });

  // "Not in the top 10" and "not in the top 100" are different findings.
  it("keeps the examined depth in the explanation of an absence", () => {
    const shallow = deriveRankMovement([
      ranked("2026-07-01", 3),
      absent("2026-07-08", 10),
    ])!;
    expect(shallow.note).toContain("top 10");
    const deep = deriveRankMovement([
      ranked("2026-07-01", 3),
      absent("2026-07-08", 100),
    ])!;
    expect(deep.note).toContain("top 100");
  });

  it("returns nothing at all for an empty history", () => {
    expect(deriveRankMovement([])).toBeNull();
  });
});

describe("rank summary", () => {
  const movements = [
    deriveRankMovement([ranked("2026-07-01", 8), ranked("2026-07-08", 5)])!,
    deriveRankMovement([ranked("2026-07-01", 3), ranked("2026-07-08", 6)])!,
    deriveRankMovement([ranked("2026-07-01", 4), absent("2026-07-08")])!,
    deriveRankMovement([
      ranked("2026-07-01", 2),
      unmeasured("2026-07-08", "quota"),
    ])!,
  ];

  it("counts each terminal state separately", () => {
    const summary = summarizeRanks(movements);
    expect(summary.tracked).toBe(4);
    expect(summary.ranked).toBe(2);
    expect(summary.absent).toBe(1);
    expect(summary.unmeasured).toBe(1);
    expect(summary.improved).toBe(1);
    expect(summary.declined).toBe(1);
  });

  // Including absent keywords at an assumed value is the classic way a rank
  // report flatters itself: losing your worst keyword would look like progress.
  it("averages ranked keywords only", () => {
    const summary = summarizeRanks(movements);
    expect(summary.averagePosition).toBe(5.5);
  });

  it("reports no average rather than zero when nothing ranks", () => {
    const summary = summarizeRanks([
      deriveRankMovement([absent("2026-07-01"), absent("2026-07-08")])!,
    ]);
    expect(summary.ranked).toBe(0);
    expect(summary.averagePosition).toBeNull();
  });
});
