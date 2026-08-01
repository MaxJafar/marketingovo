import { describe, expect, it } from "vitest";
import {
  assessBrandPresence,
  sameAsUrls,
  type BrandPresencePage,
} from "../src/integrations/brand-presence.js";

// The whole value of collecting social profiles during onboarding is that the
// crawl can then say whether the site actually connects to them. The matching
// has to survive the ways the same account gets written down — a user pastes
// "https://www.instagram.com/acme/" and the site footer links
// "http://instagram.com/acme" — without matching two genuinely different
// accounts.

const page = (
  url: string,
  externalLinks: string[] = [],
  jsonLd: string[] = [],
): BrandPresencePage => ({ url, externalLinks, jsonLd });

const profiles = [
  { label: "Instagram", url: "https://www.instagram.com/acme/" },
  { label: "LinkedIn", url: "https://linkedin.com/company/acme" },
];

describe("brand profile link matching", () => {
  it("matches across protocol, www and a trailing slash", () => {
    const [instagram] = assessBrandPresence(profiles, [
      page("https://acme.test/", ["http://instagram.com/acme"]),
    ]);
    expect(instagram!.linkingPageCount).toBe(1);
    expect(instagram!.linkedFrom).toEqual(["https://acme.test/"]);
  });

  it("ignores query strings and fragments on either side", () => {
    const [instagram] = assessBrandPresence(profiles, [
      page("https://acme.test/", [
        "https://instagram.com/acme?utm_source=footer#top",
      ]),
    ]);
    expect(instagram!.linkingPageCount).toBe(1);
  });

  // The dangerous false positive: a different account on the same platform.
  it("does not match a different handle on the same platform", () => {
    const [instagram] = assessBrandPresence(profiles, [
      page("https://acme.test/", ["https://instagram.com/acme-competitor"]),
    ]);
    expect(instagram!.linkingPageCount).toBe(0);
    expect(instagram!.linkedFrom).toEqual([]);
  });

  it("counts a page once even when it links the profile repeatedly", () => {
    const [instagram] = assessBrandPresence(profiles, [
      page("https://acme.test/", [
        "https://instagram.com/acme",
        "https://www.instagram.com/acme/",
      ]),
    ]);
    expect(instagram!.linkingPageCount).toBe(1);
  });

  it("reports the full count while sampling the pages it names", () => {
    const pages = Array.from({ length: 9 }, (_, index) =>
      page(`https://acme.test/p${index}`, ["https://instagram.com/acme"]),
    );
    const [instagram] = assessBrandPresence(profiles, pages);
    expect(instagram!.linkingPageCount).toBe(9);
    expect(instagram!.linkedFrom).toHaveLength(3);
  });

  // An unlinked profile is the actual finding this feature exists to surface.
  it("reports a profile no page links to", () => {
    const result = assessBrandPresence(profiles, [page("https://acme.test/")]);
    const linkedIn = result.find((entry) => entry.label === "LinkedIn")!;
    expect(linkedIn.linkingPageCount).toBe(0);
    expect(linkedIn.declaredInSameAs).toBe(false);
  });

  // Reachability costs a request, so the pure pass must not imply an answer.
  it("leaves reachability unchecked rather than assuming", () => {
    const [instagram] = assessBrandPresence(profiles, [
      page("https://acme.test/"),
    ]);
    expect(instagram!.reachability).toBe("unchecked");
  });

  it("drops an unparseable profile instead of reporting it as unlinked", () => {
    const result = assessBrandPresence(
      [{ label: "Broken", url: "not a url" }],
      [page("https://acme.test/")],
    );
    expect(result).toEqual([]);
  });

  it("refuses a non-HTTP profile scheme", () => {
    expect(
      assessBrandPresence(
        [{ label: "Mail", url: "mailto:hi@acme.test" }],
        [page("https://acme.test/")],
      ),
    ).toEqual([]);
  });

  it("keeps one entry when the same profile is listed twice", () => {
    const result = assessBrandPresence(
      [
        { label: "Instagram", url: "https://instagram.com/acme" },
        { label: "IG", url: "https://www.instagram.com/acme/" },
      ],
      [page("https://acme.test/", ["https://instagram.com/acme"])],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.linkingPageCount).toBe(1);
  });
});

describe("sameAs declarations", () => {
  const organization = (sameAs: unknown) =>
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
      sameAs,
    });

  it("reads sameAs as an array", () => {
    expect(
      sameAsUrls([
        organization(["https://instagram.com/acme", "https://x.com/acme"]),
      ]),
    ).toEqual(["https://instagram.com/acme", "https://x.com/acme"]);
  });

  it("reads sameAs given as a single string", () => {
    expect(sameAsUrls([organization("https://instagram.com/acme")])).toEqual([
      "https://instagram.com/acme",
    ]);
  });

  it("finds sameAs nested inside an @graph", () => {
    const graph = JSON.stringify({
      "@graph": [
        { "@type": "WebSite" },
        {
          "@type": "Organization",
          sameAs: ["https://linkedin.com/company/acme"],
        },
      ],
    });
    expect(sameAsUrls([graph])).toEqual(["https://linkedin.com/company/acme"]);
  });

  it("ignores malformed JSON-LD rather than throwing", () => {
    expect(
      sameAsUrls(["{not json", organization(["https://x.com/acme"])]),
    ).toEqual(["https://x.com/acme"]);
  });

  it("survives a deeply nested document without recursing forever", () => {
    let nested: Record<string, unknown> = { sameAs: "https://x.com/acme" };
    for (let depth = 0; depth < 200; depth += 1) nested = { child: nested };
    expect(() => sameAsUrls([JSON.stringify(nested)])).not.toThrow();
  });

  it("marks a profile declared in sameAs even when no anchor links it", () => {
    const [instagram] = assessBrandPresence(profiles, [
      page(
        "https://acme.test/",
        [],
        [organization(["https://instagram.com/acme"])],
      ),
    ]);
    expect(instagram!.declaredInSameAs).toBe(true);
    // Declared but not linked is a real and distinct state.
    expect(instagram!.linkingPageCount).toBe(0);
  });
});
