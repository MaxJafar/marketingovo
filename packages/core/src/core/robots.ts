// robots.txt loader + checker. Cached per host, fetched via the same
// fetcher so DNS resolution and SSRF guard apply.

import RobotsParser from "robots-parser";
import type { Renderer, RenderOptions, RenderedPage } from "../renderer.js";

type Robot = ReturnType<typeof RobotsParser>;

export class RobotsCache {
  private readonly cache = new Map<string, Robot | null>();
  private readonly renderer: Renderer;
  private readonly userAgent: string;
  private readonly policy: Pick<
    RenderOptions,
    | "allowPrivate"
    | "privateHostAllowlist"
    | "enforcePrivateHostAllowlist"
    | "signal"
  >;

  constructor(
    renderer: Renderer,
    userAgent: string,
    policy: Partial<
      Pick<
        RenderOptions,
        | "allowPrivate"
        | "privateHostAllowlist"
        | "enforcePrivateHostAllowlist"
        | "signal"
      >
    > = {},
  ) {
    this.renderer = renderer;
    this.userAgent = userAgent;
    this.policy = { allowPrivate: false, ...policy };
  }

  /**
   * Get the parsed robots.txt for a host (origin). Returns null if the
   * file could not be fetched or parsed; absence of robots.txt is
   * treated as "everything allowed".
   */
  async get(origin: string): Promise<Robot | null> {
    const key = origin.toLowerCase();
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }
    const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
    let result: RenderedPage;
    try {
      const opts: RenderOptions = {
        timeoutMs: 10000,
        maxBodyBytes: 256 * 1024,
        userAgent: this.userAgent,
        ...this.policy,
      };
      result = await this.renderer.render(robotsUrl, opts);
    } catch {
      this.policy.signal?.throwIfAborted();
      this.cache.set(key, null);
      return null;
    }
    if (result.status >= 400) {
      this.cache.set(key, null);
      return null;
    }
    const text = result.body.toString("utf8");
    const parser = RobotsParser(robotsUrl, text);
    this.cache.set(key, parser);
    return parser;
  }

  /**
   * Returns true if the URL is allowed for our user agent. If robots
   * cannot be fetched, default to allow.
   */
  async isAllowed(url: string): Promise<boolean> {
    let origin: string;
    try {
      const u = new URL(url);
      origin = u.origin;
    } catch {
      return false;
    }
    const parser = await this.get(origin);
    if (!parser) return true;
    return parser.isAllowed(url, this.userAgent) ?? true;
  }

  clear(): void {
    this.cache.clear();
  }
}
