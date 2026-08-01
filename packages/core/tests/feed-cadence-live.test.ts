import { createServer, type Server } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { collectCadenceForTarget } from "../src/integrations/feed.js";

// feed-cadence.test.ts covers parsing against a stub fetcher. This file covers
// the layer above it: the wrapper that assembles a real renderer, robots cache
// and fetcher and talks to an actual socket. That assembly is where the
// capability was previously unreachable from the runtime, so exercising it
// against a live server is the part that proves the chain is connected rather
// than merely well-typed.

const servers: Server[] = [];

async function serve(
  routes: Record<string, { status?: number; type?: string; body: string }>,
): Promise<string> {
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?", 1)[0]!;
    const route = routes[path];
    if (!route) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(route.status ?? 200, {
      "content-type": route.type ?? "text/html; charset=utf-8",
    });
    response.end(route.body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null)
    throw new Error("expected a TCP address");
  return `http://127.0.0.1:${address.port}`;
}

afterAll(async () => {
  await Promise.all(
    servers.map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

const ALLOW_ROBOTS = { body: "User-agent: *\nAllow: /\n", type: "text/plain" };

function rss(dates: readonly string[]): string {
  const items = dates
    .map(
      (date, index) =>
        `<item><title>Post ${index}</title><link>https://example.test/${index}</link><pubDate>${date}</pubDate></item>`,
    )
    .join("");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>${items}</channel></rss>`;
}

describe("cadence collection over a live socket", () => {
  it("discovers a declared feed and measures the interval", async () => {
    // Seven days apart, so the mean interval is exactly 7.
    const origin = await serve({
      "/robots.txt": ALLOW_ROBOTS,
      "/": {
        body: `<html><head><link rel="alternate" type="application/rss+xml" href="/posts.xml"></head><body>home</body></html>`,
      },
      "/posts.xml": {
        type: "application/rss+xml",
        body: rss([
          "Wed, 01 Jul 2026 00:00:00 GMT",
          "Wed, 08 Jul 2026 00:00:00 GMT",
          "Wed, 15 Jul 2026 00:00:00 GMT",
        ]),
      },
    });

    const outcome = await collectCadenceForTarget(origin, {
      privateHostAllowlist: ["127.0.0.1"],
    });

    expect(outcome.unavailable).toBeNull();
    expect(outcome.cadence?.datedItems).toBe(3);
    expect(outcome.cadence?.cadenceDays).toBeCloseTo(7, 5);
    expect(outcome.cadence?.intervals).toBe(2);
    expect(outcome.cadence?.feedUrl).toBe(`${origin}/posts.xml`);
  });

  it("falls back to a conventional path when the site declares nothing", async () => {
    const origin = await serve({
      "/robots.txt": ALLOW_ROBOTS,
      "/": { body: "<html><body>no feed link here</body></html>" },
      "/feed": {
        type: "application/rss+xml",
        body: rss([
          "Wed, 01 Jul 2026 00:00:00 GMT",
          "Fri, 03 Jul 2026 00:00:00 GMT",
        ]),
      },
    });

    const outcome = await collectCadenceForTarget(origin, {
      privateHostAllowlist: ["127.0.0.1"],
    });
    expect(outcome.cadence?.feedUrl).toBe(`${origin}/feed`);
    expect(outcome.cadence?.cadenceDays).toBeCloseTo(2, 5);
  });

  // The whole point of the named-state design: a site without a feed must not
  // read as a site that never publishes.
  it("reports a site with no feed as unavailable, not as zero", async () => {
    const origin = await serve({
      "/robots.txt": ALLOW_ROBOTS,
      "/": { body: "<html><body>nothing to see</body></html>" },
    });

    const outcome = await collectCadenceForTarget(origin, {
      privateHostAllowlist: ["127.0.0.1"],
    });
    expect(outcome.cadence).toBeNull();
    expect(outcome.unavailable).toBe("no-feed-discovered");
  });

  it("respects a robots.txt that disallows the feed", async () => {
    const origin = await serve({
      "/robots.txt": {
        type: "text/plain",
        body: "User-agent: *\nDisallow: /\n",
      },
      "/": {
        body: `<html><head><link rel="alternate" type="application/rss+xml" href="/posts.xml"></head></html>`,
      },
      "/posts.xml": {
        type: "application/rss+xml",
        body: rss(["Wed, 01 Jul 2026 00:00:00 GMT"]),
      },
    });

    const outcome = await collectCadenceForTarget(origin, {
      privateHostAllowlist: ["127.0.0.1"],
    });
    expect(outcome.cadence).toBeNull();
    expect(outcome.unavailable).not.toBeNull();
  });

  // Without an allowlist entry the loopback address is a private target, and
  // the egress guard has to refuse it. A caller that forgets the allowlist must
  // get a refusal, never a silent request.
  it("refuses a private host that was not allowlisted", async () => {
    const origin = await serve({
      "/robots.txt": ALLOW_ROBOTS,
      "/": { body: "<html><body>private</body></html>" },
    });

    const outcome = await collectCadenceForTarget(origin);
    expect(outcome.cadence).toBeNull();
    expect(outcome.unavailable).not.toBeNull();
  });
});
