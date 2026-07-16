// Web Vitals collector. Runs a real Chromium page through JS-render
// path, instruments it with PerformanceObserver, and reports LCP,
// CLS, TTFB, FCP. Implemented inline (no npm dep) to keep the
// dependency surface small.

import type { WebVitals } from "./checks/index.js";
import type { Renderer } from "./renderer.js";

// Inlined measurement script. Uses PerformanceObserver to record
// LCP/CLS/FCP and the Navigation Timing API for TTFB.
const VITALS_SCRIPT = `
(() => {
  const result = {
    lcp: null,
    cls: 0,
    ttfb: null,
    fcp: null,
    pageWeightBytes: 0,
  };
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      result.ttfb = Math.max(0, nav.responseStart - nav.requestStart);
      let total = 0;
      for (const r of performance.getEntriesByType("resource")) {
        total += r.transferSize || r.encodedBodySize || 0;
      }
      result.pageWeightBytes = total;
    } else {
      const t = performance.timing;
      if (t) result.ttfb = Math.max(0, t.responseStart - t.requestStart);
    }
  } catch (e) {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          result.fcp = entry.startTime;
        }
      }
    }).observe({ type: "paint", buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) result.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          result.cls += entry.value || 0;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {}
  return new Promise((resolve) => {
    setTimeout(() => {
      result.cls = Math.round(result.cls * 10000) / 10000;
      resolve(result);
    }, 1500);
  });
})();
`;

export async function collectWebVitals(
  renderer: Renderer,
  url: string,
  userAgent: string,
  timeoutMs = 30_000,
  allowPrivate = false,
  privateHostAllowlist: string[] = [],
  signal?: AbortSignal,
  enforcePrivateHostAllowlist = false,
): Promise<WebVitals | null> {
  if (!renderer.withLivePage) return null;
  const handle = await renderer.withLivePage(url, {
    userAgent,
    timeoutMs,
    maxBodyBytes: 1, // not used
    allowPrivate,
    privateHostAllowlist,
    enforcePrivateHostAllowlist,
    signal,
  });
  try {
    const result = (await handle.evaluate(VITALS_SCRIPT)) as WebVitals;
    return result;
  } catch {
    return null;
  } finally {
    await handle.close().catch(() => {});
  }
}
