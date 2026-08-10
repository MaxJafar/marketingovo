import { describe, expect, it } from "vitest";
import { auditLandingAlignment, LANDING_THRESHOLDS } from "./align.js";
import type {
  AdDestination,
  LandingAlignmentInput,
  PageSnapshot,
} from "./types.js";

/**
 * The join between the crawl and the ad accounts.
 *
 * Two properties are worth defending here above all others. A page nothing
 * could be established about is never reported as broken — that would send an
 * operator to fix a page that was fine. And a redirect that keeps its tracking
 * parameters is a different, much smaller problem than one that drops them,
 * because only the second silently destroys the data a campaign is judged on.
 */

const DESTINATION = "https://example.com/boots?utm_source=google&gclid=abc123";

function destination(overrides: Partial<AdDestination> = {}): AdDestination {
  return {
    url: DESTINATION,
    origin: "google-ads",
    accountId: "acct-1",
    accountName: "Northstar EU",
    accountExternalId: "1234567890",
    entities: [
      {
        kind: "adgroup",
        id: "g1",
        name: "Waterproof boots",
        campaignId: "c1",
        campaignName: "Footwear",
      },
    ],
    keywords: ["waterproof boots", "waterproof walking boots"],
    spend: 900,
    clicks: 300,
    currency: "EUR",
    ...overrides,
  };
}

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: DESTINATION,
    finalUrl: DESTINATION,
    status: 200,
    redirectChain: [],
    title: "Waterproof boots for winter walking",
    h1: ["Waterproof boots"],
    h2: ["Sizing", "Care"],
    metaDescription: "Our range of waterproof boots.",
    wordCount: 800,
    indexable: true,
    lcpMs: 1_200,
    responseTimeMs: 210,
    source: "crawl",
    textCaptured: true,
    error: null,
    observedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function run(
  destinations: AdDestination[],
  snapshots: PageSnapshot[],
): ReturnType<typeof auditLandingAlignment> {
  const input: LandingAlignmentInput = {
    projectName: "Northstar",
    destinations,
    snapshots: new Map(snapshots.map((entry) => [entry.url, entry])),
  };
  return auditLandingAlignment(input);
}

const rules = (issues: { id: string }[]) => issues.map((issue) => issue.id);

describe("a healthy destination", () => {
  it("produces nothing", () => {
    expect(run([destination()], [snapshot()])).toEqual([]);
  });
});

describe("broken destinations", () => {
  it("is the loudest finding this module makes", () => {
    const issues = run([destination()], [snapshot({ status: 404 })]);
    const finding = issues.find(
      (issue) => issue.id === "landing.destination-broken",
    );
    expect(finding?.priority).toBe("High");
    expect(finding?.message).toContain("900 EUR");
    // The point that makes it urgent: the platform keeps charging, because
    // from its side the click happened.
    expect(finding?.fix).toContain("keep charging");
  });

  it("does not fire for a page nothing is known about", () => {
    // The failure that would matter: reporting an unchecked page as broken
    // sends an operator to fix something that was fine.
    const issues = run(
      [destination()],
      [
        snapshot({
          status: null,
          error: "The destination could not be fetched.",
        }),
      ],
    );
    expect(rules(issues)).not.toContain("landing.destination-broken");
    expect(rules(issues)).toContain("landing.destination-unchecked");
  });

  it("does not fire when the destination is absent from the snapshots", () => {
    const issues = run([destination()], []);
    expect(rules(issues)).not.toContain("landing.destination-broken");
    expect(rules(issues)).toContain("landing.destination-unchecked");
  });
});

describe("redirects", () => {
  it("reports a dropped click identifier as the expensive case", () => {
    const issues = run(
      [destination()],
      [
        snapshot({
          finalUrl: "https://example.com/footwear/boots",
          redirectChain: ["https://example.com/boots"],
        }),
      ],
    );
    const finding = issues.find(
      (issue) => issue.id === "landing.tracking-lost-on-redirect",
    );
    expect(finding?.priority).toBe("High");
    expect(finding?.detail).toMatchObject({
      droppedParameters: ["gclid", "utm_source"],
    });
    // The reason it matters is not the lost parameter but the decision it
    // corrupts: the campaign reads as unprofitable and gets cut.
    expect(finding?.fix).toContain("data the redirect destroyed");
  });

  it("treats a redirect that keeps the parameters as a minor one", () => {
    const issues = run(
      [destination()],
      [
        snapshot({
          finalUrl:
            "https://example.com/footwear/boots?utm_source=google&gclid=abc123",
          redirectChain: ["https://example.com/boots"],
        }),
      ],
    );
    expect(rules(issues)).not.toContain("landing.tracking-lost-on-redirect");
    const finding = issues.find(
      (issue) => issue.id === "landing.destination-redirects",
    );
    expect(finding?.priority).toBe("Low");
  });

  it("does not report the same redirect twice", () => {
    const issues = run(
      [destination()],
      [
        snapshot({
          finalUrl: "https://example.com/footwear/boots",
          redirectChain: ["https://example.com/boots"],
        }),
      ],
    );
    expect(rules(issues)).not.toContain("landing.destination-redirects");
  });

  it("says nothing about a destination that carried no tracking to lose", () => {
    const plain = "https://example.com/boots";
    const issues = run(
      [destination({ url: plain })],
      [
        snapshot({
          url: plain,
          finalUrl: "https://example.com/footwear/boots",
          redirectChain: [plain],
        }),
      ],
    );
    expect(rules(issues)).not.toContain("landing.tracking-lost-on-redirect");
  });
});

describe("keyword relevance", () => {
  it("names the terms the page does not answer", () => {
    const issues = run(
      [destination()],
      [
        snapshot({
          title: "Autumn Footwear",
          h1: ["Autumn Footwear"],
          h2: ["New season"],
          metaDescription: "Our autumn range.",
        }),
      ],
    );
    const finding = issues.find(
      (issue) => issue.id === "landing.keyword-absent-from-page",
    );
    expect(finding?.priority).toBe("High");
    expect(finding?.detail).toMatchObject({
      missingKeywords: ["waterproof boots", "waterproof walking boots"],
    });
    // The finding has to say that raising the bid does not fix it, because
    // that is what an operator does when they see a low quality score.
    expect(finding?.fix).toContain("raising the bid does not fix it");
  });

  it("accepts a page that answers the terms", () => {
    expect(rules(run([destination()], [snapshot()]))).not.toContain(
      "landing.keyword-absent-from-page",
    );
  });

  it("declines when the page could not be parsed", () => {
    const issues = run([destination()], [snapshot({ title: null, h1: [] })]);
    expect(rules(issues)).not.toContain("landing.keyword-absent-from-page");
  });

  it("declines when the crawl stored no page text", () => {
    // A crawl taken before this module existed kept a title and nothing else.
    // Judging a page on its title alone would report "your page never mentions
    // this" about pages whose heading says exactly that.
    const issues = run(
      [destination()],
      [snapshot({ title: "Autumn Footwear", textCaptured: false })],
    );
    expect(rules(issues)).not.toContain("landing.keyword-absent-from-page");
    // The other rules still work on that snapshot, so it is not "unchecked".
    expect(rules(issues)).not.toContain("landing.destination-unchecked");
  });

  it("declines below the click threshold", () => {
    const issues = run(
      [
        destination({
          clicks: LANDING_THRESHOLDS.minimumClicks - 1,
        }),
      ],
      [snapshot({ title: "Autumn Footwear", h1: ["Autumn Footwear"], h2: [] })],
    );
    expect(rules(issues)).not.toContain("landing.keyword-absent-from-page");
  });

  it("declines when the surface bids on no words at all", () => {
    const issues = run(
      [destination({ keywords: [], origin: "meta-ads" })],
      [snapshot({ title: "Autumn Footwear", h1: ["Autumn Footwear"], h2: [] })],
    );
    expect(rules(issues)).not.toContain("landing.keyword-absent-from-page");
  });

  it("does not judge a keyword made only of common words", () => {
    // "buy online" against any page would fire constantly and mean nothing.
    const issues = run(
      [destination({ keywords: ["buy online", "best near you"] })],
      [snapshot({ title: "Autumn Footwear", h1: ["Autumn Footwear"], h2: [] })],
    );
    expect(rules(issues)).not.toContain("landing.keyword-absent-from-page");
  });

  it("counts a partial match as covered", () => {
    // One matching word out of two clears the coverage threshold, which is
    // deliberate: a stricter rule fires on pages that were perfectly fine.
    const issues = run(
      [destination({ keywords: ["waterproof hiking boots"] })],
      [snapshot()],
    );
    expect(rules(issues)).not.toContain("landing.keyword-absent-from-page");
  });
});

describe("page health under paid traffic", () => {
  it("reports a slow page carrying bought clicks", () => {
    const issues = run(
      [destination()],
      [snapshot({ lcpMs: LANDING_THRESHOLDS.slowLcpMs + 500 })],
    );
    const finding = issues.find(
      (issue) => issue.id === "landing.slow-under-paid-traffic",
    );
    expect(finding?.message).toContain("4.5s");
    expect(finding?.fix).toContain("already bought");
  });

  it("stays quiet when speed was never measured", () => {
    // A static probe reports no LCP. Substituting the response time would
    // compare a different quantity against this threshold.
    const issues = run([destination()], [snapshot({ lcpMs: null })]);
    expect(rules(issues)).not.toContain("landing.slow-under-paid-traffic");
  });

  it("notes a non-indexable destination without calling it a defect", () => {
    const issues = run([destination()], [snapshot({ indexable: false })]);
    const finding = issues.find(
      (issue) => issue.id === "landing.destination-not-indexable",
    );
    expect(finding?.priority).toBe("Low");
    expect(finding?.fix).toContain("Legitimate for a dedicated paid landing");
  });
});

describe("structure", () => {
  it("reports one page serving many ad groups", () => {
    const shared = Array.from(
      { length: LANDING_THRESHOLDS.sharedPageAdGroups },
      (_, index) =>
        destination({
          entities: [
            {
              kind: "adgroup",
              id: `g${index}`,
              name: `Ad group ${index}`,
              campaignId: "c1",
              campaignName: "Footwear",
            },
          ],
          spend: 100,
        }),
    );
    const issues = run(shared, [snapshot()]);
    const finding = issues.find(
      (issue) => issue.id === "landing.page-shared-across-ad-groups",
    );
    expect(finding?.detail).toMatchObject({ spend: 400 });
  });

  it("leaves a page with a couple of ad groups alone", () => {
    const issues = run(
      [
        destination(),
        destination({
          entities: [
            {
              kind: "adgroup",
              id: "g2",
              name: "Second",
              campaignId: "c1",
              campaignName: "Footwear",
            },
          ],
        }),
      ],
      [snapshot()],
    );
    expect(rules(issues)).not.toContain("landing.page-shared-across-ad-groups");
  });
});

describe("coverage", () => {
  it("names what it could not check so silence does not read as approval", () => {
    const other = "https://example.com/sale";
    const issues = run(
      [destination(), destination({ url: other })],
      [snapshot()],
    );
    const finding = issues.find(
      (issue) => issue.id === "landing.destination-unchecked",
    );
    expect(finding?.urls).toEqual([other]);
    expect(finding?.fix).toContain("normal for a dedicated landing page");
  });

  it("stays silent when everything was checked", () => {
    expect(rules(run([destination()], [snapshot()]))).not.toContain(
      "landing.destination-unchecked",
    );
  });
});
