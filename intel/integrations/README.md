# Agent integrations

Every supported agent surface invokes the same MCP server and therefore the same
six generated tool contracts. All manifests in this directory, plus the plugin
bundles under `plugins/`, are generated from `@agentintel/contracts` by
`pnpm plugins:generate`. Do not hand-edit them — `pnpm validate:plugins` fails on
drift.

## Installable plugin bundles

| Host        | Path                        | Install                                                      |
| ----------- | --------------------------- | ------------------------------------------------------------ |
| Claude Code | `plugins/claude/agentintel` | Add this repository as a plugin marketplace, then install it |
| Codex       | `plugins/codex/agentintel`  | Install the bundle directory                                 |
| OpenClaw    | `adapters/openclaw`         | Load `openclaw.plugin.json`                                  |

The Claude Code bundle also ships slash commands (`/intel-research`,
`/intel-compare`, `/intel-evidence`, `/intel-status`) and the
`intelligence-researcher` skill. Both plugin bundles copy that skill from the
single source in `plugins/shared/skills/`.

## Plain MCP clients

`cursor.mcp.json`, `vscode.mcp.json`, `claude-code.mcp.json`,
`antigravity.mcp.json`, and `generic.mcp.json` are ready to use as written: they
resolve the MCP bridge through the package manager rather than an absolute path,
so there is nothing to substitute.

If you would rather run the bridge from a local build, print a config pointing at
this checkout:

```bash
node scripts/render-agent-config.mjs claude-code
```

Build first with `pnpm build` when using a local path.

## Credentials

The MCP process reads the service token from the operating-system-specific
AGENTintel data directory. Never copy the token into these JSON files.

## Streamable HTTP

For clients that require HTTP rather than stdio, run `agentintel-mcp-http` (or
`packages/mcp/dist/http-cli.js`) with `--listen 127.0.0.1:<port>`, `--api-url`
and `--token-file`. The HTTP endpoint exposes the exact same six tools and
requires that token as a bearer header; stdio remains preferred when supported.
