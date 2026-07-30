function nonPlaceholder(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    !/^(?:tbd|todo|unknown|anonymous)$/iu.test(value.trim())
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

export function validatePublicReleaseAcceptance(
  record,
  version,
  now = Date.now(),
) {
  if (!requiresPublicAcceptance(version)) return null;
  if (
    record?.schemaVersion !== 1 ||
    record.version !== version ||
    record.releaseOwner?.status !== "approved" ||
    !nonPlaceholder(record.releaseOwner?.name) ||
    !validPastTimestamp(record.releaseOwner?.approvedAt, now)
  ) {
    throw new Error(
      "Stable release acceptance is missing a current release-owner approval",
    );
  }
  const legal = record.legalReview;
  if (
    legal?.status !== "approved" ||
    legal?.elasticLicense2 !== "approved" ||
    legal?.trademarks !== "approved" ||
    legal?.cla !== "approved" ||
    !nonPlaceholder(legal?.reviewer) ||
    !validPastTimestamp(legal?.approvedAt, now)
  ) {
    throw new Error(
      "Stable release acceptance requires legal approval of Apache-2.0, trademarks and CLA",
    );
  }
  if (
    !Array.isArray(record.designPartners) ||
    record.designPartners.length < 3
  ) {
    throw new Error(
      "Stable 1.0 requires at least three design-partner approvals",
    );
  }
  const organizations = new Set();
  for (const partner of record.designPartners) {
    const organization = partner?.organization?.trim();
    if (
      !nonPlaceholder(organization) ||
      organizations.has(organization.toLowerCase()) ||
      partner.approval !== "approved" ||
      partner.caseStudyPermission !== "attributable" ||
      !Number.isInteger(partner.weeklyVerifiedImprovements) ||
      partner.weeklyVerifiedImprovements < 1 ||
      !validPastTimestamp(partner.workflowCompletedAt, now) ||
      !validPastTimestamp(partner.approvedAt, now)
    ) {
      throw new Error(
        "Every design partner must be unique, complete a real weekly workflow, approve release, show a verified improvement and permit an attributable case study",
      );
    }
    organizations.add(organization.toLowerCase());
  }
  return record;
}
