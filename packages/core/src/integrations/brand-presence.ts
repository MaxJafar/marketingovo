// Brand presence: does the site actually connect to the profiles the brand owns?
//
// A marketing workspace collects social and marketplace URLs during onboarding.
// Storing them is worthless on its own, so this module turns them into two
// findings a crawl can support without any platform API:
//
//   1. Is the profile linked from the site at all? An Instagram account nobody
//      can reach from the homepage is invisible to both users and crawlers.
//   2. Is it declared in schema.org `sameAs`? That is the machine-readable claim
//      of brand identity, and it is what search engines consolidate on.
//
// Both come from data the crawler already extracts (`externalLinks`, `jsonLd`),
// so this costs no extra requests. Reachability is the one probe that does cost
// a request, and it is optional.
//
// Every result is a named state. A profile that was never checked is
// "unchecked", never a silent `false` that would read as "your site does not
// link to this".

export interface BrandProfileInput {
  label: string;
  url: string;
}

/** The page evidence this check consumes. Available on every parsed page. */
export interface BrandPresencePage {
  url: string;
  externalLinks: readonly string[];
  jsonLd: readonly string[];
}

export type BrandReachability =
  /** The URL responded. */
  | "reachable"
  /** The URL was probed and did not respond usefully. */
  | "unreachable"
  /** No probe was made. Not evidence either way. */
  | "unchecked";

export interface BrandProfilePresence {
  label: string;
  url: string;
  /** Pages that link to this profile. Sampled for the report. */
  linkedFrom: string[];
  /** Complete count of linking pages, which `linkedFrom` only samples. */
  linkingPageCount: number;
  /** Declared in schema.org sameAs somewhere on the site. */
  declaredInSameAs: boolean;
  reachability: BrandReachability;
  /** Why a probe failed, when it failed. */
  reachabilityDetail?: string;
}

const SAMPLE_LIMIT = 3;

/**
 * Reduces a URL to the identity that matters for "is this the same profile".
 *
 * Protocol, `www.`, a trailing slash, query and fragment all vary between how a
 * user pastes a profile and how a site links to it, and none of them change
 * which account is being referenced. Case is preserved in the path because some
 * platforms have case-sensitive handles, but the host is lowercased.
 */
function profileIdentity(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  const path = url.pathname.replace(/\/+$/u, "");
  return `${host}${path}`;
}

/** Collects every URL appearing in a schema.org `sameAs`, at any nesting depth. */
export function sameAsUrls(jsonLdBlocks: readonly string[]): string[] {
  const found: string[] = [];
  const visit = (node: unknown, depth: number): void => {
    // JSON-LD graphs nest, and a hostile or generated document can nest deeply
    // enough to blow the stack. The cap is well past any real markup.
    if (depth > 12 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "sameAs") {
        if (typeof value === "string") found.push(value);
        else if (Array.isArray(value)) {
          for (const entry of value) {
            if (typeof entry === "string") found.push(entry);
          }
        }
        continue;
      }
      visit(value, depth + 1);
    }
  };
  for (const block of jsonLdBlocks) {
    try {
      visit(JSON.parse(block), 0);
    } catch {
      // Malformed JSON-LD is common and is already reported by the structured
      // data checks. It is not this module's finding.
      continue;
    }
  }
  return found;
}

/**
 * Matches brand profiles against crawl evidence.
 *
 * Pure: no network. Reachability is left "unchecked" so a caller that cannot
 * afford probes still gets the linking answer, which is the more actionable of
 * the two.
 */
export function assessBrandPresence(
  profiles: readonly BrandProfileInput[],
  pages: Iterable<BrandPresencePage>,
): BrandProfilePresence[] {
  const wanted = new Map<string, BrandProfilePresence>();
  for (const profile of profiles) {
    const identity = profileIdentity(profile.url);
    if (!identity || wanted.has(identity)) continue;
    wanted.set(identity, {
      label: profile.label,
      url: profile.url,
      linkedFrom: [],
      linkingPageCount: 0,
      declaredInSameAs: false,
      reachability: "unchecked",
    });
  }
  if (wanted.size === 0) return [];

  for (const page of pages) {
    // A page linking the same profile twice is still one linking page.
    const seenOnPage = new Set<string>();
    for (const link of page.externalLinks) {
      const identity = profileIdentity(link);
      if (!identity) continue;
      const entry = wanted.get(identity);
      if (!entry || seenOnPage.has(identity)) continue;
      seenOnPage.add(identity);
      entry.linkingPageCount += 1;
      if (entry.linkedFrom.length < SAMPLE_LIMIT)
        entry.linkedFrom.push(page.url);
    }
    for (const declared of sameAsUrls(page.jsonLd)) {
      const identity = profileIdentity(declared);
      if (!identity) continue;
      const entry = wanted.get(identity);
      if (entry) entry.declaredInSameAs = true;
    }
  }

  return [...wanted.values()];
}

/**
 * Probes each profile URL and fills in reachability.
 *
 * Uses the bounded, SSRF-guarded fetcher and honours the run's private-host
 * allowlist, so a staging or intranet profile can be checked only when the
 * caller explicitly authorized that host.
 */
export async function probeBrandReachability(
  presence: readonly BrandProfilePresence[],
  options: {
    privateHostAllowlist?: readonly string[];
    signal?: AbortSignal;
  } = {},
): Promise<BrandProfilePresence[]> {
  if (presence.length === 0) return [];
  const { Fetcher } = await import("../fetcher.js");
  const { loadLimits } = await import("../core/limits.js");

  const allowlist = options.privateHostAllowlist ?? [];
  const fetcher = new Fetcher({
    ...loadLimits(),
    allowPrivate: allowlist.length > 0,
    privateHostAllowlist: allowlist,
  });
  try {
    const results: BrandProfilePresence[] = [];
    for (const entry of presence) {
      if (options.signal?.aborted) {
        // Cancellation is not a finding about the profile.
        results.push({ ...entry, reachability: "unchecked" });
        continue;
      }
      try {
        // A profile page is only being checked for existence, so the body is
        // capped hard and every status is accepted for inspection below.
        // Cross-host redirects are allowed: shortened and vanity profile URLs
        // routinely land on a different domain.
        const response = await fetcher.fetchRaw(entry.url, {
          maxBodyBytes: 64 * 1024,
          acceptAnyStatus: true,
          allowCrossHostRedirect: true,
        });
        // Many platforms answer a bot with 403 or 429. That proves the address
        // is live, which is the question here, so only a 404/410 is treated as
        // the profile being absent.
        const gone = response.status === 404 || response.status === 410;
        results.push({
          ...entry,
          reachability: gone ? "unreachable" : "reachable",
          ...(gone ? { reachabilityDetail: `HTTP ${response.status}` } : {}),
        });
      } catch (error) {
        results.push({
          ...entry,
          reachability: "unreachable",
          reachabilityDetail:
            error instanceof Error ? error.message : "request failed",
        });
      }
    }
    return results;
  } finally {
    fetcher.close();
  }
}
