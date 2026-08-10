// Building and checking tagged campaign URLs.
//
// Campaign tagging is the rare piece of marketing plumbing where the mistakes
// are both universal and completely mechanical. Nobody means to write
// `utm_source=Facebook` on Monday and `facebook` on Tuesday, and nobody
// notices until the quarter is over and one campaign appears twice in the
// report with no way to merge it after the fact.
//
// So this file enforces a convention rather than suggesting one, and every
// finding is phrased as the reporting consequence rather than the rule. "Use
// lowercase" is a style note nobody acts on; "this will appear as two separate
// sources in your reports and cannot be merged later" is a reason.

import type { CampaignLinkFinding, UtmParameters } from "./types.js";

/**
 * The mediums Google Analytics 4 recognises in its default channel grouping.
 *
 * Anything outside this list still records, but lands in "Unassigned", which
 * is where campaigns go to be forgotten. Worth knowing before printing, not
 * after.
 */
const RECOGNISED_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsearch",
  "email",
  "e-mail",
  "social",
  "social-network",
  "social-media",
  "sm",
  "display",
  "banner",
  "cpm",
  "interstitial",
  "affiliate",
  "referral",
  "organic",
  "video",
  "audio",
  "push",
  "sms",
]);

/** Values that name a place, and so belong in `utm_source`. */
const SOURCE_LIKE = new Set([
  "facebook",
  "instagram",
  "google",
  "bing",
  "youtube",
  "linkedin",
  "twitter",
  "x",
  "tiktok",
  "telegram",
  "newsletter",
  "mailchimp",
  "klaviyo",
  "partner",
]);

/** Values that name a delivery method, and so belong in `utm_medium`. */
const MEDIUM_LIKE = new Set([
  "cpc",
  "ppc",
  "email",
  "social",
  "display",
  "banner",
  "referral",
  "organic",
  "affiliate",
  "print",
  "qr",
]);

/** Click identifiers that mean the platform is already tagging this traffic. */
const AUTO_TAGGING_PARAMETERS = [
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "ttclid",
  "twclid",
];

const AUTO_TAGGED_HOSTS = ["doubleclick.net", "googleadservices.com"];

/**
 * The convention: lowercase, hyphen-separated, ASCII.
 *
 * Not a matter of taste. Analytics tools differ on whether they fold case, so
 * the only value that reads the same everywhere is one that was never mixed.
 */
export function normalizeUtmValue(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      // Strip combining marks so accented characters become their base letter
      // rather than percent-encoded noise in the report.
      .replace(/\p{M}/gu, "")
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9.\-~]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export function normalizeUtmParameters(utm: UtmParameters): UtmParameters {
  return {
    source: normalizeUtmValue(utm.source),
    medium: normalizeUtmValue(utm.medium),
    campaign: normalizeUtmValue(utm.campaign),
    term: utm.term === null ? null : normalizeUtmValue(utm.term),
    content: utm.content === null ? null : normalizeUtmValue(utm.content),
  };
}

/**
 * Appends the tagging to the destination.
 *
 * Existing query parameters are kept and the fragment stays at the end, which
 * is where string concatenation usually gets it wrong: a `#section` anchor
 * placed before the query makes every parameter part of the fragment, and
 * fragments are never sent to the server, so the whole campaign records as
 * direct traffic.
 */
export function buildTaggedUrl(
  destinationUrl: string,
  utm: UtmParameters,
): string {
  const url = new URL(destinationUrl);
  url.searchParams.set("utm_source", utm.source);
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.term) url.searchParams.set("utm_term", utm.term);
  else url.searchParams.delete("utm_term");
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  else url.searchParams.delete("utm_content");
  return url.toString();
}

function checkValue(
  field: string,
  value: string,
  findings: CampaignLinkFinding[],
): void {
  const normalized = normalizeUtmValue(value);
  if (normalized === value) return;

  if (/[A-Z]/.test(value)) {
    findings.push({
      rule: "utm-mixed-case",
      severity: "blocking",
      field,
      message: `"${value}" contains capital letters. Analytics tools disagree about whether to fold case, so the same campaign tagged "${value}" today and "${normalized}" tomorrow appears as two separate rows that cannot be merged afterwards.`,
      remedy: `Use "${normalized}".`,
    });
  }
  if (/\s/.test(value)) {
    findings.push({
      rule: "utm-whitespace",
      severity: "blocking",
      field,
      message: `"${value}" contains a space. Depending on what encodes the link it becomes either "%20" or "+", and the two record as different values — so one campaign splits across two rows for no visible reason.`,
      remedy: `Use "${normalized}".`,
    });
  }
  if (/[^\x20-\x7e]/.test(value)) {
    findings.push({
      rule: "utm-non-ascii",
      severity: "warning",
      field,
      message: `"${value}" contains characters outside ASCII. They survive the round trip, but arrive in most reporting interfaces percent-encoded and unreadable.`,
      remedy: `Use "${normalized}".`,
    });
  }
}

export interface ValidateCampaignLinkInput {
  destinationUrl: string;
  utm: UtmParameters;
}

/**
 * Everything checkable about a tagged link, before it is committed to print.
 *
 * Ordered blocking first, because the caller shows the first few and the ones
 * that lose data should not be below the ones about vocabulary.
 */
export function validateCampaignLink(
  input: ValidateCampaignLinkInput,
): CampaignLinkFinding[] {
  const findings: CampaignLinkFinding[] = [];
  const { utm } = input;

  checkValue("source", utm.source, findings);
  checkValue("medium", utm.medium, findings);
  checkValue("campaign", utm.campaign, findings);
  if (utm.term) checkValue("term", utm.term, findings);
  if (utm.content) checkValue("content", utm.content, findings);

  let url: URL | null = null;
  try {
    url = new URL(input.destinationUrl);
  } catch {
    findings.push({
      rule: "destination-unparseable",
      severity: "blocking",
      field: "destinationUrl",
      message:
        "The destination is not a URL that can be parsed, so no link can be built from it.",
      remedy: "Give the full address including https://.",
    });
  }

  if (url) {
    if (url.protocol === "http:") {
      findings.push({
        rule: "destination-not-https",
        severity: "warning",
        field: "destinationUrl",
        message:
          "The destination is plain HTTP. Several phone scanners now show a warning before opening it, and a warning between the code and the page loses a share of the people who scanned.",
        remedy: "Point the link at the https:// address.",
      });
    }

    const existingUtm = [...url.searchParams.keys()].filter((key) =>
      key.toLowerCase().startsWith("utm_"),
    );
    if (existingUtm.length > 0) {
      findings.push({
        rule: "destination-already-tagged",
        severity: "blocking",
        field: "destinationUrl",
        message: `The destination already carries ${existingUtm.join(", ")}. Those values will be overwritten by the tagging below, so whatever the original link was measuring stops being measured.`,
        remedy:
          "Give the untagged page address and let the tagging be built here.",
      });
    }

    const clickIds = [...url.searchParams.keys()].filter((key) =>
      AUTO_TAGGING_PARAMETERS.includes(key.toLowerCase()),
    );
    const autoTaggedHost = AUTO_TAGGED_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    if (clickIds.length > 0 || autoTaggedHost) {
      findings.push({
        rule: "conflicts-with-auto-tagging",
        severity: "blocking",
        field: "destinationUrl",
        message:
          "This link is already tagged by the advertising platform itself. Manual UTM parameters override the platform's own identifier, which breaks the cost and conversion data that only the platform can supply — the reporting gets worse, not better.",
        remedy:
          "Leave platform-tagged links alone. Tag only traffic the platform does not tag for you.",
      });
    }

    if (url.hash) {
      findings.push({
        rule: "destination-has-fragment",
        severity: "warning",
        field: "destinationUrl",
        message:
          "The destination ends in a #fragment. The tagging is placed correctly before it, but a fragment is never sent to the server, so anything the page needs it for must be handled in the browser.",
        remedy: null,
      });
    }
  }

  // Source and medium answer different questions, and swapping them is the
  // most common tagging error after case. It is silent: both values record,
  // and the channel report is simply wrong.
  const source = utm.source.toLowerCase();
  const medium = utm.medium.toLowerCase();
  if (MEDIUM_LIKE.has(source) && SOURCE_LIKE.has(medium)) {
    findings.push({
      rule: "utm-source-medium-swapped",
      severity: "blocking",
      field: "source",
      message: `Source and medium look swapped: "${source}" describes how the traffic arrived and "${medium}" describes where it came from. Reports group by medium, so this campaign will be filed under a channel that does not exist.`,
      remedy: `Use source "${medium}" and medium "${source}".`,
    });
  } else if (!RECOGNISED_MEDIUMS.has(medium)) {
    findings.push({
      rule: "utm-medium-unrecognised",
      severity: "warning",
      field: "medium",
      message: `"${medium}" is not one of the mediums Analytics maps to a channel, so this traffic will appear under "Unassigned" rather than beside the rest of the campaign.`,
      remedy:
        medium === "print" || medium === "qr" || medium === "offline"
          ? `Offline traffic has no standard medium. "referral" keeps it in a real channel while the source ("${source}") stays specific enough to find.`
          : "Use one of: cpc, email, social, display, affiliate, referral.",
    });
  }

  if (utm.term && !/^(cpc|ppc|paid|paidsearch)$/.test(medium)) {
    findings.push({
      rule: "utm-term-outside-paid-search",
      severity: "advice",
      field: "term",
      message:
        "utm_term records the keyword that was bid on, so it only means anything for paid search. Elsewhere it records but has nothing to compare against.",
      remedy: "Use utm_content for variants instead.",
    });
  }

  if (utm.source === utm.medium) {
    findings.push({
      rule: "utm-source-equals-medium",
      severity: "warning",
      field: "medium",
      message:
        "Source and medium are the same value, so the report has no more information than a single field would carry.",
      remedy:
        "Medium is the delivery method (email, social, print); source is the specific place within it.",
    });
  }

  const order = { blocking: 0, warning: 1, advice: 2 } as const;
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
