# Golem Intel intelligence worker

This process is the bounded Python analytics boundary for the Golem Intel
walking skeleton. It does not collect data, hold credentials, open network
connections, or mutate the control plane. The Go daemon gives it one verified
NDJSON spool and one output directory; the worker emits schema-exact Arrow,
Parquet, a cited report, and a hash-addressed result manifest.

## Production protocol

The Go daemon launches one worker process per analysis and sends a
`StartAnalysis` inside a `WorkerEnvelope`:

```console
uv run --project workers/intelligence python -m golem_intel_worker protocol
```

Both directions use a four-byte unsigned big-endian length followed by a
serialized Protobuf `WorkerEnvelope`. The worker streams ordered `WorkerEvent`
envelopes and then exactly one `AnalysisResult`. A concurrent `CancelAnalysis`
message interrupts slow or active Python work. Bulk evidence never crosses the
control pipe.

Generated bindings are imported from `gen/python`; the worker never carries a
handwritten or copied Protobuf contract.

## Diagnostic adapter

```console
uv run --project workers/intelligence golem-intel-worker analyze \
  --run-id demo-001 \
  --project-id demo \
  --workspace-path "$PWD" \
  --input fixtures/competitive-pulse/raw/observations.ndjson \
  --input-sha256 "$(shasum -a 256 fixtures/competitive-pulse/raw/observations.ndjson | cut -d' ' -f1)" \
  --output-dir data/runs/demo-001/worker \
  --target-id northstar-labs \
  --target-id orbit-coffee \
  --simulate none
```

The `analyze` adapter writes ordered progress events as JSON Lines to `stderr`. It writes
exactly one terminal `AnalysisResult`-compatible JSON object to `stdout`, and
persists the same object as `artifact-result.json`. Supported simulation modes
are `none`, `slow`, `source_failure`, and `corrupt_artifact`.

Security invariants:

- input and output must resolve beneath `--workspace-path`;
- symlinked input/output components, oversized files, invalid hashes,
  duplicate observation IDs, non-finite values, and unknown targets are rejected;
- all data is read once into bounded memory and analyzed from those verified bytes;
- outputs use fixed names and atomic writes with owner-only permissions;
- no report is produced when required follower or engagement evidence is absent.

See [MODEL_CARD.md](MODEL_CARD.md) for the baseline model's intended use and
limitations.
