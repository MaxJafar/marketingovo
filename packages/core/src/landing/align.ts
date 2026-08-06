// Where paid spend meets the page it buys.
//
// Every rule here needs both halves of the product at once, which is why none
// of them exists in a dedicated SEO tool or a dedicated ads tool. An ad group
// bidding on "waterproof boots" pointing at a page headed "Autumn Footwear" is
// one root cause with three symptoms — a quality score penalty, a poor
// conversion rate, and an organic relevance gap — and the only place all three
// are visible at once is here.
//
// The discipline is the same as everywhere else in this product: a rule that
// cannot see its inputs declines to fire. A page the crawl never reached is
// reported as unchecked, never as broken.

import type { Issue, Priority } from "../checks/index.js";
import type {
  AdDestination,
  LandingAlignmentInput,
  PageSnapshot,
} from "./types.js";

export const LANDING_MODULE_ID = "landing:paid-alignment";

export const LANDING_THRESHOLDS = {
  /** Clicks a destination needs before its page is worth an operator's time. */
  minimumClicks: 5,
  /**
   * Largest Contentful Paint beyond which a paid visit is being wasted.
   *
   * Deliberately looser than the 2.5s "good" threshold: this is not an SEO
   * scoring rule, it is the point at which enough people leave before the page
   * appears that the click was bought for nothing.
   */
  slowLcpMs: 4_000,
  /** Ad groups sharing one page before the sharing is worth reporting. */
  sharedPageAdGroups: 4,
  /** Share of an ad group's keywords that must appear on the page. */
  keywordCoverage: 0.34,
} as const;

/** Query parameters whose loss on a redirect destroys attribution. */
const TRACKING_PARAMETERS = [
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "fbclid",
  "msclkid",
  "ttclid",
  "twclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];

function issue(
  id: string,
  priority: Priority,
  message: string,
  urls: string[],
  detail: Record<string, unknown>,
  fix: string,
): Issue {
  return {
    id,
    category: "paid-media",
    priority,
    message,
    urls,
    detail,
    fix,
    moduleId: LANDING_MODULE_ID,
  };
}

function money(value: number, currency: string | null): string {
  const rounded = Math.round(value * 100) / 100;
  return currency ? `${rounded} ${currency}` : `${rounded}`;
}

/**
 * A trailing clause naming the spend, or nothing at all.
 *
 * Ad-group spend is only measured when the sync read that level, and a
 * finding that says "spent an unmeasured amount" reads as filler. A broken
 * page is worth reporting either way; the money is what makes it urgent when
 * it is known.
 */
function spentClause(
  value: number | null,
  currency: string | null,
  phrasing: string,
): string {
  return value === null ? "" : ` ${phrasing} ${money(value, currency)}`;
}

/** The entities sending traffic somewhere, as a readable phrase. */
function senders(destination: AdDestination): string {
  const named = destination.entities
    .map((entity) => entity.name ?? entity.id)
    .filter(Boolean);
  if (named.length === 0) return destination.accountName;
  if (named.length <= 2) return named.join(" and ");
  return `${named.slice(0, 2).join(", ")} and ${named.length - 2} more`;
}

function evidence(destination: AdDestination): Record<string, unknown> {
  return {
    account: destination.accountName,
    origin: destination.origin,
    destination: destination.url,
    spend: destination.spend,
    clicks: destination.clicks,
    currency: destination.currency,
    entities: destination.entities.slice(0, 20),
  };
}

/**
 * Normalises a word for comparison against page text.
 *
 * Deliberately crude. This is not stemming — it lowercases, strips
 * punctuation, and drops the match-type brackets Google keywords carry. A real
 * stemmer would make the rule fire more often and be wrong more often, and a
 * false "your page does not mention this" sends an operator to rewrite a page
 * that was fine.
 */
function normalizeTerm(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[[\]"+]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "our",
  "from",
  "near",
  "best",
  "top",
  "buy",
  "cheap",
  "online",
  "how",
  "what",
  "where",
]);

/** The words a page actually shows, from the parts that carry weight. */
function pageVocabulary(snapshot: PageSnapshot): Set<string> {
  const parts = [
    snapshot.title ?? "",
    ...snapshot.h1,
    ...snapshot.h2,
    snapshot.metaDescription ?? "",
  ];
  return new Set(parts.flatMap((part) => normalizeTerm(part)));
}

/**
 * A destination that costs money and does not work.
 *
 * The purest waste in advertising, and the most common after a site
 * migration: every click is billed, none of them arrive. It stays invisible in
 * every ad-platform metric, because from the platform's side the click
 * happened and was charged.
 */
function brokenDestinations(input: LandingAlignmentInput): Issue[] {
  const issues: Issue[] = [];
  for (const destination of input.destinations) {
    const snapshot = input.snapshots.get(destination.url);
    if (!snapshot || snapshot.status === null) continue;
    if (snapshot.status < 400) continue;

    issues.push(
      issue(
        "landing.destination-broken",
        "High",
        `${senders(destination)} sends paid traffic to a page returning ${snapshot.status}${spentClause(destination.spend, destination.currency, ", having spent")}`,
        [destination.url],
        {
          ...evidence(destination),
          status: snapshot.status,
          checkedVia: snapshot.source,
          observedAt: snapshot.observedAt,
        },
        "Every click here is billed and none of them arrive. Pause these ads or repoint them at a working page now; the ad platform will keep charging for this indefinitely, because from its side the click happened.",
      ),
    );
  }
  return issues;
}

/**
 * A redirect that drops the tracking parameters.
 *
 * The most expensive silent failure this module can find. The page loads, the
 * visitor arrives, everything looks fine — and the click identifier was
 * stripped on the way, so the platform never learns the conversion happened.
 * The campaign then reports as unprofitable and gets cut, which is the wrong
 * decision made confidently on data the redirect destroyed.
 */
function trackingLostOnRedirect(input: LandingAlignmentInput): Issue[] {
  const issues: Issue[] = [];
  for (const destination of input.destinations) {
    const snapshot = input.snapshots.get(destination.url);
    if (!snapshot || snapshot.redirectChain.length === 0) continue;

    let requested: URL;
    let landed: URL;
    try {
      requested = new URL(destination.url);
      landed = new URL(snapshot.finalUrl);
    } catch {
      continue;
    }

    // Only parameters that were actually present can be lost. A destination
    // carrying no tracking is a different question entirely.
    const present = TRACKING_PARAMETERS.filter((name) =>
      requested.searchParams.has(name),
    );
    const dropped = present.filter((name) => !landed.searchParams.has(name));
    if (dropped.length === 0) continue;

    issues.push(
      issue(
        "landing.tracking-lost-on-redirect",
        "High",
        `The redirect on ${destination.url} drops ${dropped.join(", ")}, so conversions from ${senders(destination)} are never attributed back`,
        [destination.url, snapshot.finalUrl],
        {
          ...evidence(destination),
          droppedParameters: dropped,
          redirectChain: snapshot.redirectChain.slice(0, 10),
          landedOn: snapshot.finalUrl,
        },
        "The page loads and the visitor arrives, so nothing looks wrong — but the click identifier is gone and the platform never learns the sale happened. Fix the redirect to preserve the query string. Until it is fixed, this campaign's measured return is understated and any decision to cut it is being made on data the redirect destroyed.",
      ),
    );
  }
  return issues;
}

/** A destination that redirects, keeping its parameters but costing time. */
function redirectingDestinations(input: LandingAlignmentInput): Issue[] {
  const issues: Issue[] = [];
  for (const destination of input.destinations) {
    const snapshot = input.snapshots.get(destination.url);
    if (!snapshot || snapshot.redirectChain.length === 0) continue;
    if (snapshot.status !== null && snapshot.status >= 400) continue;
    // The tracking-loss rule already reports this destination, and more
    // urgently. Two findings about one redirect is noise.
    let dropsTracking = false;
    try {
      const requested = new URL(destination.url);
      const landed = new URL(snapshot.finalUrl);
      dropsTracking = TRACKING_PARAMETERS.some(
        (name) =>
          requested.searchParams.has(name) && !landed.searchParams.has(name),
      );
    } catch {
      dropsTracking = false;
    }
    if (dropsTracking) continue;

    issues.push(
      issue(
        "landing.destination-redirects",
        "Low",
        `${senders(destination)} points at a URL that redirects ${snapshot.redirectChain.length} time${snapshot.redirectChain.length === 1 ? "" : "s"} before landing`,
        [destination.url],
        {
          ...evidence(destination),
          redirectChain: snapshot.redirectChain.slice(0, 10),
          landedOn: snapshot.finalUrl,
        },
        `Point the ad directly at ${snapshot.finalUrl}. The redirect adds latency to every paid visit, and each hop is a place a future change can drop the tracking parameters.`,
      ),
    );
  }
  return issues;
}

/**
 * A page whose words have nothing to do with what is being bid on.
 *
 * The actionable cause behind a low quality score. Google's own rules can only
 * report the score; this can name the keyword and the page it does not match,
 * which is the difference between a number and a task.
 */
function keywordRelevance(input: LandingAlignmentInput): Issue[] {
  const issues: Issue[] = [];
  for (const destination of input.destinations) {
    if (destination.keywords.length === 0) continue;
    const snapshot = input.snapshots.get(destination.url);
    // A page that could not be read, was read as something other than HTML,
    // or was recalled from a crawl that stored no page text has no vocabulary
    // to judge. The rule declines rather than reporting it as irrelevant.
    if (!snapshot || snapshot.title === null || !snapshot.textCaptured)
      continue;
    if (snapshot.status !== null && snapshot.status >= 400) continue;
    if (
      destination.clicks !== null &&
      destination.clicks < LANDING_THRESHOLDS.minimumClicks
    ) {
      continue;
    }

    const vocabulary = pageVocabulary(snapshot);
    const judged = destination.keywords.filter((keyword) => {
      const words = normalizeTerm(keyword).filter(
        (word) => !STOP_WORDS.has(word),
      );
      return words.length > 0;
    });
    if (judged.length === 0) continue;

    const missing = judged.filter((keyword) => {
      const words = normalizeTerm(keyword).filter(
        (word) => !STOP_WORDS.has(word),
      );
      const present = words.filter((word) => vocabulary.has(word)).length;
      return present / words.length < LANDING_THRESHOLDS.keywordCoverage;
    });
    if (missing.length === 0) continue;

    issues.push(
      issue(
        "landing.keyword-absent-from-page",
        missing.length === judged.length ? "High" : "Medium",
        `${missing.length} of ${judged.length} terms bought by ${senders(destination)} do not appear in the landing page's title or headings`,
        [destination.url],
        {
          ...evidence(destination),
          pageTitle: snapshot.title,
          pageH1: snapshot.h1.slice(0, 5),
          missingKeywords: missing.slice(0, 30),
          judgedKeywords: judged.length,
        },
        "This is what a low quality score usually means, and raising the bid does not fix it. Either send these terms to a page that answers them, or add the language to this page's title, heading and opening copy. The same edit improves the organic ranking for those terms.",
      ),
    );
  }
  return issues;
}

/** Paid traffic landing on a page the operator told search engines to ignore. */
function nonIndexableDestinations(input: LandingAlignmentInput): Issue[] {
  const issues: Issue[] = [];
  for (const destination of input.destinations) {
    const snapshot = input.snapshots.get(destination.url);
    if (!snapshot || snapshot.indexable !== false) continue;
    if (snapshot.status !== null && snapshot.status >= 400) continue;

    issues.push(
      issue(
        "landing.destination-not-indexable",
        "Low",
        `${senders(destination)} lands on a page marked not indexable`,
        [destination.url],
        { ...evidence(destination), checkedVia: snapshot.source },
        "Legitimate for a dedicated paid landing page, and worth confirming that is what this is. If the page was meant to rank as well, the directive is costing the organic traffic that would otherwise arrive free.",
      ),
    );
  }
  return issues;
}

/** A page slow enough that paid visitors leave before it appears. */
function slowDestinations(input: LandingAlignmentInput): Issue[] {
  const issues: Issue[] = [];
  for (const destination of input.destinations) {
    const snapshot = input.snapshots.get(destination.url);
    if (!snapshot) continue;
    const lcp = snapshot.lcpMs;
    if (lcp === null || lcp < LANDING_THRESHOLDS.slowLcpMs) continue;
    if (
      destination.clicks !== null &&
      destination.clicks < LANDING_THRESHOLDS.minimumClicks
    ) {
      continue;
    }

    issues.push(
      issue(
        "landing.slow-under-paid-traffic",
        "Medium",
        `Paid traffic from ${senders(destination)} lands on a page taking ${(lcp / 1000).toFixed(1)}s to show its main content${spentClause(destination.spend, destination.currency, ", after")}`,
        [destination.url],
        { ...evidence(destination), lcpMs: lcp },
        "A share of these visits leave before the page appears, and every one of them was paid for. This is the cheapest conversion-rate work available, because the traffic is already bought.",
      ),
    );
  }
  return issues;
}

/** One page serving many ad groups, the mirror of duplicate keywords. */
function overSharedPages(input: LandingAlignmentInput): Issue[] {
  const byUrl = new Map<
    string,
    { adGroups: Set<string>; spend: number | null; currency: string | null }
  >();
  for (const destination of input.destinations) {
    const existing = byUrl.get(destination.url) ?? {
      adGroups: new Set<string>(),
      spend: null,
      currency: destination.currency,
    };
    for (const entity of destination.entities) {
      if (entity.kind === "adgroup" || entity.kind === "ad") {
        existing.adGroups.add(entity.name ?? entity.id);
      }
    }
    if (destination.spend !== null) {
      existing.spend = (existing.spend ?? 0) + destination.spend;
    }
    byUrl.set(destination.url, existing);
  }

  const issues: Issue[] = [];
  for (const [url, value] of byUrl) {
    if (value.adGroups.size < LANDING_THRESHOLDS.sharedPageAdGroups) continue;
    issues.push(
      issue(
        "landing.page-shared-across-ad-groups",
        "Low",
        `${value.adGroups.size} ad groups send traffic to the same page${spentClause(value.spend, value.currency, ", having spent")}`,
        [url],
        {
          destination: url,
          adGroups: [...value.adGroups].slice(0, 30),
          spend: value.spend,
          currency: value.currency,
        },
        "One page cannot answer several different intents equally well, and the shared destination is usually why the more specific ad groups underperform. Give the highest-spending ones a page that matches what they were bought against.",
      ),
    );
  }
  return issues;
}

/**
 * Destinations nothing could be established about.
 *
 * Not a defect, and stated as such. A dedicated paid landing page is routinely
 * absent from a crawl because nothing on the site links to it. But an operator
 * reading a clean alignment report needs to know which pages it actually
 * covered, otherwise silence reads as approval.
 */
function uncheckedDestinations(input: LandingAlignmentInput): Issue[] {
  const unchecked = input.destinations.filter((destination) => {
    const snapshot = input.snapshots.get(destination.url);
    return !snapshot || (snapshot.status === null && snapshot.error !== null);
  });
  if (unchecked.length === 0) return [];

  return [
    issue(
      "landing.destination-unchecked",
      "Low",
      `${unchecked.length} paid ${unchecked.length === 1 ? "destination" : "destinations"} could not be checked, so the findings above do not cover ${unchecked.length === 1 ? "it" : "them"}`,
      unchecked.map((destination) => destination.url).slice(0, 20),
      {
        destinations: unchecked.slice(0, 20).map((destination) => ({
          url: destination.url,
          account: destination.accountName,
          reason:
            input.snapshots.get(destination.url)?.error ??
            "The page was not in the last crawl and was not reached directly.",
        })),
      },
      "Read the alignment findings as covering the rest only. A page absent from the crawl is normal for a dedicated landing page, since nothing on the site links to it; a page that could not be fetched at all is worth opening by hand.",
    ),
  ];
}

/**
 * Runs every rule.
 *
 * Ordered so the two that cost real money come first; the caller ranks
 * findings against everything else in the action queue anyway, but the order
 * matters when a person reads the raw list.
 */
export function auditLandingAlignment(input: LandingAlignmentInput): Issue[] {
  return [
    ...brokenDestinations(input),
    ...trackingLostOnRedirect(input),
    ...keywordRelevance(input),
    ...slowDestinations(input),
    ...redirectingDestinations(input),
    ...nonIndexableDestinations(input),
    ...overSharedPages(input),
    ...uncheckedDestinations(input),
  ];
}
