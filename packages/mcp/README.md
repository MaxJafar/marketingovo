# Golem Intel MCP bridge

This package projects exactly six high-level evidence workflows from the
generated Golem Intel contracts. It intentionally omits collectors, policy
mutation, credentials, contact reveal/export, deletion, outreach and employment
decisions.

Two transports share the same server factory:

- `golem-intel-mcp` / `dist/stdio.js` for local editor and coding-agent clients;
- `golem-intel-mcp-http` / `dist/http-cli.js` for authenticated Streamable HTTP.

The HTTP bridge binds only to an explicit `127.0.0.1` origin, requires the
daemon's hardened token file and checks URL, Host, Origin and bearer credentials
before MCP dispatch. Tokens are never accepted on argv or in URLs.
