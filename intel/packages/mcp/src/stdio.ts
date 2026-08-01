#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createAgentIntelMcpServer } from "./index.js";

async function main(): Promise<void> {
  const server = await createAgentIntelMcpServer();
  const transport = new StdioServerTransport();
  process.once(
    "SIGINT",
    () => void server.close().finally(() => process.exit(0)),
  );
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `agentintel-mcp: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
