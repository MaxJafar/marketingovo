# Marketingovo intelligence worker

This process is the bounded Python analytics boundary for the Marketingovo
walking skeleton. It does not collect data, hold credentials, open network
connections, or mutate the control plane. The Go daemon gives it one verified
NDJSON spool and one output directory; the worker emits schema-exact Arrow,
Parquet, a cited report, and a hash-addressed result manifest.

## Production protocol

The Go daemon launches one worker process per analysis and sends a
`StartAnalysis` inside a `WorkerEnvelope`:

```console
uv run --project workers/intelligence python -m marketingovo_worker protocol
```

Both directions use a four-byte unsigned big-endian length followed by a
serialized Protobuf `WorkerEnvelope`. The worker streams ordered `WorkerEvent`
envelopes and then exactly one `AnalysisResult`. A concurrent `CancelAnalysis`
message interrupts slow or active Python work. Bulk evidence never crosses the
control pipe.

Generated bindings are imported from `gen/python`; the worker never carries a
handwritten or copied Protobuf contract.

### Competitive Pulse CSV v1

`ValidateImport` and imported `StartAnalysis` requests share one fail-closed
parser for `marketingovo.competitive-pulse-import.v1`. The parser is
`marketingovo-python-competitive-pulse-csv@1.0.0`; imported analytics use
`competitive-pulse.v1` and emit `marketingovo.comparison-report.v2`. Preview binds the
exact lowercase SHA-256 and authority-supplied whole-second `validated_at`.
Analysis additionally requires the matching dataset, parser, and metric catalog
in `StartAnalysis.import_context`.

The boundary accepts exactly the frozen 22-column header, at most 10,000 data
records, and at most 65,536 encoded bytes per record. It never evaluates
formulas, trims values, follows paths, opens citations, or substitutes defaults
for missing values. Accepted rows normalize to the unchanged
`marketingovo.observations.v1` Arrow schema in `(target_id, observed_at,
observation_id)` order. Missing and contradictory evidence is represented by
metric availability states and metric-scoped canonical observation IDs, not by
zero fill or source-order selection.

## Diagnostic adapter

```console
uv run --project workers/intelligence marketingovo-worker analyze \
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
- legacy fixture reports fail when their required evidence is absent; imported
  reports instead preserve explicit missing, insufficient, or contradictory
  metric states.

See [MODEL_CARD.md](MODEL_CARD.md) for the baseline model's intended use and
limitations.
