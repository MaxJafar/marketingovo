import { timingSafeEqual } from "node:crypto";
import {
  createMcpHandler,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import {
  type AgentIntelClient,
  validateLoopbackBaseUrl,
} from "@agentintel/sdk";
import { validateServiceToken } from "@agentintel/sdk/node";
import { createAgentIntelMcpServer } from "./index.js";

export interface AuthorizedMcpHttpOptions {
  origin: string;
  token: string;
  path?: string;
}

function problem(status: number, code: string, detail: string): Response {
  return Response.json(
    { type: "about:blank", title: code, status, code, detail },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json",
      },
    },
  );
}

function bearerMatches(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export function createAgentIntelMcpHttpHandler(
  client: AgentIntelClient,
): McpHttpHandler {
  return createMcpHandler(() => createAgentIntelMcpServer({ client }), {
    legacy: "stateless",
    responseMode: "auto",
  });
}

export function createAuthorizedMcpFetch(
  handler: McpHttpHandler,
  options: AuthorizedMcpHttpOptions,
): (request: Request) => Promise<Response> {
  const origin = validateLoopbackBaseUrl(options.origin);
  const token = validateServiceToken(options.token);
  const endpointPath = options.path ?? "/mcp";
  if (
    !endpointPath.startsWith("/") ||
    endpointPath.includes("?") ||
    endpointPath.includes("#")
  ) {
    throw new TypeError(
      "MCP endpoint path must be an absolute path without query or fragment",
    );
  }
  const expected = new URL(origin);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const host = request.headers.get("host");
    const browserOrigin = request.headers.get("origin");
    if (
      url.origin !== origin ||
      url.pathname !== endpointPath ||
      url.search !== "" ||
      url.hash !== "" ||
      host !== expected.host ||
      (browserOrigin !== null && browserOrigin !== origin)
    ) {
      return problem(
        403,
        "loopback_origin_rejected",
        "MCP request origin was rejected.",
      );
    }
    if (!bearerMatches(request.headers.get("authorization"), token)) {
      return new Response(
        JSON.stringify({
          type: "about:blank",
          title: "unauthorized",
          status: 401,
          code: "unauthorized",
          detail: "A valid local bearer token is required.",
        }),
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/problem+json",
            "WWW-Authenticate": "Bearer",
          },
        },
      );
    }
    return handler.fetch(request);
  };
}
