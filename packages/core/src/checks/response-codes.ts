// Response code checks: 4xx, 5xx, redirect loops, redirect chains,
// blocked by robots, no response.

import type { CheckFn, CrawlIndex, Issue, CrawledPage } from "./index.js";

export const responseCodeChecks: CheckFn[] = [
  function internalClientError4xx(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (
        p.status >= 400 &&
        p.status < 500 &&
        p.status !== 401 &&
        p.status !== 403
      ) {
        urls.push(p.url);
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "internal-4xx",
        category: "Response Codes",
        priority: "High",
        message: `${urls.length} URL(s) return 4xx status codes.`,
        urls,
      },
    ];
  },

  function internalServerError5xx(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status >= 500 && p.status < 600) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "internal-5xx",
        category: "Response Codes",
        priority: "High",
        message: `${urls.length} URL(s) return 5xx status codes.`,
        urls,
      },
    ];
  },

  function internalRedirectLoop(index: CrawlIndex): Issue[] {
    // Detected via redirectChain length anomaly. We treat chains of
    // 5+ hops to the same host as suspicious; an actual loop is
    // usually caught by the fetcher as a network error.
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      const seen = new Set<string>();
      let loop = false;
      for (const hop of p.redirectChain) {
        if (seen.has(hop)) {
          loop = true;
          break;
        }
        seen.add(hop);
      }
      if (loop) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "internal-redirect-loop",
        category: "Response Codes",
        priority: "High",
        message: `${urls.length} URL(s) participate in a redirect loop.`,
        urls,
      },
    ];
  },

  function longRedirectChain(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.redirectChain.length >= 3) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "internal-redirect-chain",
        category: "Response Codes",
        priority: "Medium",
        message: `${urls.length} URL(s) redirect through 3+ hops.`,
        urls,
      },
    ];
  },

  function noResponse(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.error && (p.status === 0 || p.status === undefined)) {
        urls.push(p.url);
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "internal-no-response",
        category: "Response Codes",
        priority: "High",
        message: `${urls.length} URL(s) produced no response.`,
        urls,
        detail: { sampleErrors: collectErrors(index) },
      },
    ];
  },
];

function collectErrors(index: CrawlIndex): string[] {
  const out: string[] = [];
  for (const p of index.pages.values()) {
    if (p.error) out.push(p.error);
    if (out.length >= 5) break;
  }
  return out;
}
