// Recommendations: a short, actionable fix string for each known
// issue id. Used in HTML and Markdown reports so the end user gets
// something they can do, not just a list of problems.
//
// When the operator adds a new issue id they should add a fix here
// too. Issues without a fix still render; the report just says
// "Investigate manually."

const FIXES: Record<string, string> = {
  // Response codes
  "internal-4xx":
    "Fix or remove the broken internal link. Either update the destination URL or set up a 301 redirect to a working page.",
  "internal-5xx":
    "Check server logs for the affected URLs. A persistent 5xx means the page is broken for both users and crawlers.",
  "internal-no-response":
    "The page returned no response (timeout, DNS failure, or blocked by robots). Re-run the crawl and inspect the URL manually if it persists.",
  "external-4xx":
    "External link is dead. Replace with a working URL or remove.",
  "external-5xx":
    "External site is down. Try again later or replace with a stable alternative.",
  "redirect-loop":
    "Remove one of the redirects in the chain so the URL terminates in 200 within max redirects.",
  "redirect-chain":
    "Shorten the redirect chain. Each hop adds latency; aim for a single 301 to the final URL.",

  // Page titles
  "title-missing":
    "Add a unique <title> tag (50-60 chars) describing the page content.",
  "title-duplicate":
    "Each page should have a unique title. Differentiate by topic, location, or product variant.",
  "title-over-60-chars":
    "Shorten the title to 60 characters or fewer so it doesn't get truncated in search results.",
  "title-near-duplicate":
    "Pages with near-duplicate titles compete with each other. Rewrite each title to reflect distinct content.",
  "title-multiple": "Keep exactly one <title> tag per page.",

  // Meta description
  "meta-description-missing":
    "Add a meta description (140-155 chars) summarising the page. Search engines often use it as the snippet.",
  "meta-description-over-155-chars":
    "Trim the meta description to 155 chars or less to avoid truncation in SERP.",
  "meta-description-duplicate":
    "Each page needs a unique meta description. Differentiate the value proposition per page.",

  // Headings
  "h1-missing": "Add exactly one <h1> describing the page's main topic.",
  "h1-multiple": "Use a single <h1>; move secondary headings to <h2>/<h3>.",

  // Canonicals
  "canonical-missing":
    'Add <link rel="canonical" href="..."> pointing to the preferred URL for this content.',
  "canonical-broken":
    "The canonical URL returns 4xx/5xx. Update the canonical to a 200 page.",
  "canonical-relative":
    "Use an absolute URL in the canonical link, including the protocol and host.",
  "canonical-multiple": "Keep exactly one canonical link tag per page.",
  "canonical-cross-domain":
    "Confirm the cross-domain canonical is intentional. Self-referencing canonicals are usually correct.",

  // Directives
  noindex:
    "If this page should appear in search results, remove the noindex directive.",
  nofollow:
    "Remove the nofollow meta directive unless you intentionally want to block all links from this page.",
  noimageindex:
    "Confirm the restriction is intentional. Otherwise remove noimageindex so images on the page can be eligible for image search.",
  nosnippet:
    "Confirm the restriction is intentional. Otherwise remove nosnippet so search engines can show text and video previews.",

  // Images
  "image-alt-missing":
    'Add descriptive alt text to every <img>. For decorative images use alt="".',
  "image-dimensions-missing":
    "Add intrinsic width and height attributes that match the image aspect ratio, then verify layout shift again.",
  "picture-img-fallback-missing":
    "Add an <img> fallback inside each <picture> element, including src and descriptive alt text where appropriate.",

  // Security
  "header-missing-strict-transport-security":
    "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains",
  "header-missing-x-content-type-options":
    "Add: X-Content-Type-Options: nosniff",
  "header-missing-x-frame-options":
    "Add: X-Frame-Options: DENY (or use CSP frame-ancestors).",
  "header-missing-content-security-policy":
    "Add a Content-Security-Policy that restricts script, frame, and connect sources.",
  "header-missing-referrer-policy":
    "Add: Referrer-Policy: strict-origin-when-cross-origin",
  "mixed-content":
    "Replace http:// resources (images, scripts, styles) with https:// versions.",

  // Orphans
  "orphan-page":
    "Add at least one internal link to this page from a related, well-linked page. Update the sitemap if needed.",

  // Sitemaps
  "sitemap-4xx":
    "Remove the broken URL from sitemap.xml or fix the destination to return 2xx.",
  "sitemap-missing":
    "Add this URL to sitemap.xml so search engines can find it.",

  // Hreflang
  "hreflang-target-missing":
    "Crawl the missing hreflang target URL. If it should be indexed, add a link from a page that gets crawled.",
  "hreflang-no-reciprocal":
    'On each hreflang target page, add a <link rel="alternate" hreflang="..."> back to the source URL.',
  "hreflang-lang-mismatch":
    "Make sure the hreflang value matches the language of the target page.",
  "hreflang-self-reference-missing":
    "Add the current page to its hreflang set with the correct language or language-region value.",
  "hreflang-x-default-missing":
    "If the set has a language selector or default-market page, add an x-default entry pointing to it. Otherwise document why no fallback is needed.",
  "hreflang-relative-url":
    "Replace relative hreflang href values with fully qualified HTTP(S) URLs.",
  "hreflang-html-lang-mismatch":
    "Align the page's HTML lang attribute with the primary language of its self-referencing hreflang value.",

  // Structured data
  "jsonld-parse-error":
    'Fix the JSON syntax in the affected <script type="application/ld+json"> block. Test at search.google.com/test/rich-results.',

  // Soft-404
  "soft-404":
    "Return a proper 404 status code (or 410) for non-existent pages instead of a 200 with error text.",

  // Web Vitals
  "vitals-lcp-poor":
    "Largest Contentful Paint > 4s. Optimise hero image, preload critical resources, reduce server response time, inline critical CSS.",
  "vitals-lcp-needs-improvement":
    "LCP between 2.5s and 4s. Consider preloading the LCP element and reducing render-blocking JS.",
  "vitals-cls-poor":
    "Cumulative Layout Shift > 0.25. Always set width/height on images and embeds; avoid inserting content above existing content.",
  "vitals-cls-needs-improvement":
    "CLS between 0.1 and 0.25. Reserve space for ads/embeds; specify dimensions on images.",
  "vitals-ttfb-slow":
    "Time to First Byte > 800ms. Use a CDN, enable HTTP/2 or HTTP/3, optimise backend response time.",
  "vitals-fcp-slow":
    "First Contentful Paint > 1.8s. Reduce render-blocking CSS, defer non-critical JS, optimise web fonts.",

  // Content quality
  "content-thin":
    "Add more useful content. Aim for 300+ words covering the page's topic in depth.",
  "content-very-thin":
    "Page has < 100 words. Add substantial content or remove the page entirely.",
  "content-duplicate-body":
    "Multiple pages have identical body text. Pick a canonical version and 301 the rest, or differentiate the content.",
  "content-near-duplicate-body":
    "Pages are very similar. Consolidate similar content or add unique sections to each.",
  "content-readability-hard":
    "Page scores below 30 on Flesch Reading Ease. Use shorter sentences, simpler words, and more subheadings.",
  "content-no-images":
    "Long text-only pages can be hard to scan. Add at least one relevant image or chart.",

  // Link analysis
  "no-outbound-internal":
    "Add at least 1-3 internal links to related pages. Helps users navigate and distributes link equity.",
  "internal-link-to-broken":
    "Update or remove the broken internal links. Replace the destination URL with a working one or remove the link entirely.",
  "top-linked-to":
    "Informational. The most linked-to pages are your content hubs; ensure they are valuable and up to date.",
  "heavy-nofollow-external":
    "If this is a sponsored or affiliate page, add a disclosure. Otherwise, allow search engines to follow these links.",
  "internal-link-to-redirect":
    "Update the links on each source page to point directly to the final 200 URL, then re-crawl the affected cohort.",
  "excessive-click-depth":
    "Add contextual links from relevant hubs so important indexable pages are reachable within three internal-link hops.",
  "low-inlink-discoverability":
    "Add distinct contextual inlinks from relevant, authoritative pages; avoid repeating the same navigation-only link.",

  // Structural markup
  "viewport-missing-or-empty":
    'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the document head and verify the mobile layout.',
  "duplicate-dom-id":
    "Make every non-empty HTML id unique on the page so fragments, labels, scripts, and assistive technology resolve deterministically.",
  "large-dom":
    "Reduce repeated wrappers and defer off-screen UI where practical. Treat the element threshold as a diagnostic and confirm impact with Lighthouse or field data.",

  // Custom rules — we can't know the operator's intent for a
  // project-specific rule, so the generic recommendation is to fix
  // the rule definition in custom-rules.json or update the page.
  "custom-rule-fix":
    "Update the page to satisfy the project rule, or revise the rule in custom-rules.json.",
};

const FALLBACK =
  "Investigate the affected URLs manually. Check the source code, server config, and crawl logs.";

export function recommend(issueId: string): string {
  return FIXES[issueId] ?? FALLBACK;
}

export function withRecommendations<T extends { id: string; fix?: string }>(
  issues: T[],
): Array<T & { fix: string }> {
  return issues.map((i) => ({
    ...i,
    // Respect operator-set fix (e.g. custom rules), fall back to known
    // recommendation, then to the generic fallback.
    fix: i.fix ?? recommend(i.id),
  }));
}
