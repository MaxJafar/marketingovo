# Stable release acceptance

Stable releases fail closed until `VERSION.json` records:

- approval from the release owner;
- legal review of the Elastic License 2.0, trademark policy, and CLA;
- at least three unique design partners that completed a real weekly workflow,
  produced a verified SEO improvement, approved the release, and granted
  permission for an attributable case study.

Prerelease tags do not claim this acceptance. The `public-release` GitHub
environment must also require a human reviewer; the committed record is not a
replacement for protected-environment approval.

Example shape:

```json
{
  "schemaVersion": 1,
  "version": "1.0.0",
  "releaseOwner": {
    "status": "approved",
    "name": "Full name",
    "approvedAt": "2026-01-01T00:00:00.000Z"
  },
  "legalReview": {
    "status": "approved",
    "elasticLicense2": "approved",
    "trademarks": "approved",
    "cla": "approved",
    "reviewer": "Full name",
    "approvedAt": "2026-01-01T00:00:00.000Z"
  },
  "designPartners": [
    {
      "organization": "Attributable organization",
      "approval": "approved",
      "caseStudyPermission": "attributable",
      "weeklyVerifiedImprovements": 1,
      "workflowCompletedAt": "2026-01-01T00:00:00.000Z",
      "approvedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```
