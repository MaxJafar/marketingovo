# Local quick start

Run commands from the repository root. The daemon accepts only exact IPv4
loopback listeners.

## Build

```bash
pnpm install
UV_CACHE_DIR=.agentintel/cache/uv uv sync --project workers/intelligence --frozen
pnpm contracts:generate
pnpm build
go build -o bin/agentinteld ./cmd/agentinteld
go build -o bin/agentintel ./cmd/agentintel
```

`pnpm contracts:generate` requires `buf`, `protoc-gen-go`, and the workspace
`protoc-gen-es`. Generated Go, Python and TypeScript bindings are committed.
`pnpm contracts:lint` regenerates them into a temporary directory, compares the
result byte-for-byte, and validates representative OpenAPI response samples.

## Start in developer mode

```bash
./bin/agentinteld serve \
  --listen 127.0.0.1:7465 \
  --data-dir .agentintel/dev \
  --python-worker "$(pwd)/workers/intelligence" \
  --uv-command "$(command -v uv)" \
  --dashboard-dir "$(pwd)/apps/dashboard/dist" \
  --fixture "$(pwd)/fixtures/competitive-pulse/raw/observations.ndjson"
```

When `--python-command` is absent, the daemon launches the pinned worker with
`uv run --frozen --offline --no-sync`. This mode is for local development. The
worker gets a minimal environment and a per-run working directory, and all
outputs remain subject to Go validation, but the process still runs as your
operating-system user. It has no OS-level filesystem or network sandbox.

The daemon creates the data directory with private permissions, creates or
loads a mode-`0600` service token and prints one `Dashboard:` URL. When no
bootstrap flag is supplied, the daemon generates the one-time dashboard ticket
internally. The dashboard removes the fragment after exchanging it for an
HttpOnly same-site session.

## Packaged or managed launch

The desktop package treats its signed Go and Python sidecars as trusted release
components. It verifies a private runtime snapshot, passes the exact absolute
non-symlink Python executable, and sends the distinct dashboard ticket only on
stdin. A manual managed launch has the same argument shape:

```bash
BOOTSTRAP_TICKET="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=[:space:]')"
test "${#BOOTSTRAP_TICKET}" -eq 43
printf '%s\n' "$BOOTSTRAP_TICKET" | ./bin/agentinteld serve \
  --listen 127.0.0.1:7465 \
  --data-dir /absolute/private/agentintel-data \
  --python-worker /absolute/verified/python-worker \
  --python-command /absolute/non-symlink/verified/python \
  --dashboard-bootstrap-token-stdin \
  --dashboard-dir /absolute/verified/dashboard \
  --fixture /absolute/verified/observations.ndjson
unset BOOTSTRAP_TICKET
```

The placeholder interpreter must be the exact executable in the verified
runtime, not a `python` command name, shell wrapper, virtual-environment symlink
or path that traverses a symlink. The daemon does not itself turn an arbitrary
manual interpreter into a signed component; release signing and snapshot
verification are owned by the Rust packaging boundary. The legacy
`--dashboard-bootstrap-token` argument and plaintext CLI `--token` argument are
intentionally rejected.

## Run the golden comparison

```bash
./bin/agentintel \
  --token-file .agentintel/dev/service-token \
  compare \
  --project competitive-pulse-demo \
  --target northstar-labs \
  --target orbit-coffee \
  --target vertex-studio \
  --wait
```

The terminal result contains a run id. Read the report or replay the recorded
immutable input snapshot:

```bash
./bin/agentintel --token-file .agentintel/dev/service-token report RUN_ID
./bin/agentintel --token-file .agentintel/dev/service-token replay RUN_ID
```

A research run uses the same synthetic fixture in Phase 1; `source-budget` is a
hard scope bound, not a claim that the uncollected slots were used:

```bash
./bin/agentintel --token-file .agentintel/dev/service-token research \
  --project competitive-pulse-demo \
  --question "How did the monitored public engagement signals change?" \
  --source-budget 4 \
  --target northstar-labs \
  --target orbit-coffee \
  --wait
```

## Exercise failure semantics

Use a separate project/data directory for destructive acceptance checks.

```bash
./bin/agentintel --token-file .agentintel/dev/service-token compare \
  --target northstar-labs --target orbit-coffee \
  --simulate source_failure --wait

./bin/agentintel --token-file .agentintel/dev/service-token compare \
  --target northstar-labs --target orbit-coffee \
  --simulate corrupt_artifact --wait

./bin/agentintel --token-file .agentintel/dev/service-token compare \
  --target northstar-labs --target orbit-coffee \
  --simulate slow
./bin/agentintel --token-file .agentintel/dev/service-token cancel \
  --reason "acceptance test" RUN_ID
```

Source failure must terminate without a committed report. Corruption must be
rejected by the Go authority even if the worker declares success. Cancellation
must terminate the supervised worker and persist a `cancelled` run.

## Agent surfaces

- Codex bundle: `plugins/codex/agentintel`
- MCP stdio binary: `packages/mcp/dist/stdio.js`
- authenticated loopback Streamable HTTP binary:
  `packages/mcp/dist/http-cli.js`
- OpenClaw adapter: `adapters/openclaw`
- ready-to-paste config: `node scripts/render-agent-config.mjs cursor`

Agent processes read the persistent service token from the platform data
directory. The dashboard ticket is never an agent credential. Stdio remains
the simplest local integration. To expose the same six tools over
Streamable HTTP, bind the bridge to exact IPv4 loopback and point it at the
daemon's hardened token file:

```bash
node packages/mcp/dist/http-cli.js \
  --listen 127.0.0.1:7467 \
  --api-url http://127.0.0.1:7465 \
  --token-file .agentintel/dev/service-token
```

The endpoint is `http://127.0.0.1:7467/mcp`. It requires the service token in an
`Authorization: Bearer` header, rejects non-loopback URL/Host/Origin values,
redirects and query-bearing endpoints, and never accepts a token argument.

## Protobuf compatibility

`buf.yaml` enables `FILE` compatibility rules, and the repository provides a
fail-closed gate:

```bash
BUF_BREAKING_AGAINST=/absolute/path/to/a/released/buf-baseline \
  pnpm contracts:breaking
```

There is no released baseline in this initial workspace, so this command is not
part of `pnpm check` yet. Without an explicit baseline it exits with an error
instead of treating `buf lint` as a compatibility comparison.
