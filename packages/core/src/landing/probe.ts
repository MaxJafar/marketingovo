// Establishing what a paid destination actually does.
//
// The crawl is preferred, because it costs nothing and was taken with the
// site's own settings. But a dedicated paid landing page is routinely absent
// from a crawl by design — nothing on the site links to it, so nothing
// discovers it — and "we did not check the page your money lands on" is a poor
// answer to the question this module exists to ask.
//
// So anything the crawl missed is fetched directly, through the same renderer
// and the same safety rules the crawler uses. Bounded, because a large account
// holds more destinations than anyone wants to fetch on a schedule.

import { createRenderer } from "../renderer.js";
import { parsePage } from "../parser.js";
import { assessPageIndexability } from "../indexability.js";
import { loadLimits, type Limits } from "../core/limits.js";
import type { PageSnapshot } from "./types.js";

/** How many pages a single alignment pass will fetch that the crawl missed. */
export const MAX_PROBES = 40;

export interface ProbeOptions {
  /**
   * Partial on purpose.
   *
   * The runtime loads the engine through a cast, so nothing checks at compile
   * time that what it passes here is a complete `Limits`. Filling the gaps
   * from the defaults is cheaper than a crash inside a paid audit over a
   * missing field.
   */
  limits?: Partial<Limits>;
  userAgent: string;
  timeoutMs?: number;
  maxProbes?: number;
  signal?: AbortSignal;
  now?: () => Date;
}

function failedSnapshot(
  url: string,
  error: string,
  observedAt: string,
): PageSnapshot {
  return {
    url,
    finalUrl: url,
    status: null,
    redirectChain: [],
    title: null,
    h1: [],
    h2: [],
    metaDescription: null,
    wordCount: null,
    indexable: null,
    lcpMs: null,
    responseTimeMs: null,
    source: "probe",
    textCaptured: false,
    error,
    observedAt,
  };
}

/**
 * Fetches destinations directly.
 *
 * Failures become snapshots with a stated error rather than absences, so the
 * unchecked-destinations rule can name what it could not reach instead of the
 * page simply vanishing from the report.
 */
export async function probeDestinations(
  urls: readonly string[],
  options: ProbeOptions,
): Promise<Map<string, PageSnapshot>> {
  const snapshots = new Map<string, PageSnapshot>();
  if (urls.length === 0) return snapshots;

  const now = options.now ?? (() => new Date());
  const limits: Limits = { ...loadLimits(), ...(options.limits ?? {}) };
  const budget = Math.max(
    1,
    Math.min(MAX_PROBES, options.maxProbes ?? MAX_PROBES),
  );
  // Static rendering only. A destination that needs JavaScript to return its
  // status code is not a case worth spending a browser on here, and the two
  // findings that matter most — a broken page and a redirect that drops
  // tracking — are both answered by the response itself.
  const renderer = await createRenderer("static", limits);

  try {
    for (const url of urls.slice(0, budget)) {
      options.signal?.throwIfAborted();
      const observedAt = now().toISOString();
      try {
        const rendered = await renderer.render(url, {
          timeoutMs: options.timeoutMs ?? 15_000,
          maxBodyBytes: limits.maxBodyBytes,
          userAgent: options.userAgent,
          allowPrivate: false,
          // Followed rather than refused, because the redirect chain is
          // itself the evidence: a hop that strips the click identifier is
          // the most expensive thing this module can find.
          maxRedirects: 5,
        });

        const html = rendered.contentType.includes("html")
          ? rendered.body.toString("utf8")
          : null;
        const parsed = html ? parsePage(html, rendered.finalUrl) : null;
        const indexability = assessPageIndexability({
          status: rendered.status,
          finalUrl: rendered.finalUrl,
          contentType: rendered.contentType,
          canonical: parsed?.canonical ?? null,
          robotsMeta: parsed?.robotsMeta ?? null,
          xRobotsTag: rendered.headers["x-robots-tag"] ?? null,
          // Not consulted. A destination the operator pays to send traffic to
          // is being visited by people regardless of what robots.txt says to
          // crawlers, so a disallow here is not evidence about the page.
          robotsAllowed: null,
          htmlParsed: parsed !== null,
          error: null,
        });

        snapshots.set(url, {
          url,
          finalUrl: rendered.finalUrl,
          status: rendered.status,
          redirectChain: rendered.redirectChain ?? [],
          title: parsed?.title ?? null,
          h1: parsed?.h1 ?? [],
          h2: parsed?.h2 ?? [],
          metaDescription: parsed?.metaDescription ?? null,
          wordCount: parsed?.wordCount ?? null,
          indexable: indexability.indexable,
          // Not measured by a static fetch. Time to first byte is available
          // and is a different thing, so this stays null rather than
          // substituting a number that would be compared against an LCP
          // threshold it does not mean.
          lcpMs: null,
          responseTimeMs: rendered.responseTimeMs,
          source: "probe",
          textCaptured: parsed !== null,
          error: null,
          observedAt,
        });
      } catch (error) {
        snapshots.set(
          url,
          failedSnapshot(
            url,
            error instanceof Error
              ? error.message
              : "The destination could not be fetched.",
            observedAt,
          ),
        );
      }
    }
  } finally {
    await renderer.close();
  }

  return snapshots;
}
