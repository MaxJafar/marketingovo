// Frontier: BFS queue with scope guard, dedup, and concurrency cap.
//
// Scope: only URLs whose origin and path-prefix match the start URL
// are eligible. Optionally a custom include/exclude regex narrows it.

import { normalizeUrl, type NormalizedUrl } from "./core/safe-url.js";

export interface FrontierOptions {
  startUrl: string;
  maxUrls: number;
  includePattern?: RegExp;
  excludePattern?: RegExp;
  seedUrls?: string[];
  /** Optional exact cohort. Links discovered outside this set are ignored. */
  exactUrls?: string[];
}

export interface FrontierEntry {
  url: string;
  depth: number;
  referrer: string | null;
}

export class ScopeGuard {
  private readonly start: NormalizedUrl;
  private readonly includePattern?: RegExp;
  private readonly excludePattern?: RegExp;
  private readonly exactUrls?: ReadonlySet<string>;

  constructor(
    start: NormalizedUrl,
    includePattern?: RegExp,
    excludePattern?: RegExp,
    exactUrls?: readonly string[],
  ) {
    this.start = start;
    this.includePattern = includePattern;
    this.excludePattern = excludePattern;
    this.exactUrls = exactUrls
      ? new Set(
          exactUrls.flatMap((value) => {
            try {
              return [normalizeUrl(value).href];
            } catch {
              return [];
            }
          }),
        )
      : undefined;
  }

  inScope(candidate: string): boolean {
    let parsed: NormalizedUrl;
    try {
      parsed = normalizeUrl(candidate);
    } catch {
      return false;
    }
    if (parsed.host !== this.start.host) return false;
    if (parsed.protocol !== this.start.protocol) return false;
    if (this.exactUrls && !this.exactUrls.has(parsed.href)) return false;
    if (
      !this.exactUrls &&
      !parsed.path.startsWith(this.start.path) &&
      this.start.path !== "/"
    ) {
      // If start is /, everything on the host is in scope. Otherwise
      // the path must be a prefix of the start path.
      return false;
    }
    if (this.includePattern && !this.includePattern.test(candidate)) {
      return false;
    }
    if (this.excludePattern && this.excludePattern.test(candidate)) {
      return false;
    }
    return true;
  }
}

export class Frontier {
  private readonly queue: FrontierEntry[] = [];
  private readonly visited = new Set<string>();
  private readonly maxUrls: number;
  private readonly scope: ScopeGuard;

  constructor(opts: FrontierOptions) {
    const start = normalizeUrl(opts.startUrl);
    this.maxUrls = opts.maxUrls;
    this.scope = new ScopeGuard(
      start,
      opts.includePattern,
      opts.excludePattern,
      opts.exactUrls,
    );
    this.push(opts.startUrl, 0, null);
    for (const seed of opts.seedUrls ?? []) {
      if (seed === opts.startUrl) continue;
      this.push(seed, 0, null);
    }
  }

  push(rawUrl: string, depth: number, referrer: string | null): boolean {
    let normalized: NormalizedUrl;
    try {
      normalized = normalizeUrl(rawUrl);
    } catch {
      return false;
    }
    const key = normalized.href;
    if (this.visited.has(key)) return false;
    if (this.visited.size >= this.maxUrls) return false;
    if (!this.scope.inScope(key)) return false;
    this.visited.add(key);
    this.queue.push({ url: key, depth, referrer });
    return true;
  }

  next(): FrontierEntry | null {
    return this.queue.shift() ?? null;
  }

  peek(): FrontierEntry | null {
    return this.queue[0] ?? null;
  }

  size(): number {
    return this.queue.length;
  }

  visitedCount(): number {
    return this.visited.size;
  }

  has(url: string): boolean {
    try {
      return this.visited.has(normalizeUrl(url).href);
    } catch {
      return false;
    }
  }

  remainingCapacity(): number {
    return Math.max(0, this.maxUrls - this.visited.size);
  }
}
