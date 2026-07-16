/**
 * Conservative regular-expression policy for user-authored crawl rules.
 *
 * JavaScript's RegExp engine is a backtracking engine. A syntactically valid
 * pattern can therefore monopolise the single writer/daemon thread when it is
 * evaluated against a large HTML document. Custom rules are intentionally a
 * smaller language than JavaScript RegExp: constructs which make the amount of
 * backtracking difficult to bound are rejected before a crawl starts.
 */

export const CUSTOM_RULE_REGEX_LIMITS = Object.freeze({
  /** Matches the public project-bundle schema. Measured in UTF-16 code units. */
  maxPatternLength: 512,
  /** Maximum text or HTML prefix tested by one rule on one page. */
  maxInputLength: 128 * 1024,
  /** Prevent tiny patterns from requesting impractically large fixed repeats. */
  maxFiniteRepetition: 10_000,
});

export type CustomRuleRegexRejectionCode =
  | "invalid_type"
  | "empty_pattern"
  | "pattern_too_long"
  | "invalid_syntax"
  | "backreference"
  | "lookaround"
  | "excessive_quantifier"
  | "nested_quantifier"
  | "quantified_alternation"
  | "ambiguous_repetition";

export type CustomRuleRegexValidation =
  | { safe: true }
  | {
      safe: false;
      code: CustomRuleRegexRejectionCode;
      message: string;
    };

interface Quantifier {
  end: number;
  min: number;
  max: number;
  bounded: boolean;
}

interface GroupFrame {
  containsAlternation: boolean;
  containsQuantifier: boolean;
}

const reject = (
  code: CustomRuleRegexRejectionCode,
  message: string,
): CustomRuleRegexValidation => ({ safe: false, code, message });

function quantifierAt(pattern: string, index: number): Quantifier | null {
  const token = pattern[index];
  if (token === "?") return { end: index, min: 0, max: 1, bounded: true };
  if (token === "*") {
    return {
      end: index,
      min: 0,
      max: Number.POSITIVE_INFINITY,
      bounded: false,
    };
  }
  if (token === "+") {
    return {
      end: index,
      min: 1,
      max: Number.POSITIVE_INFINITY,
      bounded: false,
    };
  }
  if (token !== "{") return null;

  const match = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(index));
  if (!match) return null;
  const hasComma = match[0].includes(",");
  const upper = match[2];
  const min = Number(match[1]);
  const bounded = !hasComma || (upper !== "" && upper !== undefined);
  const max = !hasComma
    ? min
    : upper === "" || upper === undefined
      ? Number.POSITIVE_INFINITY
      : Number(upper);
  return {
    end: index + match[0].length - 1,
    min,
    max,
    bounded,
  };
}

function hasExcessiveFiniteRepetition(quantifier: Quantifier): boolean {
  return (
    quantifier.bounded &&
    (!Number.isSafeInteger(quantifier.max) ||
      quantifier.max > CUSTOM_RULE_REGEX_LIMITS.maxFiniteRepetition)
  );
}

function hasAmbiguousAdjacentRepetition(pattern: string): boolean {
  let previous: { key: string; end: number } | null = null;
  let inCharacterClass = false;

  for (let index = 0; index < pattern.length; index += 1) {
    const start = index;
    const token = pattern[index];
    let key: string | null = null;
    let atomEnd = index;

    if (token === "\\") {
      atomEnd = Math.min(index + 1, pattern.length - 1);
      key = pattern.slice(index, atomEnd + 1);
    } else if (token === "[") {
      inCharacterClass = true;
      let escaped = false;
      for (atomEnd = index + 1; atomEnd < pattern.length; atomEnd += 1) {
        const current = pattern[atomEnd];
        if (!escaped && current === "]") {
          inCharacterClass = false;
          break;
        }
        escaped = !escaped && current === "\\";
        if (current !== "\\") escaped = false;
      }
      key = pattern.slice(index, atomEnd + 1);
    } else if (
      !inCharacterClass &&
      token !== undefined &&
      !"()|^$*+?{}".includes(token)
    ) {
      key = token;
    }

    if (key === null) {
      previous = null;
      continue;
    }

    const quantifier = quantifierAt(pattern, atomEnd + 1);
    const isVariableRepeat =
      quantifier !== null &&
      quantifier.max > 1 &&
      (!quantifier.bounded || quantifier.min !== quantifier.max);
    if (!isVariableRepeat) {
      previous = null;
      index = atomEnd;
      continue;
    }

    let repetitionEnd = quantifier.end;
    if (pattern[repetitionEnd + 1] === "?") repetitionEnd += 1;
    if (
      previous &&
      previous.end + 1 === start &&
      (previous.key === key || previous.key === "." || key === ".")
    ) {
      return true;
    }
    previous = { key, end: repetitionEnd };
    index = repetitionEnd;
  }
  return false;
}

function markQuantifier(frames: GroupFrame[]): void {
  // A quantifier belongs to every enclosing group, not just the innermost one.
  // This lets `(a(?:b+)c)+` be rejected as a nested repetition as well.
  for (const frame of frames) frame.containsQuantifier = true;
}

function markAlternation(frames: GroupFrame[]): void {
  for (const frame of frames) frame.containsAlternation = true;
}

/**
 * Validate a pattern without ever executing it against user-controlled input.
 *
 * Accepted patterns still support literals, character classes, anchors,
 * bounded quantifiers, capture/non-capture groups and unquantified alternation.
 * Backreferences, lookarounds, nested repetition, repeated alternation and
 * multiple unbounded wildcards are deliberately outside the custom-rule DSL.
 */
export function validateCustomRuleRegex(
  pattern: unknown,
): CustomRuleRegexValidation {
  if (typeof pattern !== "string") {
    return reject(
      "invalid_type",
      "The regular-expression pattern must be a string.",
    );
  }
  if (pattern.length === 0) {
    return reject(
      "empty_pattern",
      "The regular-expression pattern cannot be empty.",
    );
  }
  if (pattern.length > CUSTOM_RULE_REGEX_LIMITS.maxPatternLength) {
    return reject(
      "pattern_too_long",
      `The regular-expression pattern exceeds ${CUSTOM_RULE_REGEX_LIMITS.maxPatternLength} characters.`,
    );
  }

  try {
    // Compile only for syntax validation. The expression is not run here.
    new RegExp(pattern, "i");
  } catch {
    return reject(
      "invalid_syntax",
      "The regular-expression pattern is invalid.",
    );
  }

  if (hasAmbiguousAdjacentRepetition(pattern)) {
    return reject(
      "ambiguous_repetition",
      "Adjacent overlapping repetitions are not allowed in custom-rule regular expressions.",
    );
  }

  const frames: GroupFrame[] = [];
  let inCharacterClass = false;
  let unboundedWildcardCount = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    const token = pattern[index];

    if (token === "\\") {
      if (!inCharacterClass) {
        const escaped = pattern[index + 1] ?? "";
        if (
          /[1-9]/.test(escaped) ||
          (escaped === "k" && pattern[index + 2] === "<")
        ) {
          return reject(
            "backreference",
            "Backreferences are not allowed in custom-rule regular expressions.",
          );
        }
      }
      index += 1;
      continue;
    }

    if (inCharacterClass) {
      if (token === "]") inCharacterClass = false;
      continue;
    }
    if (token === "[") {
      inCharacterClass = true;
      continue;
    }

    if (token === "(") {
      if (
        pattern.startsWith("(?=", index) ||
        pattern.startsWith("(?!", index) ||
        pattern.startsWith("(?<=", index) ||
        pattern.startsWith("(?<!", index)
      ) {
        return reject(
          "lookaround",
          "Lookaround assertions are not allowed in custom-rule regular expressions.",
        );
      }

      frames.push({ containsAlternation: false, containsQuantifier: false });

      // Skip group syntax so its `?` is not mistaken for a quantifier.
      if (pattern.startsWith("(?:", index)) {
        index += 2;
      } else if (pattern.startsWith("(?<", index)) {
        const nameEnd = pattern.indexOf(">", index + 3);
        if (nameEnd !== -1) index = nameEnd;
      }
      continue;
    }

    if (token === "|") {
      markAlternation(frames);
      continue;
    }

    if (token === ")") {
      const frame = frames.pop();
      if (!frame) continue; // Syntax compilation above already rejects this.
      const quantifier = quantifierAt(pattern, index + 1);
      if (quantifier && hasExcessiveFiniteRepetition(quantifier)) {
        return reject(
          "excessive_quantifier",
          `Finite repetitions cannot exceed ${CUSTOM_RULE_REGEX_LIMITS.maxFiniteRepetition}.`,
        );
      }
      if (quantifier && quantifier.max > 1) {
        if (frame.containsQuantifier) {
          return reject(
            "nested_quantifier",
            "Nested quantifiers are not allowed in custom-rule regular expressions.",
          );
        }
        if (frame.containsAlternation) {
          return reject(
            "quantified_alternation",
            "Repeated alternation is not allowed in custom-rule regular expressions.",
          );
        }
        markQuantifier(frames);
      } else if (quantifier) {
        markQuantifier(frames);
      }
      continue;
    }

    const quantifier = quantifierAt(pattern, index);
    if (quantifier) {
      if (hasExcessiveFiniteRepetition(quantifier)) {
        return reject(
          "excessive_quantifier",
          `Finite repetitions cannot exceed ${CUSTOM_RULE_REGEX_LIMITS.maxFiniteRepetition}.`,
        );
      }
      markQuantifier(frames);
      index = quantifier.end;
      // Skip the lazy modifier; it does not change the repetition bound.
      if (pattern[index + 1] === "?") index += 1;
      continue;
    }

    if (token === ".") {
      const wildcardQuantifier = quantifierAt(pattern, index + 1);
      if (wildcardQuantifier && !wildcardQuantifier.bounded) {
        unboundedWildcardCount += 1;
        if (unboundedWildcardCount > 1) {
          return reject(
            "ambiguous_repetition",
            "Multiple unbounded wildcards are not allowed in one custom-rule regular expression.",
          );
        }
      }
    }
  }

  return { safe: true };
}

/** Compile only patterns which passed the shared safety policy. */
export function compileSafeCustomRuleRegex(pattern: unknown): RegExp | null {
  const validation = validateCustomRuleRegex(pattern);
  return validation.safe ? new RegExp(pattern as string, "i") : null;
}

/** Bound work before a safe expression is executed against crawl content. */
export function limitCustomRuleRegexInput(input: string): string {
  return input.length <= CUSTOM_RULE_REGEX_LIMITS.maxInputLength
    ? input
    : input.slice(0, CUSTOM_RULE_REGEX_LIMITS.maxInputLength);
}
