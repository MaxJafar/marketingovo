// Keyword rank tracking: position history and honest movement.
//
// Rank data is where marketing tools most often lie, and almost always in the
// same three ways:
//
//   1. treating "not found" as a number (position 0, or 101) so it plots on a
//      chart, which turns an absence into a measurement;
//   2. treating a failed provider call as a ranking loss, so an outage looks
//      like a drop;
//   3. reporting a delta against a baseline that was itself never measured.
//
// Every rule below exists to prevent one of those. A position is a number only
// when the site was actually found; everything else is a named state.

/** What a single check actually established. */
export type RankOutcome =
  /** The site was found. `position` holds where. */
  | "ranked"
  /** The site was genuinely not in the results examined. */
  | "absent"
  /** No usable answer was obtained. This is not a ranking fact. */
  | "unmeasured";

export interface RankObservation {
  observedAt: string;
  outcome: RankOutcome;
  /** Non-null only when outcome is "ranked". */
  position: number | null;
  rankingUrl: string | null;
  /**
   * How deep the SERP went. "Not in the top 10" and "not in the top 100" are
   * different findings, so an absence without this is not interpretable.
   */
  resultsExamined: number | null;
  provider: string;
  failureReason?: string | null;
}

export type RankDirection =
  | "improved"
  | "declined"
  | "unchanged"
  | "entered"
  | "lost"
  /** Either endpoint was not measured, so no movement can be claimed. */
  | "indeterminate"
  /** Nothing to compare against yet. */
  | "first-observation";

export interface RankMovement {
  direction: RankDirection;
  /** Signed places gained, negative for a decline. Null unless both ends ranked. */
  delta: number | null;
  current: RankObservation;
  previous: RankObservation | null;
  /** Why a movement could not be computed, when it could not. */
  note: string | null;
}

/**
 * Compares the two most recent observations.
 *
 * Improvement is a *decrease* in position, so the delta is expressed as places
 * gained: +3 means the site moved from 8 to 5.
 */
export function deriveRankMovement(
  history: readonly RankObservation[],
): RankMovement | null {
  if (history.length === 0) return null;

  const ordered = [...history].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt),
  );
  const current = ordered[ordered.length - 1]!;
  const previous = ordered.length > 1 ? ordered[ordered.length - 2]! : null;

  if (!previous) {
    return {
      direction: "first-observation",
      delta: null,
      current,
      previous: null,
      note: "First check for this keyword. There is no baseline to move against.",
    };
  }

  // A failed check says nothing about ranking in either direction. Calling it a
  // decline would turn a provider outage into a reported loss.
  if (current.outcome === "unmeasured" || previous.outcome === "unmeasured") {
    return {
      direction: "indeterminate",
      delta: null,
      current,
      previous,
      note:
        current.outcome === "unmeasured"
          ? "This check did not return a usable result, so the position is unknown rather than lost."
          : "The previous check did not return a usable result, so there is nothing to compare against.",
    };
  }

  if (current.outcome === "ranked" && previous.outcome === "ranked") {
    const gained = previous.position! - current.position!;
    return {
      direction:
        gained > 0 ? "improved" : gained < 0 ? "declined" : "unchanged",
      delta: gained,
      current,
      previous,
      note: null,
    };
  }

  if (current.outcome === "ranked" && previous.outcome === "absent") {
    return {
      direction: "entered",
      delta: null,
      current,
      previous,
      // No delta: the previous position was never a number, so subtracting
      // from it would invent the distance travelled.
      note: `Entered the results at position ${current.position}. The previous check found nothing in the top ${previous.resultsExamined}, so the size of the gain is unknown.`,
    };
  }

  if (current.outcome === "absent" && previous.outcome === "ranked") {
    return {
      direction: "lost",
      delta: null,
      current,
      previous,
      note: `Was at position ${previous.position}, now not in the top ${current.resultsExamined}. How far it fell is unknown, only that it is beyond the depth checked.`,
    };
  }

  return {
    direction: "unchanged",
    delta: null,
    current,
    previous,
    note: `Not in the top ${current.resultsExamined} on either check.`,
  };
}

export interface RankSummary {
  tracked: number;
  ranked: number;
  absent: number;
  unmeasured: number;
  improved: number;
  declined: number;
  /** Mean position across ranked keywords only, or null when none ranked. */
  averagePosition: number | null;
}

/**
 * Aggregates the latest state across a keyword set.
 *
 * The average deliberately covers ranked keywords only. Including absent ones
 * at some assumed value is the most common way a rank report flatters itself:
 * a site that loses its worst keyword would appear to improve.
 */
export function summarizeRanks(
  movements: readonly RankMovement[],
): RankSummary {
  let ranked = 0;
  let absent = 0;
  let unmeasured = 0;
  let improved = 0;
  let declined = 0;
  let positionTotal = 0;

  for (const movement of movements) {
    switch (movement.current.outcome) {
      case "ranked":
        ranked += 1;
        positionTotal += movement.current.position!;
        break;
      case "absent":
        absent += 1;
        break;
      default:
        unmeasured += 1;
    }
    if (movement.direction === "improved") improved += 1;
    if (movement.direction === "declined") declined += 1;
  }

  return {
    tracked: movements.length,
    ranked,
    absent,
    unmeasured,
    improved,
    declined,
    averagePosition: ranked > 0 ? positionTotal / ranked : null,
  };
}
