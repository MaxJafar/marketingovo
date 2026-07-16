// Link analysis: surfaces structural problems in the internal
// link graph. These complement the orphan check (which catches
// pages with no inbound links) with signals about how the rest of
// the site links out.

import {
  isIndexable,
  type CheckFn,
  type CrawledPage,
  type CrawlIndex,
  type Issue,
} from "./index.js";

interface LinkGraphNode {
  page: CrawledPage;
  inlinks: Set<string>;
  outlinks: Set<string>;
}

function resourceUrl(value: string, base?: string): string | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function buildLinkGraph(index: CrawlIndex): Map<string, LinkGraphNode> {
  const aliases = new Map<string, CrawledPage>();
  const graph = new Map<string, LinkGraphNode>();
  for (const page of index.pages.values()) {
    graph.set(page.url, { page, inlinks: new Set(), outlinks: new Set() });
    const requested = resourceUrl(page.url);
    if (requested) aliases.set(requested, page);
  }
  for (const page of index.pages.values()) {
    const final = resourceUrl(page.finalUrl);
    if (final && !aliases.has(final)) aliases.set(final, page);
  }
  for (const source of index.pages.values()) {
    if (source.status !== 200 || !source.parsed) continue;
    const sourceNode = graph.get(source.url);
    if (!sourceNode) continue;
    for (const href of source.parsed.internalLinks) {
      const target = aliases.get(resourceUrl(href, source.finalUrl) ?? "");
      if (!target || target.url === source.url) continue;
      sourceNode.outlinks.add(target.url);
      graph.get(target.url)?.inlinks.add(source.url);
    }
  }
  return graph;
}

function discoveryPath(index: CrawlIndex, page: CrawledPage): string[] {
  const reversed: string[] = [];
  const seen = new Set<string>();
  let current: CrawledPage | undefined = page;
  while (current && !seen.has(current.url)) {
    seen.add(current.url);
    reversed.push(current.url);
    current = current.discoveredFrom
      ? index.pages.get(current.discoveredFrom)
      : undefined;
  }
  return reversed.reverse();
}

export const linkChecks: CheckFn[] = [
  // Pages that don't link out to any other internal page. These are
  // often conversion pages (checkout, signup) or dead ends. We only
  // flag pages that look indexable — noindexed pages are exempt.
  function noOutboundInternal(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (p.parsed.robotsMeta?.includes("noindex")) continue;
      if (p.parsed.internalLinks.length === 0) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "no-outbound-internal",
        category: "Link Analysis",
        priority: "Low",
        message: `${urls.length} indexable page(s) have no internal outbound links. Consider adding navigation to related pages.`,
        urls,
      },
    ];
  },

  // Pages that link to a crawled 4xx/5xx internal URL. The orphan
  // check only catches the dead-end side; this catches the source
  // side. Helps site owners find which pages send users to broken
  // destinations.
  function internalLinkToBroken(index: CrawlIndex): Issue[] {
    // Build map: finalUrl -> status.
    const statusByFinal = new Map<string, number>();
    for (const p of index.pages.values()) {
      try {
        const final = new URL(p.finalUrl).toString();
        statusByFinal.set(final, p.status);
      } catch {
        // ignore
      }
    }
    const sources = new Map<string, Set<string>>();
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const seen = new Set<string>();
      for (const href of p.parsed.internalLinks) {
        if (seen.has(href)) continue;
        seen.add(href);
        // Resolve href to absolute against the page URL.
        let abs: string;
        try {
          abs = new URL(href, p.finalUrl).toString();
        } catch {
          continue;
        }
        const targetStatus = statusByFinal.get(abs);
        if (targetStatus === undefined) continue;
        if (targetStatus < 400) continue;
        const arr = sources.get(p.url) ?? new Set<string>();
        arr.add(abs);
        sources.set(p.url, arr);
      }
    }
    if (sources.size === 0) return [];
    const broken = [...sources.keys()];
    return [
      {
        id: "internal-link-to-broken",
        category: "Link Analysis",
        priority: "High",
        message: `${sources.size} page(s) link to internal URLs that returned 4xx/5xx.`,
        urls: broken,
        detail: {
          sources: Array.from(sources.entries()).map(([src, targets]) => ({
            source: src,
            targets: Array.from(targets),
          })),
        },
      },
    ];
  },

  // A redirect can be technically valid while still wasting crawl budget and
  // adding latency when internal pages link to the old URL. Report the source
  // pages so the recommendation is directly actionable.
  function internalLinkToRedirect(index: CrawlIndex): Issue[] {
    const requested = new Map<string, CrawledPage>();
    for (const page of index.pages.values()) {
      const key = resourceUrl(page.url);
      if (key) requested.set(key, page);
    }
    const sources = new Map<string, Set<string>>();
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      for (const href of new Set(page.parsed.internalLinks)) {
        const key = resourceUrl(href, page.finalUrl);
        const target = key ? requested.get(key) : undefined;
        if (!target) continue;
        const requestedUrl = resourceUrl(target.url);
        const finalUrl = resourceUrl(target.finalUrl);
        if (
          target.redirectChain.length === 0 &&
          (!requestedUrl || requestedUrl === finalUrl)
        ) {
          continue;
        }
        const targets = sources.get(page.url) ?? new Set<string>();
        targets.add(target.url);
        sources.set(page.url, targets);
      }
    }
    if (sources.size === 0) return [];
    return [
      {
        id: "internal-link-to-redirect",
        category: "Link Analysis",
        priority: "Medium",
        message: `${sources.size} page(s) link internally through a redirect instead of directly to the final URL.`,
        urls: [...sources.keys()],
        detail: {
          sources: [...sources.entries()].map(([source, targets]) => ({
            source,
            targets: [...targets],
          })),
        },
      },
    ];
  },

  function excessiveClickDepth(index: CrawlIndex): Issue[] {
    const pages = [...index.pages.values()]
      .filter(
        (page) =>
          isIndexable(page) &&
          typeof page.crawlDepth === "number" &&
          page.crawlDepth > 3,
      )
      .sort((a, b) => (b.crawlDepth ?? 0) - (a.crawlDepth ?? 0));
    if (pages.length === 0) return [];
    return [
      {
        id: "excessive-click-depth",
        category: "Link Analysis",
        priority: "Medium",
        message: `${pages.length} indexable page(s) require more than three internal-link hops from a crawl seed.`,
        urls: pages.map((page) => page.url),
        detail: {
          threshold: 3,
          pages: pages.map((page) => ({
            url: page.url,
            depth: page.crawlDepth,
            discoveredFrom: page.discoveredFrom ?? null,
            path: discoveryPath(index, page),
          })),
        },
      },
    ];
  },

  function lowInlinkDiscoverability(index: CrawlIndex): Issue[] {
    const graph = buildLinkGraph(index);
    const pages = [...graph.values()]
      .filter(
        ({ page, inlinks }) =>
          page.url !== index.startUrl &&
          isIndexable(page) &&
          (page.crawlDepth ?? 0) >= 2 &&
          inlinks.size <= 1,
      )
      .sort(
        (a, b) =>
          (b.page.crawlDepth ?? 0) - (a.page.crawlDepth ?? 0) ||
          a.inlinks.size - b.inlinks.size,
      );
    if (pages.length === 0) return [];
    return [
      {
        id: "low-inlink-discoverability",
        category: "Link Analysis",
        priority: "Low",
        message: `${pages.length} indexable page(s) are deep in the site and receive at most one distinct internal inlink.`,
        urls: pages.map(({ page }) => page.url),
        detail: {
          pages: pages.map(({ page, inlinks }) => ({
            url: page.url,
            depth: page.crawlDepth ?? null,
            inlinkCount: inlinks.size,
            inlinks: [...inlinks],
            path: discoveryPath(index, page),
          })),
        },
      },
    ];
  },

  // Top linked-to pages (by inbound internal link count). This is
  // informational, not an error: it tells the operator which pages
  // are the "hubs" of the site. We surface it as a Low-priority
  // informational issue, the message lists the top 10.
  function topLinkedTo(index: CrawlIndex): Issue[] {
    const inbound = new Map<string, number>();
    const crawledUrls = new Set<string>();
    for (const page of index.pages.values()) {
      crawledUrls.add(page.url);
      try {
        crawledUrls.add(new URL(page.finalUrl).toString());
      } catch {
        // Invalid final URLs cannot be internal-link targets.
      }
    }
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const seen = new Set<string>();
      for (const href of p.parsed.internalLinks) {
        let abs: string;
        try {
          abs = new URL(href, p.finalUrl).toString();
        } catch {
          continue;
        }
        if (seen.has(abs)) continue;
        seen.add(abs);
        // Only count links that resolve to a page we actually crawled.
        if (!crawledUrls.has(abs)) continue;
        inbound.set(abs, (inbound.get(abs) ?? 0) + 1);
      }
    }
    if (inbound.size === 0) return [];
    const top = Array.from(inbound.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return [
      {
        id: "top-linked-to",
        category: "Link Analysis",
        priority: "Low",
        message: `Top ${top.length} linked-to pages ranked by distinct internal inlinks.`,
        urls: top.map(([u]) => u),
        detail: {
          ranking: "inbound-internal-links",
          rankedPageCount: inbound.size,
          returnedRankCount: top.length,
          pages: top.map(([url, inlinkCount]) => ({ url, inlinkCount })),
        },
      },
    ];
  },

  // Pages with a high ratio of nofollow external links. Useful for
  // spotting pages that look like paid/sponsored link farms. We
  // only flag pages with at least 5 external links.
  function heavyNofollowExternal(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const total = p.parsed.externalLinks.length;
      if (total < 5) continue;
      const nofollowSet = new Set(p.parsed.nofollowLinks);
      let nofollowExternal = 0;
      for (const href of p.parsed.externalLinks) {
        if (nofollowSet.has(href)) nofollowExternal += 1;
      }
      if (nofollowExternal / total > 0.8) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "heavy-nofollow-external",
        category: "Link Analysis",
        priority: "Medium",
        message: `${urls.length} page(s) have > 80% of their external links marked nofollow. Check for sponsored-link patterns.`,
        urls,
      },
    ];
  },
];
