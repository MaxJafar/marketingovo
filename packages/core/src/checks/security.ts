// Security checks: missing HSTS, missing CSP, missing X-Content-Type-Options,
// mixed content (http resource on https page), http URLs reachable.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

const REQUIRED_SECURITY_HEADERS = [
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "content-security-policy",
  "referrer-policy",
];

export const securityChecks: CheckFn[] = [
  function missingSecurityHeaders(index: CrawlIndex): Issue[] {
    const missingByHeader = new Map<string, string[]>();
    for (const p of index.pages.values()) {
      if (p.status !== 200) continue;
      for (const h of REQUIRED_SECURITY_HEADERS) {
        if (!p.headers[h]) {
          const arr = missingByHeader.get(h) ?? [];
          arr.push(p.url);
          missingByHeader.set(h, arr);
        }
      }
    }
    const issues: Issue[] = [];
    for (const [header, urls] of missingByHeader) {
      issues.push({
        id: `header-missing-${header}`,
        category: "Security",
        priority: "Low",
        message: `Header "${header}" missing on ${urls.length} URL(s).`,
        urls,
      });
    }
    return issues;
  },

  function mixedContent(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (!p.url.startsWith("https://")) continue;
      let bad = false;
      for (const img of p.parsed.images) {
        if (img.src.startsWith("http://")) bad = true;
      }
      for (const link of p.parsed.internalLinks) {
        if (link.startsWith("http://")) bad = true;
      }
      for (const link of p.parsed.externalLinks) {
        if (link.startsWith("http://")) bad = true;
      }
      if (bad) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "mixed-content",
        category: "Security",
        priority: "High",
        message: `${urls.length} HTTPS page(s) load http:// resources.`,
        urls,
      },
    ];
  },
];
