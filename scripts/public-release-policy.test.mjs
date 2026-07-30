import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_RELEASE_EVIDENCE,
  requiresPublicAcceptance,
  validatePublicReleaseAcceptance,
} from "./public-release-policy.mjs";

const now = Date.parse("2026-07-15T12:00:00.000Z");
const observedAt = "2026-07-15T10:30:00.000Z";

function acceptance() {
  return {
    schemaVersion: 2,
    version: "1.0.0",
    releaseOwner: {
      status: "approved",
      name: "Release Owner",
      approvedAt: "2026-07-15T10:00:00.000Z",
    },
    licenceCompliance: {
      status: "approved",
      spdxIdentifier: "Apache-2.0",
      noticeReviewed: true,
      dependencyPolicy: "passing",
      reviewer: "Release Owner",
      reviewedAt: "2026-07-15T10:10:00.000Z",
    },
    evidence: Object.fromEntries(
      Object.entries(REQUIRED_RELEASE_EVIDENCE).map(([gate, command]) => [
        gate,
        { command, result: "passed", observedAt },
      ]),
    ),
    deferredChannels: [
      { channel: "signed-desktop-installers", reason: "no signing identity" },
    ],
  };
}

test("prereleases do not claim stable public acceptance", () => {
  assert.equal(requiresPublicAcceptance("1.0.0-rc.1"), false);
  assert.equal(validatePublicReleaseAcceptance(null, "1.0.0-rc.1", now), null);
});

test("a stable release needs a current release-owner approval", () => {
  const record = acceptance();
  assert.equal(validatePublicReleaseAcceptance(record, "1.0.0", now), record);

  for (const mutate of [
    (draft) => (draft.releaseOwner.status = "pending"),
    (draft) => (draft.releaseOwner.name = "TBD"),
    (draft) => (draft.releaseOwner.approvedAt = "2099-01-01T00:00:00.000Z"),
    (draft) => (draft.schemaVersion = 1),
    (draft) => (draft.version = "1.0.1"),
  ]) {
    const draft = acceptance();
    mutate(draft);
    assert.throws(
      () => validatePublicReleaseAcceptance(draft, "1.0.0", now),
      /release-owner approval/u,
    );
  }
});

test("a stable release needs a named licence-compliance attestation", () => {
  for (const mutate of [
    (draft) => (draft.licenceCompliance.status = "pending"),
    (draft) => (draft.licenceCompliance.spdxIdentifier = "Elastic-2.0"),
    (draft) => (draft.licenceCompliance.noticeReviewed = false),
    (draft) => (draft.licenceCompliance.dependencyPolicy = "unknown"),
    (draft) => (draft.licenceCompliance.reviewer = "n/a"),
    (draft) => delete draft.licenceCompliance,
  ]) {
    const draft = acceptance();
    mutate(draft);
    assert.throws(
      () => validatePublicReleaseAcceptance(draft, "1.0.0", now),
      /licence-compliance attestation/u,
    );
  }
});

test("every required gate must be recorded as passing with its real command", () => {
  for (const gate of Object.keys(REQUIRED_RELEASE_EVIDENCE)) {
    for (const mutate of [
      (draft) => (draft.evidence[gate].result = "skipped"),
      (draft) => (draft.evidence[gate].command = "echo ok"),
      (draft) => (draft.evidence[gate].observedAt = "2099-01-01T00:00:00.000Z"),
      (draft) => delete draft.evidence[gate],
    ]) {
      const draft = acceptance();
      mutate(draft);
      assert.throws(
        () => validatePublicReleaseAcceptance(draft, "1.0.0", now),
        new RegExp(gate, "u"),
        `${gate} was not enforced`,
      );
    }
  }
});

test("a deferred distribution channel cannot be left implicit", () => {
  const missing = acceptance();
  delete missing.deferredChannels;
  assert.throws(
    () => validatePublicReleaseAcceptance(missing, "1.0.0", now),
    /deferredChannels/u,
  );

  // Shipping every channel is expressible, but only explicitly.
  const complete = acceptance();
  complete.deferredChannels = [];
  assert.equal(
    validatePublicReleaseAcceptance(complete, "1.0.0", now),
    complete,
  );

  for (const mutate of [
    (draft) => (draft.deferredChannels[0].channel = "TBD"),
    (draft) => (draft.deferredChannels[0].reason = ""),
    (draft) => delete draft.deferredChannels[0].reason,
  ]) {
    const draft = acceptance();
    mutate(draft);
    assert.throws(
      () => validatePublicReleaseAcceptance(draft, "1.0.0", now),
      /deferred distribution channel/u,
    );
  }
});
