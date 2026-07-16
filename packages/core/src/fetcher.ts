// Fetcher: bounded HTTP client with timeout, size cap, redirect policy,
// and DNS-pinning to mitigate SSRF / DNS-rebinding.
//
// We resolve the host ourselves (via safe-url.resolveSafeAddresses) and
// connect to the resolved IP, but set the original Host header so the
// target sees a normal virtual-host request. Subsequent redirects are
// re-validated through the same pipeline.

import { request as undiciRequest, Agent } from "undici";
import {
  resolveSafeAddresses,
  normalizeUrl,
  ensureSameHostOrAllowed,
  UnsafeUrlError,
  type NormalizedUrl,
} from "./core/safe-url.js";
import type { Limits } from "./core/limits.js";

export interface FetchOptions {
  maxBodyBytes: number;
  acceptAnyStatus: boolean;
  allowCrossHostRedirect?: boolean;
}

export interface FetchResult {
  status: number;
  url: string;
  finalUrl: string;
  contentType: string;
  body: Buffer;
  responseTimeMs: number;
  headers: Record<string, string>;
}

export class FetchAbortedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "FetchAbortedError";
  }
}

export class Fetcher {
  private readonly limits: Limits;
  private readonly dispatchers = new Map<string, Agent>();

  constructor(limits: Limits) {
    this.limits = limits;
  }

  private getDispatcher(
    hostKey: string,
    address: { address: string; family: 4 | 6 },
  ): Agent {
    const cacheKey = `${hostKey}|${address.family}|${address.address}`;
    const cached = this.dispatchers.get(cacheKey);
    if (cached) return cached;
    const dispatcher = new Agent({
      connect: {
        timeout: this.limits.requestTimeoutMs,
        // Keep the original hostname in the request URL so TLS uses the
        // correct SNI/certificate name, while pinning the socket to the IP
        // address that passed the SSRF policy.
        lookup: ((
          _hostname: string,
          _options: unknown,
          callback: (
            error: Error | null,
            result: string,
            family: number,
          ) => void,
        ) => callback(null, address.address, address.family)) as never,
      },
      bodyTimeout: this.limits.requestTimeoutMs,
      headersTimeout: this.limits.requestTimeoutMs,
      // Redirects remain manual so every hop is resolved and checked again.
      pipelining: 1,
    });
    if (this.dispatchers.size >= 32) {
      const oldest = this.dispatchers.keys().next().value;
      if (oldest) {
        this.dispatchers.get(oldest)?.close();
        this.dispatchers.delete(oldest);
      }
    }
    this.dispatchers.set(cacheKey, dispatcher);
    return dispatcher;
  }

  async fetchRaw(rawUrl: string, opts: FetchOptions): Promise<FetchResult> {
    return this.fetchWithRedirects(rawUrl, opts, 0);
  }

  private async fetchWithRedirects(
    rawUrl: string,
    opts: FetchOptions,
    redirectCount: number,
  ): Promise<FetchResult> {
    const start = Date.now();
    const normalized = normalizeUrl(rawUrl);
    // Re-validate every hop. resolveSafeAddresses also handles
    // IP-literal inputs.
    const addresses = await resolveSafeAddresses(
      normalized.host,
      this.limits.allowPrivate,
    );
    const address = addresses[0];
    if (!address) {
      throw new UnsafeUrlError(`no usable address for ${normalized.host}`);
    }
    const hostKey = `${normalized.protocol}//${normalized.host}`;
    const dispatcher = this.getDispatcher(hostKey, address);
    const headers: Record<string, string> = {
      "user-agent": this.limits.userAgent,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
      "accept-language": "en-US,en;q=0.5",
      host: normalized.host,
    };
    let response: Awaited<ReturnType<typeof undiciRequest>>;
    try {
      response = await undiciRequest(normalized.href, {
        method: "GET",
        headers,
        dispatcher,
        bodyTimeout: this.limits.requestTimeoutMs,
        headersTimeout: this.limits.requestTimeoutMs,
      });
    } catch (err) {
      throw new FetchAbortedError(`network error: ${(err as Error).message}`);
    }
    try {
      const locationHeader = response.headers.location;
      const location = Array.isArray(locationHeader)
        ? locationHeader[0]
        : locationHeader;
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        typeof location === "string"
      ) {
        if (redirectCount >= this.limits.maxRedirects) {
          throw new FetchAbortedError(
            `too many redirects (>${this.limits.maxRedirects})`,
          );
        }
        const nextUrl = new URL(location, rawUrl).toString();
        // Validate next hop.
        const next = normalizeUrl(nextUrl);
        ensureSameHostOrAllowed(
          normalized,
          next,
          opts.allowCrossHostRedirect === true,
        );
        // Consume body to free the socket.
        await bodyToBuffer(response.body, opts.maxBodyBytes);
        return this.fetchWithRedirects(nextUrl, opts, redirectCount + 1);
      }
      if (response.statusCode >= 400 && !opts.acceptAnyStatus) {
        await bodyToBuffer(response.body, opts.maxBodyBytes);
        throw new FetchAbortedError(`status ${response.statusCode}`);
      }
      const body = await bodyToBuffer(response.body, opts.maxBodyBytes);
      const contentType = String(response.headers["content-type"] ?? "");
      const headerObj: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (typeof v === "string") headerObj[k] = v;
        else if (Array.isArray(v)) headerObj[k] = v.join(", ");
      }
      return {
        status: response.statusCode,
        url: rawUrl,
        finalUrl: rawUrl,
        contentType,
        body,
        responseTimeMs: Date.now() - start,
        headers: headerObj,
      };
    } finally {
      // body already consumed; nothing else to release.
      // We don't track sockets here, undici handles it via dispatcher.
      void normalized; // mark used
    }
  }

  close(): void {
    for (const dispatcher of this.dispatchers.values()) dispatcher.close();
    this.dispatchers.clear();
  }
}

type DestroyableReadableStream = NodeJS.ReadableStream & {
  destroy?: () => void;
};

async function bodyToBuffer(
  body: DestroyableReadableStream,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise<Buffer>((resolve, reject) => {
    body.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        if (typeof body.destroy === "function") body.destroy();
        reject(new FetchAbortedError(`body exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    body.on("end", () => resolve(Buffer.concat(chunks)));
    body.on("error", (err) =>
      reject(new FetchAbortedError(`body error: ${err.message}`)),
    );
  });
}
