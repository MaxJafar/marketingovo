# Marketingovo Competitive Pulse import v1 golden contract

`competitive-pulse.csv` is the sanitized golden input for the private local
import alpha. It contains 18 fictional observations for three fictional brands.
Every URL uses the reserved `.invalid` domain; the import workflow must treat
the URLs as inert citation text and must never fetch them.

`expected-preview.json` shows the deterministic successful preview for an
authority clock fixed at `2026-07-16T12:00:00Z`. The `dataset_id` is an example
opaque identifier. The SHA-256, byte count, row count, policy, target summaries,
and metric availability are exact expectations for the committed CSV bytes.

`source-url-policy.json` is the normative cross-language conformance set for
`source-reference.v1`. It freezes accepted and rejected source forms, stable
diagnostic codes, derived hosts, and the alpha-wide rule that citations are
copyable inert text but never clickable or fetched.

The normative grammar, validation diagnostics, canonical field mapping,
metrics, lifecycle, retention, API, worker, and report contracts are in
[`docs/intel/adr/0002-local-competitive-pulse-import-alpha.md`](../../docs/intel/adr/0002-local-competitive-pulse-import-alpha.md).
The sample uses the canonical `marketingovo.*` wire namespace.
product name or a license decision.
