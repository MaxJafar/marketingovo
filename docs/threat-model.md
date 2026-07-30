# Threat model

This threat model covers the implemented local walking skeleton. Controls
needed by future live connectors are release gates, not claims about Phase 1.

## Assets

- the persistent local service token and one-time dashboard ticket;
- public, first-party and eventually licensed evidence with rights metadata;
- run integrity, immutable input snapshots, citations and audit history;
- future masked business contacts and suppression state;
- the local machine and networks reachable from it.

## Adversaries and failure sources

- a malicious local process calling the loopback daemon;
- a malformed input, artifact descriptor or worker output;
- a compromised or buggy signed worker;
- an untrusted developer-supplied Python worker running as the same user;
- hostile URLs, redirects, DNS answers and prompt injection once live collection
  exists;
- accidental inclusion of quarantined reference code or credentials;
- a model or user requesting a purpose outside approved policy.

## Controls present in Phase 1

1. The daemon binds exact IPv4 loopback, validates the Host/Origin boundary and
   requires a random bearer token or an HttpOnly dashboard session. The CLI
   accepts a mode-`0600` token file; plaintext `--token` is rejected.
2. The dashboard exchanges a distinct one-time fragment ticket for a session,
   removes the fragment and keeps its CSRF value in memory. Managed launches
   pass the ticket over bounded stdin; the ticket is not a daemon argument.
3. The only collector is an offline synthetic fixture with reserved `.invalid`
   URLs. Phase 1 therefore does not make a live-source egress claim.
4. The daemon treats files proposed by Python as untrusted output and applies
   its implemented path containment, non-symlink/regular-file, size, hash,
   allowlisted contract, row/time, data-class, report and evidence checks before
   publication. A worker declaration alone cannot make a report queryable.
5. Runs record an immutable input hash/schema/size and derivation versions.
   Replay verifies and reuses that recorded snapshot rather than silently
   recollecting a mutable source.
6. Reference snapshots are excluded from build inputs and product source
   references. Secret scanning reports path and rule identifiers only; it never
   emits matching values or snippets.
7. The default agent projection exposes six workflow-level read/start tools. It
   does not expose contact reveal/export, outreach, deletion, policy mutation or
   employment decisions.

## Trusted worker and residual risk

The packaged Python runtime is trusted product code. The Rust desktop boundary
is responsible for verifying a signed private runtime snapshot and handing Go
the exact absolute, non-symlink interpreter through `--python-command`. Go still
validates protocol messages and artifacts as defense in depth.

Developer mode uses a pinned `uv` project, isolated Python flags, a minimal
environment and a per-run working directory. Those measures are not an
operating-system sandbox. A malicious same-user process can attempt to read
other same-user files or open sockets independently of the Go daemon. Therefore:

- never point `--python-worker` or `--python-command` at untrusted code;
- do not describe the current worker as network-isolated or filesystem-confined;
- do not enable third-party transforms until an OS/container/Wasm sandbox with
  explicit mounts, egress denial, limits and kill semantics exists.

Output validation protects the evidence lake; it does not by itself protect the
host from arbitrary worker code.

## Gates before live connectors or hosted operation

- exact-host egress mediation, DNS rebinding protection, redirect revalidation,
  private/link-local/metadata denial and connector-scoped credentials;
- content type/size limits, parser isolation and prompt-injection handling;
- durable job leases, heartbeats, checkpoints, dead-letter handling and tested
  reconciliation across filesystem publication and SQLite finalization;
- retention, suppression and deletion propagation through indexes, derivatives,
  exports and backups;
- canary-secret scanning across databases, logs, Arrow, Parquet, reports and
  release bundles;
- tenant isolation, RBAC and provider-budget enforcement for MaxJafar;
- signed release provenance and an exercised updater rollback path.

## Explicit non-goals

The default product does not bypass access controls, evade bot defenses,
enumerate private accounts, ingest breach data, perform biometric matching,
infer protected traits, deanonymize people, conduct outreach or automate
employment decisions. Public reachability is not treated as permission. Model
output is a derived claim, never source evidence or authorization.
