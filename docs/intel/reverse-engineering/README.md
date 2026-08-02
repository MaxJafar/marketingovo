# Reference Laboratory Controls

This directory documents the isolated source snapshots under
`TO REVERSE ENGINEEER/`. The snapshots are research material, not part of
Marketingovo and not product build inputs.

This is a quarantine and triage baseline. It is not the completed Phase 0
reference laboratory: most entries still lack a restored upstream URL, exact
commit, independently recorded archive hash and dependency provenance. The
behavioral table is a preliminary portfolio card index, not a claim that every
algorithm, schema, failure mode, test and security boundary has been fully
dissected.

## Files

- `provenance-ledger.json`: machine-readable quarantine inventory for all 50
  local snapshots, local license signals, risks, and preliminary rebuild
  decisions.
- `behavioral-cards.md`: concise, implementation-independent triage summaries.
- `quarantine-manifest.json`: suspicious credential-bearing paths. It intentionally contains paths and classifications only.
- `../adr/0001-reference-lab-clean-room-boundary.md`: mandatory clean-room decision and exception process.

## Required checks

```sh
node scripts/reference-lab-validate.mjs
node scripts/scan-reference-secrets.mjs --fail-on-unquarantined
```

The secret scan reports only paths and rule IDs. Never modify it to print matching lines, snippets, values, entropy samples, or surrounding context.

A quarantined path is not proof that a value is live. Treat any suspected value
as compromised, but rotate or revoke it only through an authorized owner. No
repository check tests a credential, contacts a provider or proves that external
rotation occurred.

## Decision flow

1. `blocked` or `quarantine`: stop; no reuse or execution.
2. `reference-only`: retain only the approved behavioral description.
3. `clean-room-rebuild`: implement independently from product contracts and behavioral cards.
4. `evaluate-external-dependency`: discard the snapshot and review a verified upstream release.
5. `separate-service-review`: obtain written architecture, security, and license approval.
6. `licensed-data-review`: create an attributed, versioned, privacy-reviewed data package or do not use it.

All decisions still require the public/authorized/licensed-source rules in `SECURITY.md` and the people-data rules in `PRIVACY.md`.
