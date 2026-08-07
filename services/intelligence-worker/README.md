# Marketingovo intelligence worker

This process is the bounded Python analytics boundary for the Marketingovo
walking skeleton. On the `protocol` and `analyze` paths it does not collect
data, hold credentials, open network connections, or mutate the control
plane. The Go daemon gives it one verified NDJSON spool and one output
directory; the worker emits schema-exact Arrow, Parquet, a cited report, and
a hash-addressed result manifest.

The one deliberate exception is the operator-invoked `trends` subcommand
below, which reaches Google Trends and nothing else.

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

## Trends research (pytrends)

```console
uv run --project services/intelligence-worker marketingovo-worker trends \
  --keyword "pixel art" --keyword "retro branding" \
  --timeframe "today 12-m" --geo ""
```

The one network-enabled adapter in this package, and only when the operator
runs it themselves — the `protocol` and `analyze` paths cannot reach it.
[pytrends](https://github.com/GeneralMills/pytrends) reads the public Google
Trends UI endpoints, which are not an official API; that is the same
ToS-grey ground the product's TypeScript trends integration stands on, and
the emitted document says so in its `policy` field. No credential is
involved and the only egress is to Google Trends for the exact keywords
supplied.

The output is one canonical-JSON `marketingovo.trends-research.v1` document
on stdout: per keyword, Google's 0–100 relative interest series with the
still-filling current bucket dropped, an average, momentum and a monthly
slope in the same vocabulary as the TypeScript integration, a
growing/steady/declining verdict, and top/rising related queries. A keyword
Google returned nothing for is `no-data` with its reason; a blocked or
throttled request is `unavailable` with the error text; neither is ever a
row of zeros. The command exits 0 even when everything was unavailable,
because on an offline machine the stated reasons are the honest answer.

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
