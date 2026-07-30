// Acceptance policy for a stable (non-prerelease) version.
//
// This policy was written for a commercial edition with a paid tier, a
// contributor licence agreement, a trademark regime and design partners. All
// four are gone: the project is unaffiliated, Apache-2.0, single-edition, and
// accepts contributions with no separate agreement. The previous shape had
// already drifted into incoherence — it demanded approval of `elasticLicense2`
// under an error message that said Apache-2.0, because the licence change
// rewrote the message and not the field.
//
// Two requirements are therefore retired, and two are added that are actually
// checkable:
//
//   retired  legalReview of {elasticLicense2, trademarks, cla}
//            None of those subjects exists. A checkbox asserting that a lawyer
//            approved three things which are not part of the project is worse
//            than no gate, because it reads as assurance.
//
//   retired  three attributable design-partner case studies
//            That is enterprise marketing for a product being sold. It is not
//            evidence of correctness and cannot gate an open-source tag.
//
//   added    a named licence-compliance attestation, tied to the automated
//            checks that do run: SPDX consistency, NOTICE accuracy, dependency
//            licence policy.
//
//   added    the quality evidence the release claims, by name, each with the
//            command that produced it, so a stable tag enumerates what it
//            actually ran instead of asserting a posture.
//
//   added    deferredChannels, so a release cannot stay silent about a
//            distribution channel it did not actually ship.
//
// The release-owner approval is unchanged and remains mandatory: a human decides
// to publish.

function nonPlaceholder(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    !/^(?:tbd|todo|unknown|anonymous|n\/a|none)$/iu.test(value.trim())
  );
}

function validPastTimestamp(value, now) {
  const timestamp = Date.parse(value);
  return (
    typeof value === "string" &&
    Number.isFinite(timestamp) &&
    timestamp <= now + 5 * 60 * 1000
  );
}

export function requiresPublicAcceptance(version) {
  return /^\d+\.\d+\.\d+$/u.test(version);
}

/**
 * Gates a stable tag must name in its acceptance record, mapped to the command
 * that produces the evidence, so the record cannot claim a gate nobody can
 * rerun.
 */
export const REQUIRED_RELEASE_EVIDENCE = Object.freeze({
  workspaceGate: "pnpm check",
  correctnessCorpus: "pnpm benchmark",
  dependencyAdvisories: "pnpm audit:dependencies",
  licencePolicy: "pnpm validate:licenses",
  agentSurfaces: "pnpm validate:plugins",
  instructionGuardrails: "pnpm validate:skills",
  packagedBrowserJourney: "pnpm test:e2e",
});

export function validatePublicReleaseAcceptance(
  record,
  version,
  now = Date.now(),
) {
  if (!requiresPublicAcceptance(version)) return null;

  if (
    record?.schemaVersion !== 2 ||
    record.version !== version ||
    record.releaseOwner?.status !== "approved" ||
    !nonPlaceholder(record.releaseOwner?.name) ||
    !validPastTimestamp(record.releaseOwner?.approvedAt, now)
  ) {
    throw new Error(
      "Stable release acceptance is missing a current release-owner approval",
    );
  }

  const licence = record.licenceCompliance;
  if (
    licence?.status !== "approved" ||
    licence?.spdxIdentifier !== "Apache-2.0" ||
    licence?.noticeReviewed !== true ||
    licence?.dependencyPolicy !== "passing" ||
    !nonPlaceholder(licence?.reviewer) ||
    !validPastTimestamp(licence?.reviewedAt, now)
  ) {
    throw new Error(
      "Stable release acceptance requires a named licence-compliance " +
        "attestation: Apache-2.0 declared consistently, NOTICE reviewed, and a " +
        "passing dependency licence policy",
    );
  }

  for (const [gate, command] of Object.entries(REQUIRED_RELEASE_EVIDENCE)) {
    const entry = record.evidence?.[gate];
    if (
      entry?.result !== "passed" ||
      entry?.command !== command ||
      !validPastTimestamp(entry?.observedAt, now)
    ) {
      throw new Error(
        `Stable release acceptance must record a passing ${gate} observed from \`${command}\``,
      );
    }
  }

  // A stable source and npm release does not by itself mean signed installers
  // exist. A record that stays silent about a channel it did not ship is
  // misleading, so silence is not allowed — only an explicit empty array.
  if (!Array.isArray(record.deferredChannels)) {
    throw new Error(
      "Stable release acceptance must list deferredChannels, using an empty " +
        "array when every distribution channel shipped",
    );
  }
  for (const channel of record.deferredChannels) {
    if (!nonPlaceholder(channel?.channel) || !nonPlaceholder(channel?.reason)) {
      throw new Error(
        "Every deferred distribution channel needs a name and a reason",
      );
    }
  }

  return record;
}
