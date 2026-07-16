// Renderer abstraction. v0.1 used undici + linkedom (static HTML).
// v0.2 adds JsRenderer (Playwright Chromium) for SPA / JS-heavy sites.
//
// The interface is intentionally small: given a URL, return the final
// HTML after rendering plus the response metadata. Both renderers
// share the same SSRF guard, scope guard, rate limit, and audit
// pipeline. The orchestrator only sees `RenderedPage`.
//
// Why a separate module: the fetcher is a thin HTTP client. The
// renderer owns *how* the body is produced. Decoupling them means we
// can add JSDOM, raw-curl, or proxy modes later without touching
// the orchestrator.

import {
  resolveSafeEgressTarget,
  normalizeUrl,
  UnsafeUrlError,
} from "./core/safe-url.js";
import type { Limits } from "./core/limits.js";
import {
  createBrowserEgressProxy,
  type BrowserEgressProxy,
} from "./browser-egress-proxy.js";
import { resolveChromiumExecutablePath } from "./chromium-runtime.js";

export interface RenderOptions {
  timeoutMs: number;
  maxBodyBytes: number;
  userAgent: string;
  allowPrivate: boolean;
  /** Exact private hosts allowed in addition to the initial crawl host. */
  privateHostAllowlist?: string[];
  /** Do not implicitly trust the initial host when an allowlist policy is supplied. */
  enforcePrivateHostAllowlist?: boolean;
  // For JS rendering, wait until the page is "networkidle" or until
  // a selector appears. Static renderer ignores these.
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  waitForSelector?: string;
  viewport?: { width: number; height: number };
  // Custom headers from crawl config.
  headers?: Record<string, string>;
  // Redirect cap. Every hop is independently validated by the egress guard.
  maxRedirects?: number;
  /** Cancels network and browser work when the owning run is cancelled. */
  signal?: AbortSignal;
}

export interface RenderedPage {
  finalUrl: string;
  status: number;
  contentType: string;
  body: Buffer;
  responseTimeMs: number;
  headers: Record<string, string>;
  renderMode: "static" | "js";
  redirectChain?: string[];
}

export interface LivePageHandle {
  url: string;
  evaluate<T>(
    fn: string | ((...args: unknown[]) => T),
    ...args: unknown[]
  ): Promise<T>;
  close(): Promise<void>;
}

export interface Renderer {
  readonly mode: "static" | "js";
  render(url: string, opts: RenderOptions): Promise<RenderedPage>;
  withLivePage?(url: string, opts: RenderOptions): Promise<LivePageHandle>;
  close(): Promise<void>;
}

const FORBIDDEN_CUSTOM_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const TRACKER_RE =
  /google-analytics\.com|googletagmanager\.com|doubleclick\.net|hotjar\.com|segment\.io|mixpanel\.com|facebook\.net\/tr|fullstory\.com/;

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("Operation cancelled");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError(signal);
}

async function withAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) return operation;
  throwIfAborted(signal);
  let onAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([operation, cancelled]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}

function originOf(rawUrl: string): string {
  return new URL(rawUrl).origin;
}

function hostnameOf(rawUrl: string): string {
  return new URL(rawUrl).hostname
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "")
    .toLowerCase();
}

function privateHostAllowed(
  requestUrl: string,
  initialUrl: string,
  opts: RenderOptions,
): boolean {
  if (!opts.allowPrivate) return false;
  const hostname = hostnameOf(requestUrl);
  const allowed = new Set([
    ...(opts.enforcePrivateHostAllowlist ? [] : [hostnameOf(initialUrl)]),
    ...(opts.privateHostAllowlist ?? []).map((host) =>
      host
        .replace(/^\[|\]$/gu, "")
        .replace(/\.$/u, "")
        .toLowerCase(),
    ),
  ]);
  return allowed.has(hostname);
}

function scopedCustomHeaders(
  configured: Record<string, string> | undefined,
  requestUrl: string,
  credentialOrigin: string,
): Record<string, string> {
  if (!configured || originOf(requestUrl) !== credentialOrigin) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(configured)) {
    if (!FORBIDDEN_CUSTOM_HEADERS.has(key.toLowerCase())) out[key] = value;
  }
  return out;
}

function removeConfiguredHeaders(
  headers: Record<string, string>,
  configured: Record<string, string> | undefined,
): void {
  const remove = new Set(
    Object.keys(configured ?? {}).map((key) => key.toLowerCase()),
  );
  // These credentials must never be inherited by a cross-origin redirect
  // or subresource, even if Chromium happened to retain them internally.
  remove.add("authorization");
  remove.add("proxy-authorization");
  remove.add("cookie");
  for (const key of Object.keys(headers)) {
    if (remove.has(key.toLowerCase())) delete headers[key];
  }
}

async function installSafeBrowserRouting(
  page: import("playwright").Page,
  initialUrl: string,
  opts: RenderOptions,
): Promise<void> {
  const credentialOrigin = originOf(normalizeUrl(initialUrl).href);
  await page.route("**/*", async (route) => {
    if (opts.signal?.aborted) {
      await route.abort("aborted");
      return;
    }
    const requestUrl = route.request().url();
    if (TRACKER_RE.test(requestUrl)) {
      await route.abort("blockedbyclient");
      return;
    }
    try {
      await resolveSafeEgressTarget(
        requestUrl,
        privateHostAllowed(requestUrl, initialUrl, opts),
      );
    } catch {
      await route.abort("blockedbyclient");
      return;
    }

    const headers = { ...route.request().headers() };
    if (originOf(requestUrl) === credentialOrigin) {
      Object.assign(
        headers,
        scopedCustomHeaders(opts.headers, requestUrl, credentialOrigin),
      );
    } else {
      removeConfiguredHeaders(headers, opts.headers);
    }
    await route.continue({ headers });
  });
}

async function readBody(
  body: NodeJS.ReadableStream & { destroy?: () => void },
  maxBodyBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise<Buffer>((resolve, reject) => {
    body.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        body.destroy?.();
        reject(new FetchError(`body exceeds ${maxBodyBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    body.on("end", () => resolve(Buffer.concat(chunks)));
    body.on("error", (err: Error) =>
      reject(new FetchError(`body error: ${err.message}`)),
    );
  });
}

export class StaticRenderer implements Renderer {
  readonly mode = "static" as const;
  // Per-host persistent dispatcher cache. Re-using connections
  // shaves a TCP/TLS handshake off every request after the first
  // to the same origin. Bounded so long-running crawls don't leak
  // sockets; LRU evicts the oldest entry on overflow.
  private readonly dispatchers = new Map<string, import("undici").Agent>();

  private async getDispatcher(
    hostKey: string,
    address: { address: string; family: 4 | 6 },
    timeoutMs: number,
  ): Promise<import("undici").Agent> {
    const cacheKey = `${hostKey}|${address.family}|${address.address}|${timeoutMs}`;
    const cached = this.dispatchers.get(cacheKey);
    if (cached) return cached;
    const undici = await import("undici");
    const d = new undici.Agent({
      connect: {
        timeout: timeoutMs,
        // Keep the original URL for TLS SNI and certificate verification, but
        // pin the socket to the address that passed the egress policy.
        lookup: ((
          _hostname: string,
          _options: unknown,
          callback: (
            error: Error | null,
            result: string,
            family: number,
          ) => void,
        ) => {
          callback(null, address.address, address.family);
        }) as never,
      },
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
      // No redirect interceptor is installed. Redirects stay in the manual
      // loop below so every destination is independently SSRF-validated.
      pipelining: 1,
    });
    if (this.dispatchers.size >= 32) {
      // LRU-ish: drop the first key.
      const first = this.dispatchers.keys().next().value;
      if (first) {
        this.dispatchers.get(first)?.close();
        this.dispatchers.delete(first);
      }
    }
    this.dispatchers.set(cacheKey, d);
    return d;
  }

  async render(url: string, opts: RenderOptions): Promise<RenderedPage> {
    const start = Date.now();
    const credentialOrigin = originOf(normalizeUrl(url).href);
    const initialUrl = normalizeUrl(url).href;
    const redirectChain: string[] = [];
    const maxRedirects = Math.max(0, opts.maxRedirects ?? 5);
    let currentUrl = url;

    for (let redirectCount = 0; ; redirectCount += 1) {
      throwIfAborted(opts.signal);
      const target = await resolveSafeEgressTarget(
        currentUrl,
        privateHostAllowed(currentUrl, initialUrl, opts),
      );
      const normalized = target.url;
      const address = target.addresses[0];
      if (!address) {
        throw new UnsafeUrlError(`no usable address for ${normalized.host}`);
      }
      const undici = await import("undici");
      const hostKey = `${normalized.protocol}//${normalized.host}`;
      const dispatcher = await this.getDispatcher(
        hostKey,
        address,
        opts.timeoutMs,
      );
      const headers: Record<string, string> = {
        "user-agent": opts.userAgent,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.5",
        ...scopedCustomHeaders(opts.headers, normalized.href, credentialOrigin),
        host: normalized.host,
      };
      let response: Awaited<ReturnType<typeof undici.request>>;
      try {
        response = await undici.request(normalized.href, {
          method: "GET",
          headers,
          dispatcher,
          bodyTimeout: opts.timeoutMs,
          headersTimeout: opts.timeoutMs,
          ...(opts.signal ? { signal: opts.signal } : {}),
        });
      } catch (err) {
        throw new FetchError(`network error: ${(err as Error).message}`);
      }

      const locationHeader = response.headers.location;
      const location = Array.isArray(locationHeader)
        ? locationHeader[0]
        : locationHeader;
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        typeof location === "string"
      ) {
        // Consume the redirect response cleanly so undici can reuse the
        // socket without emitting an unhandled AbortError.
        await readBody(response.body, opts.maxBodyBytes);
        if (redirectCount >= maxRedirects) {
          throw new FetchError(`too many redirects (>${maxRedirects})`);
        }
        currentUrl = new URL(location, normalized.href).toString();
        // The next loop validates and DNS-pins this hop before connecting.
        redirectChain.push(currentUrl);
        continue;
      }

      const body = await readBody(response.body, opts.maxBodyBytes);
      const headerObj: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === "string") headerObj[key] = value;
        else if (Array.isArray(value)) headerObj[key] = value.join(", ");
      }
      return {
        finalUrl: normalized.href,
        status: response.statusCode,
        contentType: String(response.headers["content-type"] ?? ""),
        body,
        responseTimeMs: Date.now() - start,
        headers: headerObj,
        renderMode: "static",
        redirectChain,
      };
    }
  }

  async close(): Promise<void> {
    for (const d of this.dispatchers.values()) {
      try {
        d.close();
      } catch {
        // ignore
      }
    }
    this.dispatchers.clear();
  }
}

export class JsRenderer implements Renderer {
  readonly mode = "js" as const;
  private readonly browsers = new Map<
    string,
    {
      browser: import("playwright").Browser;
      proxy: BrowserEgressProxy;
    }
  >();
  private readonly limits: Limits;
  // We cap the JS pool to a small number of contexts to avoid OOM.
  private readonly maxContexts: number;

  constructor(limits: Limits, maxContexts = 2) {
    this.limits = limits;
    this.maxContexts = maxContexts;
  }

  private async ensureBrowser(
    initialUrl: string,
    opts: RenderOptions,
  ): Promise<import("playwright").Browser> {
    const privateHosts = opts.allowPrivate
      ? [
          ...(opts.enforcePrivateHostAllowlist ? [] : [hostnameOf(initialUrl)]),
          ...(opts.privateHostAllowlist ?? []).map((host) =>
            host.toLowerCase(),
          ),
        ]
      : [];
    const policyKey = `${opts.allowPrivate ? "private" : "public"}:${[...new Set(privateHosts)].sort().join(",")}`;
    const existing = this.browsers.get(policyKey);
    if (existing) return existing.browser;
    // Dynamic import so the dependency is truly optional.
    const { chromium } = await import("playwright");
    const executablePath = await resolveChromiumExecutablePath();
    const proxy = await createBrowserEgressProxy({
      allowPrivate: opts.allowPrivate,
      allowedPrivateHosts: privateHosts,
      connectTimeoutMs: opts.timeoutMs,
    });
    try {
      const browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        proxy: { server: proxy.url },
        args: [
          "--disable-background-networking",
          "--disable-component-update",
          "--disable-quic",
          "--disable-sync",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
          "--webrtc-ip-handling-policy=disable_non_proxied_udp",
        ],
        // The browser executes untrusted pages. Disabling Chromium's sandbox is
        // therefore not a supported runtime mode, including for diagnostics.
        chromiumSandbox: true,
      });
      this.browsers.set(policyKey, { browser, proxy });
      return browser;
    } catch (error) {
      await proxy.close();
      throw error;
    }
  }

  async render(url: string, opts: RenderOptions): Promise<RenderedPage> {
    const start = Date.now();
    throwIfAborted(opts.signal);
    // Validate the top-level navigation before Chromium is started. The
    // route handler below repeats this for redirects and subresources.
    await resolveSafeEgressTarget(url, privateHostAllowed(url, url, opts));
    const browser = await this.ensureBrowser(url, opts);
    const context = await browser.newContext({
      userAgent: opts.userAgent,
      viewport: opts.viewport ?? { width: 1366, height: 768 },
      ignoreHTTPSErrors: false,
      // Service workers can serve or initiate requests outside page.route.
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await installSafeBrowserRouting(page, url, opts);
    let response;
    try {
      response = await withAbort(
        page.goto(url, {
          timeout: opts.timeoutMs,
          waitUntil: opts.waitUntil ?? "networkidle",
        }),
        opts.signal,
      );
      if (opts.waitForSelector) {
        await withAbort(
          page.waitForSelector(opts.waitForSelector, {
            timeout: opts.timeoutMs,
          }),
          opts.signal,
        );
      }
    } catch (err) {
      await context.close().catch(() => {});
      throw new FetchError(`js render failed: ${(err as Error).message}`);
    }
    const html = await page.content();
    const body = Buffer.from(html, "utf8");
    let truncated = false;
    if (body.length > opts.maxBodyBytes) {
      truncated = true;
    }
    const finalUrl = page.url();
    const status = response?.status() ?? 0;
    const contentType = "text/html; charset=utf-8";
    await context.close().catch(() => {});
    return {
      finalUrl,
      status: truncated ? 0 : status, // 0 = too large; mapped to "no response" later
      contentType,
      body: truncated ? body.subarray(0, opts.maxBodyBytes) : body,
      responseTimeMs: Date.now() - start,
      headers: {},
      renderMode: "js",
      redirectChain: [],
    };
  }

  async close(): Promise<void> {
    for (const { browser, proxy } of this.browsers.values()) {
      await browser.close().catch(() => {});
      await proxy.close().catch(() => {});
    }
    this.browsers.clear();
  }

  async withLivePage(
    url: string,
    opts: RenderOptions,
  ): Promise<LivePageHandle> {
    throwIfAborted(opts.signal);
    await resolveSafeEgressTarget(url, privateHostAllowed(url, url, opts));
    const browser = await this.ensureBrowser(url, opts);
    const context = await browser.newContext({
      userAgent: opts.userAgent,
      viewport: opts.viewport ?? { width: 1366, height: 768 },
      ignoreHTTPSErrors: false,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await installSafeBrowserRouting(page, url, opts);
    try {
      await withAbort(
        page.goto(url, {
          timeout: opts.timeoutMs,
          waitUntil: opts.waitUntil ?? "networkidle",
        }),
        opts.signal,
      );
    } catch (err) {
      await context.close().catch(() => {});
      throw new FetchError(`js live page failed: ${(err as Error).message}`);
    }
    return {
      url: page.url(),
      async evaluate(fn, ...args) {
        if (typeof fn === "string") {
          return (await page.evaluate(fn, ...args)) as never;
        }
        return (await page.evaluate(fn, ...args)) as never;
      },
      async close() {
        await context.close().catch(() => {});
      },
    };
  }
}

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

export async function createRenderer(
  mode: "static" | "js",
  limits: Limits,
): Promise<Renderer> {
  if (mode === "js") {
    try {
      await import("playwright");
    } catch {
      throw new Error(
        "JS rendering requested but `playwright` is not installed. " +
          "Install with: npm install playwright && npx playwright install chromium",
      );
    }
    return new JsRenderer(limits);
  }
  return new StaticRenderer();
}
