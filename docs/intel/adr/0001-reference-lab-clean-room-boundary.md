# ADR 0001: Reference Laboratory and Clean-Room Boundary

- Status: Accepted
- Date: 2026-07-16
- Owners: Architecture, Security, Privacy, and Legal review

## Context

`TO REVERSE ENGINEEER/` contains 50 extracted source snapshots used to understand the behavior of OSINT, trend, social-management, and analytics products. The snapshots have no local Git history or verified commit provenance. They span permissive, reciprocal, platform-restricted, proprietary, conflicting, and missing licenses. Some also contain suspicious credential-bearing files.

The product was distributed under Elastic-2.0 when this ADR was accepted; it is now Apache-2.0 (see ADR 0003, which strengthens rather than relaxes this boundary). Treating these snapshots as a shared code library would create provenance, license, security, privacy, and maintenance risks that cannot be solved by attribution alone.

## Decision

The archive tree is a non-executable reference laboratory and is never a product build input.

### Hard boundary

- No source, assets, prompts, models, site-definition datasets, fixtures, generated files, or vendored dependencies from the archive tree may be copied into product paths.
- Product code must not import, mount, symlink, compile, package, execute, or dynamically load anything below `TO REVERSE ENGINEEER/`.
- Production code-generation agents must not receive archive source as implementation context. They may receive approved behavioral cards, product contracts, and independently authored test cases.
- “Porting,” line-by-line translation, structural paraphrase, and cosmetic renaming are code copying for this policy.
- Archive credentials and sessions must never be tested. Suspicious paths stay quarantined and values must never appear in logs, issues, prompts, screenshots, patches, or reports.

### Clean-room workflow

1. An analyst records behavior, inputs, outputs, limitations, license evidence, and risks in the provenance ledger and behavioral-card index.
2. Security and privacy reviewers remove prohibited behavior and specify allowed public, authorized, or licensed source classes.
3. An implementer works from product requirements, public standards/API documentation, contracts, and behavioral cards—not archive source.
4. Tests are independently authored from product contracts or controlled observations using synthetic/non-personal fixtures.
5. Reviewers run `node scripts/reference-lab-validate.mjs` and confirm no reference path is a build input.
6. The product implementation records its own authorship and dependency provenance in the pull request.

The analyst and implementer may be the same person only when the pull request contains enough design and test evidence for an independent reviewer to confirm that no source translation occurred. High-risk or license-conflicted projects require separate reviewers.

### Approved exceptions

An exception does not permit importing the local archive. It permits one of these separately reviewed paths:

- A verified upstream release may be added through the normal dependency workflow after license, security, maintenance, and platform-policy review.
- A reciprocal component may be evaluated as a separately governed service or application only after written architecture and legal approval defining distribution and network-use obligations.
- A dataset may be added to a separately versioned data package only after attribution, database-right, redistribution, privacy, and deletion review.
- An official platform sample may be consulted or used only within its documented platform/license scope.

Every exception must update the ledger decision and link to the approving ADR or review record before implementation.

## Technical controls

- The root `.gitignore` excludes `TO REVERSE ENGINEEER/`.
- `docs/reverse-engineering/provenance-ledger.json` records all 50 archives and fixes `build_input` and `code_copy_allowed` to `false`.
- `docs/reverse-engineering/quarantine-manifest.json` lists suspicious paths without retaining values.
- `scripts/scan-reference-secrets.mjs` reports only relative paths and rule IDs.
- `scripts/reference-lab-validate.mjs` checks ledger completeness, quarantine integrity, prohibited build references, and symlinks into the lab.

## Consequences

The project may learn from behaviors and architecture while keeping authorship and licensing auditable. Reimplementation takes longer than source reuse, and some useful components will instead remain external dependencies or separate services. That cost is accepted because it prevents the archive tree from silently defining the product’s license, security posture, or people-data practices.
