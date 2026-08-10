// The join between paid spend and the pages it buys clicks to.
//
// Two halves of this product have never spoken to each other. The crawler
// knows what every page on the site says and whether it works; the ad
// connectors know where the money is being sent. Neither knows the other, and
// almost every expensive landing-page problem lives exactly in that gap.
//
// The shapes below are deliberately narrow. This module does not want a
// `CrawledPage` or a `GoogleAdsAdRecord` — it wants "somewhere money is being
// sent" and "what we know about that page", so that a Meta deliverable, a
// Google ad and a printed QR code can all be checked by the same rules.

/** Which surface is sending traffic somewhere. */
export type DestinationOrigin =
  "google-ads" | "meta-ads" | "campaign-link" | "social-post";

/**
 * One place money is being sent, and enough context to name it in a finding.
 *
 * Several ads usually share a destination; the caller merges them before this
 * module sees them, so `entities` is the list that share it.
 */
export interface AdDestination {
  /** The URL as the platform holds it, before any redirect. */
  url: string;
  origin: DestinationOrigin;
  /** The ad account, campaign or link this belongs to, for the deep link. */
  accountId: string;
  accountName: string;
  accountExternalId: string;
  /** Named entities sending traffic here — ad groups, ads, links. */
  entities: Array<{
    kind: "ad" | "adgroup" | "campaign" | "link";
    id: string;
    name: string | null;
    /** The owning campaign, when the entity is not itself one. */
    campaignId: string | null;
    campaignName: string | null;
  }>;
  /**
   * Terms this destination is being bought against.
   *
   * Google keywords, or a campaign's targeting where no keywords exist. Empty
   * for surfaces that do not bid on words at all, and the relevance rule
   * declines rather than guessing when it is empty.
   */
  keywords: string[];
  /** Measured spend over the window, when it was measured. */
  spend: number | null;
  clicks: number | null;
  currency: string | null;
}

/**
 * What is known about a destination page.
 *
 * Either recalled from a crawl or fetched directly. `source` says which,
 * because a page the crawl never reached is a different claim from one it
 * reached and found healthy — and a dedicated paid landing page is routinely
 * absent from a crawl by design, since nothing on the site links to it.
 */
export interface PageSnapshot {
  /** The URL that was asked for. */
  url: string;
  /** Where the request ended up. Differs from `url` when it redirected. */
  finalUrl: string;
  status: number | null;
  redirectChain: string[];
  /** Null when the page could not be parsed, e.g. a non-HTML response. */
  title: string | null;
  h1: string[];
  h2: string[];
  metaDescription: string | null;
  wordCount: number | null;
  /** False when a robots directive or canonical points traffic elsewhere. */
  indexable: boolean | null;
  /** Largest Contentful Paint in milliseconds, when it was measured. */
  lcpMs: number | null;
  responseTimeMs: number | null;
  source: "crawl" | "probe";
  /**
   * Whether the page's own words were captured, not just its status.
   *
   * False for a crawl taken before this module existed, which stored a title
   * and nothing else. The relevance rule requires it: judging a page on its
   * title alone would report "your page never mentions this" about pages whose
   * heading says exactly that, and send an operator to rewrite something that
   * was fine.
   */
  textCaptured: boolean;
  /** Why nothing could be established, when the page could not be read. */
  error: string | null;
  observedAt: string;
}

export interface LandingAlignmentInput {
  /** Named in findings so an operator knows which workspace is meant. */
  projectName: string;
  destinations: readonly AdDestination[];
  /** Keyed by the destination URL each snapshot answers for. */
  snapshots: ReadonlyMap<string, PageSnapshot>;
}
