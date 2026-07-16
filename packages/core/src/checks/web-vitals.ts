// Web Vitals check: flags pages whose Core Web Vitals exceed the
// "Good" thresholds. Thresholds are Google's official "needs
// improvement" cutoffs (75th percentile).
//
//   LCP <= 2500ms good, <= 4000ms poor
//   CLS <= 0.1   good, <= 0.25   poor
//   TTFB <= 800ms good
//   FCP <= 1800ms good

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

const LCP_NEEDS_IMPROVEMENT = 2500;
const LCP_POOR = 4000;
const CLS_NEEDS_IMPROVEMENT = 0.1;
const CLS_POOR = 0.25;
const TTFB_NEEDS_IMPROVEMENT = 800;
const FCP_NEEDS_IMPROVEMENT = 1800;

export const webVitalsChecks: CheckFn[] = [
  function lcpPoor(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    const samples: Array<{ url: string; lcp: number }> = [];
    for (const p of index.pages.values()) {
      const lcp = p.vitals?.lcp;
      if (typeof lcp !== "number") continue;
      if (lcp > LCP_POOR) {
        urls.push(p.url);
        if (samples.length < 3) samples.push({ url: p.url, lcp });
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "vitals-lcp-poor",
        category: "Performance",
        priority: "High",
        message: `${urls.length} page(s) have LCP > ${LCP_POOR}ms (poor).`,
        urls,
        detail: { samples },
      },
    ];
  },

  function lcpNeedsImprovement(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      const lcp = p.vitals?.lcp;
      if (typeof lcp !== "number") continue;
      if (lcp > LCP_NEEDS_IMPROVEMENT && lcp <= LCP_POOR) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "vitals-lcp-needs-improvement",
        category: "Performance",
        priority: "Medium",
        message: `${urls.length} page(s) have LCP between ${LCP_NEEDS_IMPROVEMENT}ms and ${LCP_POOR}ms (needs improvement).`,
        urls,
      },
    ];
  },

  function clsPoor(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      const cls = p.vitals?.cls;
      if (typeof cls !== "number") continue;
      if (cls > CLS_POOR) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "vitals-cls-poor",
        category: "Performance",
        priority: "High",
        message: `${urls.length} page(s) have CLS > ${CLS_POOR} (poor).`,
        urls,
      },
    ];
  },

  function clsNeedsImprovement(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      const cls = p.vitals?.cls;
      if (typeof cls !== "number") continue;
      if (cls > CLS_NEEDS_IMPROVEMENT && cls <= CLS_POOR) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "vitals-cls-needs-improvement",
        category: "Performance",
        priority: "Medium",
        message: `${urls.length} page(s) have CLS between ${CLS_NEEDS_IMPROVEMENT} and ${CLS_POOR} (needs improvement).`,
        urls,
      },
    ];
  },

  function ttfbSlow(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      const ttfb = p.vitals?.ttfb;
      if (typeof ttfb !== "number") continue;
      if (ttfb > TTFB_NEEDS_IMPROVEMENT) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "vitals-ttfb-slow",
        category: "Performance",
        priority: "Low",
        message: `${urls.length} page(s) have TTFB > ${TTFB_NEEDS_IMPROVEMENT}ms.`,
        urls,
      },
    ];
  },

  function fcpSlow(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      const fcp = p.vitals?.fcp;
      if (typeof fcp !== "number") continue;
      if (fcp > FCP_NEEDS_IMPROVEMENT) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "vitals-fcp-slow",
        category: "Performance",
        priority: "Low",
        message: `${urls.length} page(s) have FCP > ${FCP_NEEDS_IMPROVEMENT}ms.`,
        urls,
      },
    ];
  },
];
