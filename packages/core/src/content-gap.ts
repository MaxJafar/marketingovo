// CLI: content_gap. Walks <targetUrl> + <ref1> <ref2> ...
// (positional, in argv). For each: fetch with the bounded Fetcher
// (SSRF-safe, DNS-pinned) or the JS renderer (Playwright, for SPAs),
// extract main content, build TF-IDF, compute the gap report.
// Emit JSON / MD to stdout.

import { Fetcher } from "./fetcher.js";
import { createRenderer, type Renderer } from "./renderer.js";
import { extractMainContent } from "./integrations/content-extract.js";
import {
  buildVector,
  computeContentGap,
  type ContentGapReport,
} from "./integrations/content-gap.js";
import {
  AGENTSEO_DEFAULT_USER_AGENT,
  loadLimits,
  type Limits,
} from "./core/limits.js";

export interface ContentGapCliOptions {
  targetUrl: string;
  referenceUrls: string[];
  /** Top-N missing terms. Default 20. */
  topN: number;
  /** Per-doc fetch timeout. */
  timeoutMs: number;
  /** Per-doc max body size in bytes. */
  maxBodyBytes: number;
  /** Allow private/loopback addresses (SSRF off). Off by default. */
  allowPrivate: boolean;
  /** Use a JS renderer (Playwright) for SPAs. Off by default. */
  renderMode: "static" | "js";
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BODY = 2_621_440; // 2.5 MB

export async function runContentGap(
  opts: ContentGapCliOptions,
): Promise<ContentGapReport> {
  const base = loadLimits();
  const limits: Limits = {
    ...base,
    requestTimeoutMs: opts.timeoutMs || DEFAULT_TIMEOUT_MS,
    maxBodyBytes: opts.maxBodyBytes || DEFAULT_MAX_BODY,
    allowPrivate: !!opts.allowPrivate,
  };
  const fetcher = new Fetcher(limits);
  const errors: string[] = [];
  const renderer: Renderer | null =
    opts.renderMode === "js" ? await tryCreateJsRenderer(limits, errors) : null;
  try {
    const target = await fetchAndExtract(
      fetcher,
      renderer,
      opts.targetUrl,
      errors,
    );
    if (!target) {
      return {
        targetUrl: opts.targetUrl,
        referenceUrls: opts.referenceUrls,
        targetWordCount: 0,
        referenceWordCounts: opts.referenceUrls.map(() => 0),
        missing: [],
        perReference: [],
        errors,
      };
    }
    const references = [];
    for (const refUrl of opts.referenceUrls) {
      const r = await fetchAndExtract(fetcher, renderer, refUrl, errors);
      if (r) references.push(r);
    }
    return computeContentGap(target, references, { topN: opts.topN });
  } finally {
    if (renderer) await renderer.close().catch(() => undefined);
  }
}

async function tryCreateJsRenderer(
  limits: Limits,
  errors: string[],
): Promise<Renderer | null> {
  try {
    return await createRenderer("js", limits);
  } catch (err) {
    errors.push(`JS renderer unavailable: ${(err as Error).message}`);
    return null;
  }
}

async function fetchAndExtract(
  fetcher: Fetcher,
  renderer: Renderer | null,
  url: string,
  errors: string[],
): Promise<{
  url: string;
  doc: ReturnType<typeof extractMainContent>;
  vector: ReturnType<typeof buildVector>;
} | null> {
  let html: string | null = null;
  let status = 0;
  try {
    if (renderer) {
      const page = await renderer.render(url, {
        timeoutMs: 30_000,
        maxBodyBytes: 2_621_440,
        userAgent: AGENTSEO_DEFAULT_USER_AGENT,
        allowPrivate: false,
        waitUntil: "networkidle",
      });
      status = page.status;
      html = page.body.toString("utf8");
    } else {
      const res = await fetcher.fetchRaw(url, {
        maxBodyBytes: 2_621_440,
        acceptAnyStatus: true,
      });
      status = res.status;
      html = res.body.toString("utf8");
    }
  } catch (err) {
    errors.push(`${url}: ${(err as Error).message}`);
    return null;
  }
  if (status >= 400) {
    errors.push(`${url}: HTTP ${status}`);
    return null;
  }
  const doc = extractMainContent(html);
  if (doc.wordCount < 30) {
    errors.push(
      `${url}: extracted only ${doc.wordCount} words (likely JS-only or empty page)`,
    );
  }
  return { url, doc, vector: buildVector(doc) };
}

export function contentGapToJson(report: ContentGapReport): string {
  return JSON.stringify(report, null, 2);
}

export function contentGapToMarkdown(report: ContentGapReport): string {
  const lines: string[] = [];
  lines.push(`# Content gap analysis`);
  lines.push("");
  lines.push(
    `- **Target:** ${report.targetUrl} (${report.targetWordCount} words)`,
  );
  lines.push(`- **References (${report.referenceUrls.length}):**`);
  for (let i = 0; i < report.referenceUrls.length; i += 1) {
    const wc = report.referenceWordCounts[i] ?? 0;
    lines.push(`  ${i + 1}. ${report.referenceUrls[i]} (${wc} words)`);
  }
  lines.push("");
  if (report.errors.length > 0) {
    lines.push("> **Errors:**");
    for (const e of report.errors) lines.push(`> - ${e}`);
    lines.push("");
  }
  if (report.missing.length === 0) {
    lines.push(
      "No missing terms detected (target covers the references well, or inputs too small).",
    );
    return lines.join("\n");
  }
  lines.push(`## Top ${report.missing.length} missing terms`);
  lines.push("");
  lines.push(
    `Sorted by gap score = refFreq × (refDensity - targetDensity) × 1000. Higher = more clearly missing.`,
  );
  lines.push("");
  lines.push(`| # | Term | Refs | Ref density | Target density | Score |`);
  lines.push(`|--:|------|----:|------------:|----------------:|------:|`);
  for (let i = 0; i < report.missing.length; i += 1) {
    const m = report.missing[i]!;
    lines.push(
      `| ${i + 1} | \`${m.term}\` | ${m.refFreq}/${report.referenceUrls.length} | ${(m.refDensity * 100).toFixed(2)}% | ${(m.targetDensity * 100).toFixed(2)}% | ${m.score.toFixed(1)} |`,
    );
  }
  lines.push("");
  lines.push(`## Per-reference coverage of these terms`);
  lines.push("");
  lines.push(`| Reference | Matched |`);
  lines.push(`|-----------|--------:|`);
  for (const r of report.perReference) {
    lines.push(`| ${r.url} | ${r.matchedTermCount}/${r.totalCandidateTerms} |`);
  }
  lines.push("");
  lines.push(`## Excerpts (from first reference where each term appears)`);
  lines.push("");
  for (const m of report.missing) {
    if (m.excerpt) {
      lines.push(`- **\`${m.term}\`**: ${m.excerpt}`);
    }
  }
  return lines.join("\n");
}
