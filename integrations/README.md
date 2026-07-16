# Agent integrations

All supported agent surfaces invoke the same bundled MCP server and therefore
the same six generated tool contracts. Build first with `pnpm build`.

The checked-in JSON files are portable templates; replace
`/absolute/path/to/golem-intel-main` with this repository's absolute path. To
avoid manual editing, print a ready-to-paste config with:

```bash
node scripts/render-agent-config.mjs claude-code
node scripts/render-agent-config.mjs cursor
node scripts/render-agent-config.mjs antigravity
```

The MCP process reads the service token from the operating-system-specific
Golem Intel data directory. Never copy the token into these JSON files.

For clients that require Streamable HTTP, run `golem-intel-mcp-http` (or
`packages/mcp/dist/http-cli.js`) with `--listen 127.0.0.1:<port>`, `--api-url`
and `--token-file`. The HTTP endpoint exposes the exact same six tools and
requires that token as a bearer header; stdio remains preferred when supported.
