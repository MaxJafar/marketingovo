import { describe, it, expect } from "vitest";
import { extractMainContent } from "../src/integrations/content-extract.js";
import {
  buildVector,
  computeContentGap,
} from "../src/integrations/content-gap.js";

describe("content-extract", () => {
  it("strips script and style tags", () => {
    const html = `<html><body>
      <script>var x = 1;</script>
      <style>body { color: red; }</style>
      <p>hello world hello again</p>
    </body></html>`;
    const r = extractMainContent(html);
    expect(r.text.toLowerCase()).toContain("hello world");
    expect(r.text.toLowerCase()).not.toContain("var x");
    expect(r.text.toLowerCase()).not.toContain("color: red");
  });

  it("prefers <article> over <body>", () => {
    const html = `<html><body>
      <nav>navigation noise</nav>
      <article><p>real content with multiple words here</p></article>
      <footer>footer noise</footer>
    </body></html>`;
    const r = extractMainContent(html);
    expect(r.root).toBe("article");
    expect(r.text.toLowerCase()).toContain("real content");
    // nav/footer text might still slip in via body fallback, but the
    // article root should keep things contained.
  });

  it("filters out stopwords and pure numbers", () => {
    const html = `<html><body><p>the openclaw hosting is great 12345</p></body></html>`;
    const r = extractMainContent(html);
    expect(r.words).toContain("openclaw");
    expect(r.words).toContain("hosting");
    expect(r.words).toContain("great");
    expect(r.words).not.toContain("the");
    expect(r.words).not.toContain("is");
    expect(r.words).not.toContain("12345");
  });

  it("returns wordCount and at least one word for real content", () => {
    const r = extractMainContent(
      "<html><body><article><p>OpenClaw is a platform for AI agents that run on dedicated servers.</p></article></body></html>",
    );
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.words.length).toBe(r.wordCount);
  });
});

describe("content-gap", () => {
  function docOf(text: string, url = "test") {
    return {
      url,
      doc: extractMainContent(
        `<html><body><article><p>${text}</p></article></body></html>`,
      ),
      vector: null as never,
    };
  }
  function vec(d: { url: string; doc: ReturnType<typeof extractMainContent> }) {
    return { ...d, vector: buildVector(d.doc) };
  }

  it("finds terms present in references but missing in target", () => {
    const target = vec(
      docOf("OpenClaw is a platform. It runs agents.", "target"),
    );
    const ref1 = vec(
      docOf(
        "OpenClaw is a managed platform for AI agent hosting with dedicated servers and backups.",
        "ref1",
      ),
    );
    const ref2 = vec(
      docOf(
        "OpenClaw provides managed AI agent hosting on dedicated servers with 24/7 monitoring and backups.",
        "ref2",
      ),
    );
    const report = computeContentGap(target, [ref1, ref2]);
    // "backups", "dedicated", "servers", "monitoring", "managed" should appear as missing
    const terms = report.missing.map((m) => m.term);
    expect(terms).toContain("backups");
    expect(terms).toContain("dedicated");
    expect(terms).toContain("servers");
  });

  it("does not flag terms already present in target", () => {
    const target = vec(
      docOf(
        "OpenClaw is a managed AI platform with dedicated servers and backups and monitoring.",
        "target",
      ),
    );
    const ref1 = vec(
      docOf(
        "OpenClaw provides managed AI agent hosting on dedicated servers with 24/7 monitoring and backups.",
        "ref1",
      ),
    );
    const report = computeContentGap(target, [ref1]);
    const terms = report.missing.map((m) => m.term);
    expect(terms).not.toContain("backups");
    expect(terms).not.toContain("dedicated");
    expect(terms).not.toContain("managed");
  });

  it("handles empty reference set gracefully", () => {
    const target = vec(docOf("some content here", "target"));
    const report = computeContentGap(target, []);
    expect(report.missing).toHaveLength(0);
    expect(report.errors).toContain("no reference documents provided");
  });

  it("respects topN option", () => {
    const target = vec(docOf("tiny target", "target"));
    const refTexts = Array.from(
      { length: 5 },
      (_, i) =>
        `reference content with terms aaa${i} bbb${i} ccc${i} ddd${i} eee${i} fff${i} ggg${i} hhh${i} iii${i} jjj${i} kkk${i} lll${i} mmm${i} nnn${i} ooo${i} ppp${i} qqq${i} rrr${i} sss${i} ttt${i}`,
    );
    const refs = refTexts.map((t, i) => vec(docOf(t, `ref${i}`)));
    const report = computeContentGap(target, refs, { topN: 5 });
    expect(report.missing.length).toBeLessThanOrEqual(5);
  });

  it("respects minRefRatio: terms appearing in only 1 of 4 refs are excluded", () => {
    const target = vec(docOf("tiny", "target"));
    // 4 refs: only the first contains "alpha"
    const refs = [
      vec(docOf("alpha bravo charlie delta", "ref1")),
      vec(docOf("bravo charlie delta echo", "ref2")),
      vec(docOf("bravo charlie delta foxtrot", "ref3")),
      vec(docOf("bravo charlie delta golf", "ref4")),
    ];
    const report = computeContentGap(target, refs, { minRefRatio: 0.5 });
    // minRefCount for 4 refs at 0.5 = ceil(2) = 2. "alpha" appears in 1, so excluded.
    const terms = report.missing.map((m) => m.term);
    expect(terms).not.toContain("alpha");
  });

  it("computes perReference coverage correctly", () => {
    const target = vec(docOf("target", "target"));
    const ref1 = vec(docOf("alpha bravo charlie", "ref1"));
    const ref2 = vec(docOf("alpha bravo delta", "ref2"));
    const report = computeContentGap(target, [ref1, ref2]);
    expect(report.perReference).toHaveLength(2);
    expect(report.perReference[0]!.url).toBe("ref1");
    // The top-N terms are the ones that appear in >= minRefRatio of refs.
    // ref1 matches: alpha (1), bravo (1), charlie (1), maybe others depending on threshold.
    // The totalCandidateTerms is the same across refs (it's the size of the top-N set).
    expect(report.perReference[0]!.totalCandidateTerms).toBe(
      report.perReference[1]!.totalCandidateTerms,
    );
  });
});
