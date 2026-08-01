#!/usr/bin/env node
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { join } from "node:path";
import { AgentIntelClient, validateLoopbackBaseUrl } from "@agentintel/sdk";
import {
  defaultAgentIntelDataDirectory,
  readServiceTokenFile,
} from "@agentintel/sdk/node";
import {
  createAuthorizedMcpFetch,
  createAgentIntelMcpHttpHandler,
} from "./http.js";

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

interface HttpArguments {
  listen: string;
  apiUrl: string;
  tokenFile: string;
}

function argumentsFrom(argv: string[]): HttpArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      !name?.startsWith("--") ||
      value === undefined ||
      value.startsWith("--")
    ) {
      throw new Error(
        "Expected --listen, --api-url, and --token-file value pairs.",
      );
    }
    if (!new Set(["--listen", "--api-url", "--token-file"]).has(name)) {
      throw new Error(`Unsupported option ${name}.`);
    }
    if (values.has(name)) throw new Error(`Duplicate option ${name}.`);
    values.set(name, value);
  }
  const listen = values.get("--listen") ?? "127.0.0.1:7467";
  const origin = validateLoopbackBaseUrl(`http://${listen}`);
  return {
    listen: new URL(origin).host,
    apiUrl: validateLoopbackBaseUrl(
      values.get("--api-url") ?? "http://127.0.0.1:7465",
    ),
    tokenFile:
      values.get("--token-file") ??
      join(defaultAgentIntelDataDirectory(), "service-token"),
  };
}

async function bodyFrom(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function webRequest(
  incoming: IncomingMessage,
  origin: string,
  body: Buffer | undefined,
): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value))
      value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return new Request(new URL(incoming.url ?? "/", origin), {
    method: incoming.method,
    headers,
    ...(body && body.length > 0 ? { body: Uint8Array.from(body) } : {}),
  });
}

async function writeResponse(
  response: Response,
  outgoing: ServerResponse,
): Promise<void> {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));
  if (!response.body) {
    outgoing.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!outgoing.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => outgoing.once("drain", resolve));
      }
    }
    outgoing.end();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function main(): Promise<void> {
  const args = argumentsFrom(process.argv.slice(2));
  const origin = `http://${args.listen}`;
  const token = await readServiceTokenFile(args.tokenFile);
  const client = new AgentIntelClient({ baseUrl: args.apiUrl, token });
  const handler = createAgentIntelMcpHttpHandler(client);
  const fetchMcp = createAuthorizedMcpFetch(handler, { origin, token });
  const [hostname, portText] = args.listen.split(":");
  const port = Number(portText);
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      try {
        const body = await bodyFrom(incoming);
        await writeResponse(
          await fetchMcp(webRequest(incoming, origin, body)),
          outgoing,
        );
      } catch (error) {
        const tooLarge =
          error instanceof Error && error.message === "request_too_large";
        await writeResponse(
          Response.json(
            {
              type: "about:blank",
              title: tooLarge ? "request_too_large" : "internal_error",
              status: tooLarge ? 413 : 500,
            },
            { status: tooLarge ? 413 : 500 },
          ),
          outgoing,
        );
      }
    })();
  });
  const shutdown = (): void => {
    server.close(() => void handler.close().finally(() => process.exit(0)));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.listen(port, hostname, () => {
    process.stdout.write(`MCP: ${origin}/mcp\n`);
  });
}

main().catch((error) => {
  process.stderr.write(
    `agentintel-mcp-http: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
