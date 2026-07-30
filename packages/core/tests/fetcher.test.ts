import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  agents: [] as Array<{
    options: Record<string, unknown>;
    close: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("undici", () => ({
  Agent: class {
    readonly close = vi.fn();

    constructor(readonly options: Record<string, unknown>) {
      mocks.agents.push(this);
    }
  },
  request: mocks.request,
}));

import { Fetcher } from "../src/fetcher.js";
import type { Limits } from "../src/core/limits.js";

const limits: Limits = {
  maxUrls: 10,
  maxRuntimeMs: 10_000,
  maxConcurrency: 2,
  requestsPerSecond: 2,
  requestTimeoutMs: 5_000,
  maxBodyBytes: 1_024,
  maxRedirects: 2,
  userAgent: "Marketingovo/test",
  allowPrivate: false,
  ignoreRobots: false,
  renderMode: "static",
  customHeaders: {},
  keepRawHtml: false,
};

describe("Fetcher DNS pinning", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.agents.length = 0;
  });

  it("keeps the original HTTPS hostname for SNI while pinning its safe IP", async () => {
    mocks.request.mockResolvedValue({
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: Readable.from([Buffer.from("<h1>ok</h1>")]),
    });
    const fetcher = new Fetcher(limits);
    const result = await fetcher.fetchRaw("https://example.com/path?q=1", {
      maxBodyBytes: 1_024,
      acceptAnyStatus: false,
    });

    expect(result.status).toBe(200);
    expect(mocks.request).toHaveBeenCalledWith(
      "https://example.com/path?q=1",
      expect.objectContaining({ method: "GET" }),
    );
    const connect = mocks.agents[0]?.options.connect as {
      lookup: (
        hostname: string,
        options: unknown,
        callback: (
          error: Error | null,
          address: string,
          family: number,
        ) => void,
      ) => void;
    };
    const pinned = await new Promise<{ address: string; family: number }>(
      (resolve, reject) => {
        connect.lookup("example.com", {}, (error, address, family) => {
          if (error) reject(error);
          else resolve({ address, family });
        });
      },
    );
    expect(pinned).toEqual({ address: "93.184.216.34", family: 4 });
    fetcher.close();
    expect(mocks.agents[0]?.close).toHaveBeenCalledOnce();
  });
});
