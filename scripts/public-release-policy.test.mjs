import assert from "node:assert/strict";
import test from "node:test";
import {
  requiresPublicAcceptance,
  validatePublicReleaseAcceptance,
} from "./public-release-policy.mjs";

const now = Date.parse("2026-07-15T12:00:00.000Z");

function acceptance() {
  return {
    schemaVersion: 1,
    version: "1.0.0",
    releaseOwner: {
      status: "approved",
      name: "Release Owner",
      approvedAt: "2026-07-15T10:00:00.000Z",
    },
    legalReview: {
      status: "approved",
      elasticLicense2: "approved",
      trademarks: "approved",
      cla: "approved",
      reviewer: "Qualified Counsel",
      approvedAt: "2026-07-14T10:00:00.000Z",
    },
    designPartners: ["North", "East", "West"].map((organization) => ({
      organization,
      approval: "approved",
      caseStudyPermission: "attributable",
      weeklyVerifiedImprovements: 2,
      workflowCompletedAt: "2026-07-13T10:00:00.000Z",
      approvedAt: "2026-07-14T11:00:00.000Z",
    })),
  };
}

test("prereleases do not claim stable public acceptance", () => {
  assert.equal(requiresPublicAcceptance("1.0.0-rc.1"), false);
  assert.equal(validatePublicReleaseAcceptance(null, "1.0.0-rc.1", now), null);
});

test("stable releases require legal, owner and three attributable partner approvals", () => {
  const record = acceptance();
  assert.equal(validatePublicReleaseAcceptance(record, "1.0.0", now), record);
  record.designPartners.pop();
  assert.throws(
    () => validatePublicReleaseAcceptance(record, "1.0.0", now),
    /three design-partner/u,
  );
});

test("placeholder, duplicate or non-attributable partner evidence is rejected", () => {
  for (const mutate of [
    (record) => (record.designPartners[0].organization = "TBD"),
    (record) =>
      (record.designPartners[1].organization =
        record.designPartners[0].organization),
    (record) => (record.designPartners[2].caseStudyPermission = "private"),
    (record) => (record.designPartners[0].weeklyVerifiedImprovements = 0),
  ]) {
    const record = acceptance();
    mutate(record);
    assert.throws(
      () => validatePublicReleaseAcceptance(record, "1.0.0", now),
      /Every design partner/u,
    );
  }
});
