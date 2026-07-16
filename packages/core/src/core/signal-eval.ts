// Signal evaluation: after each composer pass, decide whether to
// run another pass and which modules to re-run.
//
// Heuristic (Sprint 3 baseline; can be replaced with a learned
// model later):
//
//   - A module that called markWeak() is a candidate for a follow-up.
//   - A module that called markStrong() is considered "done" for
//     this audit run (we don't re-run it; the next audit run will
//     re-evaluate).
//   - A module that called neither (silent) is treated as a weak
//     signal: most modules emit at least a markStrong on a healthy
//     run. Silence = suspicious.
//   - Stop the audit if no module is weak (everyone is satisfied).
//   - Stop the audit if the pass count has reached the cap.
//
// Future work (Sprint 9 / Sprint 13): replace these heuristics with
// a learned ranker trained on a few hundred audit runs. For now
// the heuristic is intentionally simple and easy to reason about.

import type { ModuleId } from "../modules/types.js";

export interface PassSignal {
  weak: string[];
  strong: string[];
}

export interface SignalVerdict {
  /** If true, the composer should stop. */
  stop: boolean;
  /** Human-readable reason for logging. */
  reason: string;
  /** Module ids to re-run on the next pass (empty iff stop). */
  rerun: ModuleId[];
}

const SILENCE_REASON = "no markStrong/markWeak call (silent module)";

export function evaluatePass(
  signal: ReadonlyMap<ModuleId, PassSignal>,
  allModuleIds: readonly ModuleId[],
): SignalVerdict {
  const rerun: ModuleId[] = [];
  const reasons: string[] = [];

  for (const id of allModuleIds) {
    const sig = signal.get(id);
    if (!sig) {
      // Module was not run this pass (skipped because it's not
      // weak). Don't count as a candidate.
      continue;
    }
    if (sig.strong.length > 0) continue;
    if (sig.weak.length > 0) {
      rerun.push(id);
      reasons.push(`${id}: ${sig.weak.join("; ")}`);
      continue;
    }
    // No markStrong, no markWeak — silent.
    rerun.push(id);
    reasons.push(`${id}: ${SILENCE_REASON}`);
  }

  if (rerun.length === 0) {
    return { stop: true, reason: "all modules signaled strong", rerun: [] };
  }
  return { stop: false, reason: reasons.join(" | "), rerun };
}

/** Quick predicate: is this signal "strong enough" to consider
 *  the module done? Used by callers (and tests) that just want a
 *  yes/no without the full verdict. */
export function isStrong(sig: PassSignal | undefined): boolean {
  return !!sig && sig.strong.length > 0 && sig.weak.length === 0;
}
