import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { StaticRenderer, JsRenderer, createRenderer } from "../src/renderer.js";
import type { Limits } from "../src/core/limits.js";

const LIMITS: Limits = {
  maxUrls: 5,
  maxRuntimeMs: 5000,
  maxConcurrency: 1,
  requestsPerSecond: 100,
  requestTimeoutMs: 5000,
  maxBodyBytes: 1024 * 1024,
  maxRedirects: 1,
  userAgent: "screaming-claw-test",
  allowPrivate: false,
  ignoreRobots: false,
  renderMode: "static",
  customHeaders: {},
};

let server: Server;
let externalServer: Server;
let baseUrl: string;
let externalBaseUrl: string;
let externalHeaders: Record<string, string | string[] | undefined> = {};

beforeAll(async () => {
  externalServer = createServer((req, res) => {
    externalHeaders = req.headers;
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      "<html><head><title>External</title></head><body>external</body></html>",
    );
  });
  await new Promise<void>((resolve) =>
    externalServer.listen(0, "127.0.0.1", resolve),
  );
  const externalAddr = externalServer.address();
  if (externalAddr && typeof externalAddr === "object") {
    externalBaseUrl = `http://127.0.0.1:${externalAddr.port}`;
  }

  server = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/final" });
      res.end();
      return;
    }
    if (req.url === "/redirect-cross-origin") {
      res.writeHead(302, { location: `${externalBaseUrl}/landing` });
      res.end();
      return;
    }
    if (req.url === "/final") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        "<html><head><title>Final</title></head><body>final</body></html>",
      );
      return;
    }
    if (req.url === "/browser-cross-origin") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<html><body><img src="${externalBaseUrl}/pixel"></body></html>`);
      return;
    }
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        "<html><head><title>Hello</title></head><body><h1>Hello</h1><p>Static</p></body></html>",
      );
      return;
    }
    if (req.url === "/spa") {
      // Client-side rendered. Static fetch sees no title; JS render
      // sees the rendered output.
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<!doctype html><html><head><script>document.title='Rendered';</script></head><body><h1 id="root">Booting</h1><script>setTimeout(()=>{document.getElementById('root').textContent='Ready'}, 80);</script></body></html>`,
      );
      return;
    }
    res.writeHead(404);
    res.end("nope");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr && typeof addr === "object") {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => externalServer.close(() => resolve()));
});

describe("StaticRenderer", () => {
  it("fetches a page and reports status, content-type, body", async () => {
    const r = new StaticRenderer();
    const out = await r.render(`${baseUrl}/`, {
      timeoutMs: 5000,
      maxBodyBytes: 1024 * 1024,
      userAgent: "test",
      allowPrivate: true,
    });
    expect(out.status).toBe(200);
    expect(out.contentType).toContain("text/html");
    expect(out.body.toString("utf8")).toContain("<title>Hello</title>");
    expect(out.renderMode).toBe("static");
    await r.close();
  }, 10000);

  it("reports 404 with the right status", async () => {
    process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
    const r = new StaticRenderer();
    const out = await r.render(`${baseUrl}/missing`, {
      timeoutMs: 5000,
      maxBodyBytes: 1024 * 1024,
      userAgent: "test",
      allowPrivate: true,
    });
    expect(out.status).toBe(404);
    await r.close();
  }, 10000);

  it("validates and follows every redirect hop", async () => {
    const r = new StaticRenderer();
    const out = await r.render(`${baseUrl}/redirect`, {
      timeoutMs: 5000,
      maxBodyBytes: 1024 * 1024,
      userAgent: "test",
      allowPrivate: true,
      maxRedirects: 2,
    });
    expect(out.status).toBe(200);
    expect(out.finalUrl).toBe(`${baseUrl}/final`);
    expect(out.redirectChain).toEqual([`${baseUrl}/final`]);
    await r.close();
  });

  it("does not forward configured credentials across origins", async () => {
    externalHeaders = {};
    const r = new StaticRenderer();
    const out = await r.render(`${baseUrl}/redirect-cross-origin`, {
      timeoutMs: 5000,
      maxBodyBytes: 1024 * 1024,
      userAgent: "test",
      allowPrivate: true,
      headers: {
        authorization: "Bearer secret",
        cookie: "session=secret",
        "x-private-header": "secret",
      },
    });
    expect(out.status).toBe(200);
    expect(externalHeaders.authorization).toBeUndefined();
    expect(externalHeaders.cookie).toBeUndefined();
    expect(externalHeaders["x-private-header"]).toBeUndefined();
    await r.close();
  });
});

describe("createRenderer", () => {
  it("returns a static renderer by default", async () => {
    process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
    const r = await createRenderer("static", LIMITS);
    expect(r.mode).toBe("static");
    await r.close();
  });

  it("returns a JS renderer when requested and playwright is installed", async () => {
    process.env.SCREAMINGCLAW_ALLOW_PRIVATE = "1";
    try {
      const r = await createRenderer("js", LIMITS);
      expect(r.mode).toBe("js");
      const out = await r.render(`${baseUrl}/spa`, {
        timeoutMs: 10000,
        maxBodyBytes: 1024 * 1024,
        userAgent: "test",
        allowPrivate: true,
        waitUntil: "networkidle",
      });
      // After JS runs, the document title was changed to "Rendered".
      expect(out.body.toString("utf8")).toContain("<title>Rendered</title>");
      expect(out.renderMode).toBe("js");
      await r.close();
    } catch (err) {
      // Playwright chromium not installed in this env; skip.
      if (
        (err as Error).message.includes("playwright") ||
        (err as Error).message.includes("chromium")
      ) {
        return;
      }
      throw err;
    }
  }, 30000);

  it("does not forward browser credentials to cross-origin subresources", async () => {
    externalHeaders = {};
    try {
      const r = await createRenderer("js", { ...LIMITS, allowPrivate: true });
      await r.render(`${baseUrl}/browser-cross-origin`, {
        timeoutMs: 10000,
        maxBodyBytes: 1024 * 1024,
        userAgent: "test",
        allowPrivate: true,
        waitUntil: "networkidle",
        headers: {
          authorization: "Bearer secret",
          cookie: "session=secret",
          "x-private-header": "secret",
        },
      });
      expect(externalHeaders.authorization).toBeUndefined();
      expect(externalHeaders.cookie).toBeUndefined();
      expect(externalHeaders["x-private-header"]).toBeUndefined();
      await r.close();
    } catch (err) {
      if (
        (err as Error).message.includes("playwright") ||
        (err as Error).message.includes("chromium")
      )
        return;
      throw err;
    }
  }, 30000);
});

// Reference the import to silence "unused" in case of skip path.
void JsRenderer;
