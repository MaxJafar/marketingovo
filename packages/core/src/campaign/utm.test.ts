import { describe, expect, it } from "vitest";
import {
  buildTaggedUrl,
  normalizeUtmParameters,
  normalizeUtmValue,
  validateCampaignLink,
} from "./utm.js";
import {
  adviseRedirect,
  renderRedirectConfig,
  shortLinkPath,
} from "./redirect.js";
import { adviseQr, colorContrastRatio } from "../qr/advise.js";
import { encodeQr } from "../qr/encode.js";
import type { UtmParameters } from "./types.js";

const base: UtmParameters = {
  source: "flyer",
  medium: "referral",
  campaign: "summer-sale-2026",
  term: null,
  content: null,
};

const rulesFor = (input: {
  destinationUrl: string;
  utm: UtmParameters;
}): string[] => validateCampaignLink(input).map((finding) => finding.rule);

describe("normalizing", () => {
  it("folds case, spaces and accents to one form", () => {
    expect(normalizeUtmValue("Summer Sale 2026")).toBe("summer-sale-2026");
    expect(normalizeUtmValue("  Café  Newsletter ")).toBe("cafe-newsletter");
    expect(normalizeUtmValue("a__b   c")).toBe("a-b-c");
    expect(normalizeUtmValue("--trim--")).toBe("trim");
  });

  it("leaves an already-clean value alone", () => {
    expect(normalizeUtmParameters(base)).toEqual(base);
  });
});

describe("building the tagged URL", () => {
  it("keeps existing query parameters", () => {
    const url = new URL(
      buildTaggedUrl("https://example.com/p?ref=partner", base),
    );
    expect(url.searchParams.get("ref")).toBe("partner");
    expect(url.searchParams.get("utm_source")).toBe("flyer");
  });

  it("keeps the fragment after the query", () => {
    // The failure this prevents: a fragment placed before the query makes
    // every parameter part of the fragment, fragments are never sent to the
    // server, and the whole campaign records as direct traffic.
    const tagged = buildTaggedUrl("https://example.com/p#pricing", base);
    expect(tagged).toBe(
      "https://example.com/p?utm_source=flyer&utm_medium=referral&utm_campaign=summer-sale-2026#pricing",
    );
    expect(new URL(tagged).searchParams.get("utm_source")).toBe("flyer");
  });

  it("omits the optional parameters rather than sending them empty", () => {
    const url = new URL(buildTaggedUrl("https://example.com/p", base));
    expect(url.searchParams.has("utm_term")).toBe(false);
    expect(url.searchParams.has("utm_content")).toBe(false);
  });

  it("includes term and content when they are set", () => {
    const url = new URL(
      buildTaggedUrl("https://example.com/p", {
        ...base,
        medium: "cpc",
        term: "running-shoes",
        content: "variant-b",
      }),
    );
    expect(url.searchParams.get("utm_term")).toBe("running-shoes");
    expect(url.searchParams.get("utm_content")).toBe("variant-b");
  });
});

describe("validation", () => {
  it("accepts a well-formed link with nothing to say", () => {
    expect(
      validateCampaignLink({
        destinationUrl: "https://example.com/p",
        utm: base,
      }),
    ).toEqual([]);
  });

  it("catches the mistakes that split one campaign into two rows", () => {
    const rules = rulesFor({
      destinationUrl: "https://example.com/p",
      utm: { ...base, campaign: "Summer Sale" },
    });
    expect(rules).toContain("utm-mixed-case");
    expect(rules).toContain("utm-whitespace");
  });

  it("catches source and medium swapped", () => {
    const rules = rulesFor({
      destinationUrl: "https://example.com/p",
      utm: { ...base, source: "email", medium: "newsletter" },
    });
    expect(rules).toContain("utm-source-medium-swapped");
  });

  it("names the channel a print medium will land in", () => {
    const findings = validateCampaignLink({
      destinationUrl: "https://example.com/p",
      utm: { ...base, medium: "print" },
    });
    const unrecognised = findings.find(
      (finding) => finding.rule === "utm-medium-unrecognised",
    );
    expect(unrecognised?.message).toContain("Unassigned");
    // Offline traffic has no standard medium, so the remedy says what to do
    // rather than listing values that do not fit.
    expect(unrecognised?.remedy).toContain("referral");
  });

  it("refuses manual tagging where the platform already tags", () => {
    for (const destination of [
      "https://example.com/p?gclid=abc",
      "https://example.com/p?fbclid=abc",
      "https://example.com/p?msclkid=abc",
      "https://ad.doubleclick.net/x",
    ]) {
      expect(rulesFor({ destinationUrl: destination, utm: base })).toContain(
        "conflicts-with-auto-tagging",
      );
    }
  });

  it("catches a destination that is already tagged", () => {
    expect(
      rulesFor({
        destinationUrl: "https://example.com/p?utm_source=old",
        utm: base,
      }),
    ).toContain("destination-already-tagged");
  });

  it("reports blocking findings first", () => {
    const findings = validateCampaignLink({
      destinationUrl: "http://example.com/p",
      utm: { ...base, campaign: "Summer Sale", medium: "print", term: "x" },
    });
    const rank = { blocking: 0, warning: 1, advice: 2 };
    const order = findings.map((finding) => rank[finding.severity]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(findings[0]?.severity).toBe("blocking");
  });

  it("does not mistake a parseable destination for a broken one", () => {
    expect(rulesFor({ destinationUrl: "not a url", utm: base })).toContain(
      "destination-unparseable",
    );
    expect(
      rulesFor({ destinationUrl: "https://example.com", utm: base }),
    ).not.toContain("destination-unparseable");
  });
});

describe("print advice", () => {
  const matrix = encodeQr("https://example.com/summer?utm_source=flyer");

  it("computes module size from the width including the quiet zone", () => {
    const advice = adviseQr({
      matrix,
      placement: "print-handheld",
      printedWidthMm: 40,
      quietZone: 4,
      darkColor: "#000000",
      lightColor: "#ffffff",
    });
    expect(advice.moduleSizeMm).toBeCloseTo(40 / (matrix.size + 8), 3);
    expect(advice.maxScanDistanceMm).toBe(400);
  });

  it("recommends a width that actually reaches comfortable", () => {
    const tight = adviseQr({
      matrix,
      placement: "outdoor",
      printedWidthMm: 20,
      quietZone: 4,
      darkColor: "#000000",
      lightColor: "#ffffff",
    });
    expect(tight.verdict).toBe("unscannable");
    const fixed = adviseQr({
      matrix,
      placement: "outdoor",
      printedWidthMm: tight.recommendedWidthMm,
      quietZone: 4,
      darkColor: "#000000",
      lightColor: "#ffffff",
    });
    expect(fixed.verdict).toBe("comfortable");
  });

  it("demands more size outdoors than on a screen", () => {
    const widthFor = (placement: "screen" | "outdoor") =>
      adviseQr({
        matrix,
        placement,
        printedWidthMm: 100,
        quietZone: 4,
        darkColor: "#000000",
        lightColor: "#ffffff",
      }).recommendedWidthMm;
    expect(widthFor("outdoor")).toBeGreaterThan(widthFor("screen"));
  });

  it("catches an inverted code", () => {
    const advice = adviseQr({
      matrix,
      placement: "screen",
      printedWidthMm: 100,
      quietZone: 4,
      darkColor: "#ffffff",
      lightColor: "#000000",
    });
    expect(advice.findings.map((finding) => finding.rule)).toContain(
      "qr-inverted",
    );
  });

  it("treats a missing quiet zone as blocking and a thin one as a warning", () => {
    const severityAt = (quietZone: number) =>
      adviseQr({
        matrix,
        placement: "screen",
        printedWidthMm: 100,
        quietZone,
        darkColor: "#000000",
        lightColor: "#ffffff",
      }).findings.find((finding) => finding.rule === "qr-quiet-zone")?.severity;
    expect(severityAt(0)).toBe("blocking");
    expect(severityAt(2)).toBe("warning");
    expect(severityAt(4)).toBeUndefined();
  });

  it("measures contrast the way a scanner thresholds it", () => {
    expect(colorContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(colorContrastRatio("#8a8a8a", "#a0a0a0")).toBeLessThan(3);
  });
});

describe("redirect configs", () => {
  const routes = [
    {
      path: "/s/summer",
      target: "https://example.com/summer?utm_source=flyer",
      expiresAt: "2026-10-01T00:00:00.000Z",
      fallbackUrl: null,
    },
  ];

  it("derives a short path from a label", () => {
    expect(shortLinkPath("Summer Sale — Café window")).toBe(
      "/s/summer-sale-cafe-window",
    );
    expect(shortLinkPath("")).toBe("/s/link");
  });

  it("only claims to enforce expiry where it can", () => {
    expect(
      renderRedirectConfig("cloudflare-worker", routes).enforcesExpiry,
    ).toBe(true);
    for (const target of ["netlify", "vercel", "nginx", "apache"] as const) {
      expect(renderRedirectConfig(target, routes).enforcesExpiry).toBe(false);
    }
  });

  it("never emits a permanent redirect", () => {
    // 301 is cached by the browser indefinitely, so a short link issued as one
    // can never be re-pointed — which is the only reason to have it.
    //
    // Checked against the directives only: every generated file explains this
    // choice in a comment, and those comments name 301 to do so.
    const directives = (contents: string) =>
      contents
        .split("\n")
        .filter((line) => !/^\s*(#|\/\/)/.test(line))
        .join("\n");

    for (const target of [
      "cloudflare-worker",
      "netlify",
      "vercel",
      "nginx",
      "apache",
    ] as const) {
      const config = renderRedirectConfig(target, routes);
      expect(directives(config.contents)).not.toMatch(/\b301\b/);
      expect(directives(config.contents)).toMatch(/\b302\b|permanent/);
    }
    expect(renderRedirectConfig("vercel", routes).contents).toContain(
      '"permanent": false',
    );
  });

  it("warns when an expiry cannot be enforced", () => {
    expect(
      adviseRedirect({ target: "netlify", routes, shortHost: null }).map(
        (finding) => finding.rule,
      ),
    ).toContain("redirect-expiry-not-enforced");
    expect(
      adviseRedirect({
        target: "cloudflare-worker",
        routes,
        shortHost: null,
      }).map((finding) => finding.rule),
    ).not.toContain("redirect-expiry-not-enforced");
  });

  it("catches a short link pointed at itself", () => {
    expect(
      adviseRedirect({
        target: "cloudflare-worker",
        routes: [
          {
            path: "/s/x",
            target: "https://go.example.com/somewhere",
            expiresAt: null,
            fallbackUrl: null,
          },
        ],
        shortHost: "go.example.com",
      }).map((finding) => finding.rule),
    ).toContain("redirect-loops");
  });

  it("notes an expiry with nowhere to land", () => {
    expect(
      adviseRedirect({
        target: "cloudflare-worker",
        routes,
        shortHost: null,
      }).map((finding) => finding.rule),
    ).toContain("redirect-no-fallback");
  });
});
