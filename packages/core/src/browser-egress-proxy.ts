import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { connect, type Socket } from "node:net";
import type { Duplex } from "node:stream";
import {
  resolveSafeEgressTarget,
  resolveSafeAddresses,
  UnsafeUrlError,
} from "./core/safe-url.js";

export interface BrowserEgressProxy {
  readonly url: string;
  close(): Promise<void>;
}

export interface BrowserEgressProxyOptions {
  allowPrivate?: boolean;
  allowedPrivateHosts?: string[];
  connectTimeoutMs?: number;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "")
    .toLowerCase();
}

function parseAuthority(authority: string): { hostname: string; port: number } {
  const match = authority.match(/^\[([0-9a-f:.]+)\](?::(\d+))?$/iu);
  if (match)
    return {
      hostname: normalizeHostname(match[1]!),
      port: Number(match[2] ?? "443"),
    };
  const separator = authority.lastIndexOf(":");
  const rawHost = separator > 0 ? authority.slice(0, separator) : authority;
  const rawPort = separator > 0 ? authority.slice(separator + 1) : "443";
  const port = Number(rawPort);
  if (!rawHost || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new UnsafeUrlError("invalid proxy CONNECT authority");
  }
  return { hostname: normalizeHostname(rawHost), port };
}

function privateAccessAllowed(
  hostname: string,
  options: BrowserEgressProxyOptions,
): boolean {
  if (!options.allowPrivate) return false;
  const allowed = new Set(
    (options.allowedPrivateHosts ?? []).map(normalizeHostname),
  );
  return allowed.has(normalizeHostname(hostname));
}

function reject(
  response: ServerResponse,
  status: number,
  message: string,
): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    connection: "close",
  });
  response.end(message);
}

function rejectSocket(socket: Duplex, status: number, message: string): void {
  if (!socket.destroyed) {
    socket.end(
      `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  }
}

function proxyHeaders(
  request: IncomingMessage,
  target: URL,
): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (
      ["proxy-authorization", "proxy-connection", "connection"].includes(
        key.toLowerCase(),
      )
    )
      continue;
    headers[key] = value;
  }
  headers.host = target.host;
  headers.connection = "close";
  return headers;
}

export async function createBrowserEgressProxy(
  options: BrowserEgressProxyOptions = {},
): Promise<BrowserEgressProxy> {
  const timeoutMs = Math.max(1_000, options.connectTimeoutMs ?? 30_000);
  const server = createServer(async (request, response) => {
    try {
      if (!request.url) throw new UnsafeUrlError("missing proxy target");
      const target = new URL(request.url);
      if (target.protocol !== "http:")
        throw new UnsafeUrlError(
          "only absolute HTTP proxy requests are accepted",
        );
      if (target.username || target.password)
        throw new UnsafeUrlError(
          "URL credentials are not accepted by the proxy",
        );
      const allowPrivate = privateAccessAllowed(target.hostname, options);
      const resolved = await resolveSafeEgressTarget(
        target.toString(),
        allowPrivate,
      );
      const address = resolved.addresses[0];
      if (!address)
        throw new UnsafeUrlError("target resolved without an address");
      const upstream = httpRequest(
        {
          hostname: address.address,
          family: address.family,
          port: Number(target.port || "80"),
          method: request.method,
          path: `${target.pathname}${target.search}`,
          headers: proxyHeaders(request, target),
          timeout: timeoutMs,
        },
        (upstreamResponse) => {
          const headers = { ...upstreamResponse.headers };
          delete headers["proxy-authenticate"];
          response.writeHead(upstreamResponse.statusCode ?? 502, headers);
          upstreamResponse.pipe(response);
        },
      );
      upstream.once("timeout", () =>
        upstream.destroy(new Error("upstream timeout")),
      );
      upstream.once("error", () =>
        reject(response, 502, "Safe upstream connection failed"),
      );
      request.pipe(upstream);
    } catch (error) {
      reject(
        response,
        error instanceof UnsafeUrlError ? 403 : 502,
        "Outbound request blocked",
      );
    }
  });

  server.on("connect", (request, clientSocket, head) => {
    void (async () => {
      try {
        const { hostname, port } = parseAuthority(request.url ?? "");
        const allowPrivate = privateAccessAllowed(hostname, options);
        const addresses = await resolveSafeAddresses(hostname, allowPrivate);
        const address = addresses[0];
        if (!address)
          throw new UnsafeUrlError("target resolved without an address");
        const upstream = connect({
          host: address.address,
          family: address.family,
          port,
        });
        upstream.setTimeout(timeoutMs, () =>
          upstream.destroy(new Error("upstream timeout")),
        );
        upstream.once("connect", () => {
          clientSocket.write(
            "HTTP/1.1 200 Connection Established\r\nProxy-Agent: Marketingovo\r\n\r\n",
          );
          if (head.length > 0) upstream.write(head);
          upstream.pipe(clientSocket);
          clientSocket.pipe(upstream);
        });
        upstream.once("error", () =>
          rejectSocket(clientSocket, 502, "Bad Gateway"),
        );
        clientSocket.once("error", () => upstream.destroy());
      } catch (error) {
        rejectSocket(
          clientSocket,
          error instanceof UnsafeUrlError ? 403 : 502,
          "Forbidden",
        );
      }
    })();
  });
  server.on("upgrade", (_request, socket) =>
    rejectSocket(socket, 403, "Forbidden"),
  );
  server.on("clientError", (_error, socket) =>
    rejectSocket(socket, 400, "Bad Request"),
  );
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Browser egress proxy did not bind to loopback");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
