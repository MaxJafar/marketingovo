import { readFile } from "node:fs/promises";
import createClient from "openapi-fetch";
import type { paths } from "./generated/openapi.js";
import {
  DEFAULT_LOCAL_API_BASE_URL,
  validateLocalApiBaseUrl,
} from "./local-api.js";

export interface GeneratedAgentSeoClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Create the complete low-level client generated from the runtime OpenAPI
 * document. The ergonomic AgentSeoClient remains the recommended workflow
 * surface; this client exposes every documented route without weakening the
 * localhost credential boundary.
 */
export function createGeneratedAgentSeoClient(
  options: GeneratedAgentSeoClientOptions = {},
) {
  const apiBaseUrl = validateLocalApiBaseUrl(
    options.baseUrl ?? DEFAULT_LOCAL_API_BASE_URL,
  );
  const origin = apiBaseUrl.slice(0, -"/api/v1".length);
  const expectedOrigin = new URL(origin).origin;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const guardedFetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const destination = new URL(request.url);
    if (
      destination.origin !== expectedOrigin ||
      !(
        destination.pathname === "/api/v1" ||
        destination.pathname.startsWith("/api/v1/")
      )
    ) {
      throw new Error(
        "Generated Marketingovo client refused a non-local API destination",
      );
    }
    const headers = new Headers(request.headers);
    if (options.token) {
      headers.set("authorization", `Bearer ${options.token}`);
    }
    return fetchImpl(
      new Request(request, {
        headers,
        redirect: "error",
      }),
    );
  };

  return createClient<paths>({ baseUrl: origin, fetch: guardedFetch });
}

export async function createGeneratedAgentSeoClientFromTokenFile(
  path: string,
  options: Omit<GeneratedAgentSeoClientOptions, "token"> = {},
) {
  const baseUrl = validateLocalApiBaseUrl(
    options.baseUrl ?? DEFAULT_LOCAL_API_BASE_URL,
  );
  const token = (await readFile(path, "utf8")).trim();
  if (!token) throw new Error("Marketingovo service token file is empty");
  return createGeneratedAgentSeoClient({ ...options, baseUrl, token });
}

export type AgentSeoOpenApiPaths = paths;
