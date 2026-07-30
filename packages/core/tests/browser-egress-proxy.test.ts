import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  createBrowserEgressProxy,
  type BrowserEgressProxy,
} from "../src/browser-egress-proxy.js";

const activeProxies: BrowserEgressProxy[] = [];
const activeServers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(activeProxies.splice(0).map((proxy) => proxy.close()));
  await Promise.all(
    activeServers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

async function localFixture(): Promise<string> {
  const server = createServer((_request, response) =>
    response.end("safe fixture"),
  );
  activeServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/proof`;
}

async function throughProxy(
  proxyUrl: string,
  target: string,
): Promise<{ status: number; body: string }> {
  const proxy = new URL(proxyUrl);
  return await new Promise((resolve, reject) => {
    const outbound = request(
      {
        hostname: proxy.hostname,
        port: Number(proxy.port),
        method: "GET",
        path: target,
        headers: { host: new URL(target).host },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outbound.once("error", reject);
    outbound.end();
  });
}

async function connectThroughProxy(
  proxyUrl: string,
  target: string,
): Promise<{ status: number; proxyAgent: string | undefined }> {
  const proxy = new URL(proxyUrl);
  const destination = new URL(target);
  return await new Promise((resolve, reject) => {
    const outbound = request({
      hostname: proxy.hostname,
      port: Number(proxy.port),
      method: "CONNECT",
      path: destination.host,
    });
    outbound.once("connect", (response, socket) => {
      const proxyAgent = response.headers["proxy-agent"];
      const result = {
        status: response.statusCode ?? 0,
        proxyAgent:
          typeof proxyAgent === "string" ? proxyAgent : proxyAgent?.[0],
      };
      socket.once("error", reject);
      socket.once("close", () => resolve(result));
      socket.end(
        `GET ${destination.pathname} HTTP/1.1\r\nHost: ${destination.host}\r\nConnection: close\r\n\r\n`,
      );
      socket.resume();
    });
    outbound.once("error", reject);
    outbound.end();
  });
}

describe("browser egress proxy", () => {
  it("blocks loopback by default", async () => {
    const target = await localFixture();
    const proxy = await createBrowserEgressProxy();
    activeProxies.push(proxy);
    expect((await throughProxy(proxy.url, target)).status).toBe(403);
  });

  it("allows only an explicitly listed private crawl host", async () => {
    const target = await localFixture();
    const proxy = await createBrowserEgressProxy({
      allowPrivate: true,
      allowedPrivateHosts: ["127.0.0.1"],
    });
    activeProxies.push(proxy);
    const response = await throughProxy(proxy.url, target);
    expect(response).toEqual({ status: 200, body: "safe fixture" });
  });

  it("identifies successful CONNECT tunnels with the canonical product name", async () => {
    const target = await localFixture();
    const proxy = await createBrowserEgressProxy({
      allowPrivate: true,
      allowedPrivateHosts: ["127.0.0.1"],
    });
    activeProxies.push(proxy);

    expect(await connectThroughProxy(proxy.url, target)).toEqual({
      status: 200,
      proxyAgent: "Marketingovo",
    });
  });

  it("always blocks cloud metadata even when private crawling is enabled", async () => {
    const proxy = await createBrowserEgressProxy({
      allowPrivate: true,
      allowedPrivateHosts: ["169.254.169.254"],
    });
    activeProxies.push(proxy);
    expect(
      (await throughProxy(proxy.url, "http://169.254.169.254/latest/meta-data"))
        .status,
    ).toBe(403);
  });
});
