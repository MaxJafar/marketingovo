# Implementation status

Status date: 2026-07-30. This file is the release-truth boundary. The product
vision describes later phases, not current capability.

## 1.0.0 — released state

AGENTintel 1.0.0 declares a stable public surface: the REST API and its OpenAPI
document, the generated TypeScript SDK, the six-tool agent contract registry, the
CLI, the Protobuf worker protocol, and the evidence manifest and observation
schema identifiers. Breaking changes to these now require a major version.

**Implemented and shipping**

- a live website connector reading each target's own RSS or Atom feed, behind a
  fail-closed egress policy: scheme, port, userinfo and hostname rules; loopback,
  link-local and RFC1918 space blocked; cloud metadata blocked by address even
  when private hosts are approved; every dialled address re-checked after DNS;
  every redirect hop re-validated;
- per-run source routing, so live-URL runs use the website connector while
  fixture and imported runs keep the existing path. A mixed target set is refused
  rather than silently producing incomparable targets;
- denominator-safe metrics: publication count, freshness, and cadence carrying
  its numerator and denominator. Cadence is omitted entirely when there is one
  dated item, and an undated feed yields a count and nothing else;
- the full evidence chain: untrusted worker artifacts physically re-decoded,
  row-compared, citation- and provenance-verified, hashed, and committed by
  atomic rename;
- three dashboard workspaces: Research, Reports & Runs, Datasets & Evidence;
- six agent tools across Claude Code, Codex, OpenClaw, Cursor, VS Code and
  generic MCP, generated from one contract registry with a drift gate;
- CI across Go, Python, TypeScript and Rust, plus CodeQL and dependabot on all
  four ecosystems.

**Explicitly not in 1.0.0**

- YouTube, Reddit, Meta, TikTok, Trends and licensed-provider connectors;
- engagement, audience, reach or revenue metrics — a feed does not carry them;
- the ten remaining dashboard workspaces, which render as not yet built;
- signed desktop installers, an updater channel, and published packages;
- a distributed scheduler with leases, heartbeats and dead-lettering; the local
  scheduler remains single-daemon;
- an OS-level sandbox for the Python worker. It is a trusted same-user process,
  and the threat model says so rather than implying otherwise.

## Known defect blocking a clean release gate

`test_slow_cli_handles_termination_as_cancellation` fails roughly one run in six,
but only when the full 33-test Python suite runs; it passes 10/10 alone and 4/4
for its own file. Established by measurement:

- the worker's SIGTERM handling is correct in isolation — 12 consecutive direct
  invocations exited 130 in 0.02 s each;
- on the failing runs the process does not exit within 30 s, and re-sending
  SIGTERM every second for a further 30 s does not recover it. It becomes
  genuinely unresponsive to SIGTERM rather than missing one delivery;
- draining stderr concurrently removed a real pipe-buffer deadlock in the test
  and fixed the isolated case, but not the whole-suite case.

This does not affect production cancellation. The Go supervisor cancels a run
with `Process.Kill()`, which cannot be blocked, deferred, or lost. The affected
path is graceful SIGTERM handling, which nothing in the product depends on.

It is recorded here rather than worked around. Making the gate green by skipping
the test, marking it tolerant of failure, or asserting a weaker property would
hide a real finding about worker responsiveness, most likely a C extension
holding the interpreter without yielding to the Python-level signal handler.

**Evidence recorded for this release** lives in `release/acceptance/1.0.0.json`.

## Phases 2–6 — roadmap

| Phase | Planned capability                                                                                            | Current status                                        |
| ----- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2     | Website/RSS, YouTube, Reddit, imports, AGENTseo bridge, watchlists, polished reports and desktop distribution | Not implemented beyond contracts/fixture architecture |
| 3     | Licensed creator discovery, campaign history, transparent anomaly models and governed business contacts       | Not implemented                                       |
| 4     | Registries, filings, products, funding, hiring signals, role timelines and human-approved CRM export          | Not implemented                                       |
| 5     | Cross-source trends, semantic clusters, coordination networks and aggregate workforce intelligence            | Not implemented                                       |
| 6     | Hosted MaxJafar storage/workers, tenancy, RBAC, billing and managed providers                             | Not implemented                                       |

No roadmap connector should be inferred from a menu label, type definition,
reference card or architecture diagram. A connector is shipped only after its
source policy, credential scopes, rate limits, retention, kill switch, fixtures
and failure tests are implemented.
