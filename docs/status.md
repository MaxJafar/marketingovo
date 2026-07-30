# Implementation status

Status date: 2026-07-16. This file is the release-truth boundary for the initial
portfolio workspace; the product vision describes later phases, not current
capability.

## Phase 0 — quarantine baseline

Implemented:

- an inventory record for each of the 50 extracted local snapshots;
- local license signals, risk categories, preliminary rebuild decisions and an
  unconditional `build_input: false` / `code_copy_allowed: false` boundary;
- a path-only quarantine manifest containing all 35 paths currently detected by
  the strict secret heuristic;
- validation that rejects archive references in product source/build inputs,
  symlink escapes, missing inventory rows and unquarantined detected paths;
- synthetic golden evidence independently authored for the walking skeleton.

Not complete:

- restored upstream URL, exact commit/tag, archive hash, acquisition chain and
  dependency provenance for every snapshot;
- resolved license and platform-policy review for ambiguous entries;
- one algorithm/interface/schema/failure/test/security card per project—the
  current table is portfolio triage only;
- independent behavioral acceptance suites for every approved rebuild;
- operator-confirmed rotation or revocation of any credential that may have
  appeared in Reddiment, Telegram Tracker or another quarantined path.

The quarantine manifest records paths and classifications only. It is not proof
that a credential was valid, and repository automation has neither tested nor
rotated any value.

## Phase 1 — hardened walking skeleton

Implemented:

- React command center → loopback Go API → durable SQLite run → synthetic Go
  connector → Protobuf Python worker → Arrow/Parquet/report staging → committed
  evidence manifest → SSE/UI result;
- distinct compare and research control messages; research remains a bounded
  synthesis of the same fixture rather than multi-source web research;
- immutable input snapshot hash/schema/size, replay-of linkage and recorded
  worker/model/connector/parser provenance;
- cancellation, source-failure and corrupt-output paths;
- authority-side Arrow IPC and Parquet decoding, exact 32-field schema checks,
  decoded-row equivalence and report-citation matching;
- denominator-specific engagement metrics, missing-not-zero semantics,
  contradiction preservation, observation citations and explicit warnings that
  follower change is not customer retention;
- generated SDK types, the same six policy-safe MCP tools over stdio and
  authenticated loopback Streamable HTTP, a Codex bundle and OpenClaw adapter;
- narrow Tauri source boundary for verified sidecars and credentials;
- OpenAPI response samples, clean temporary contract regeneration and an
  explicit Buf compatibility gate.

Important limits:

- developer Python is a trusted same-user process, not an OS or network sandbox;
- only the synthetic fixture connector is enabled; no live social, website,
  provider or AGENTseo connector ships in Phase 1;
- the local scheduler is single-daemon and does not yet provide the complete
  distributed lease/heartbeat/checkpoint/dead-letter design;
- filesystem evidence publication and SQLite result finalization are separate
  crash domains and require explicit reconciliation testing;
- the research workflow is deterministic descriptive synthesis, not an LLM
  research agent, contradiction adjudicator or broad source planner;
- no signed public desktop release or updater channel has been published;
- the million-observation benchmark, comprehensive security suites, SBOM,
  CodeQL, model calibration corpus and signed provenance pipeline remain gates.

## Phases 2–6 — roadmap

| Phase | Planned capability                                                                                            | Current status                                        |
| ----- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2     | Website/RSS, YouTube, Reddit, imports, AGENTseo bridge, watchlists, polished reports and desktop distribution | Not implemented beyond contracts/fixture architecture |
| 3     | Licensed creator discovery, campaign history, transparent anomaly models and governed business contacts       | Not implemented                                       |
| 4     | Registries, filings, products, funding, hiring signals, role timelines and human-approved CRM export          | Not implemented                                       |
| 5     | Cross-source trends, semantic clusters, coordination networks and aggregate workforce intelligence            | Not implemented                                       |
| 6     | Hosted GolemWorkers storage/workers, tenancy, RBAC, billing and managed providers                             | Not implemented                                       |

No roadmap connector should be inferred from a menu label, type definition,
reference card or architecture diagram. A connector is shipped only after its
source policy, credential scopes, rate limits, retention, kill switch, fixtures
and failure tests are implemented.
