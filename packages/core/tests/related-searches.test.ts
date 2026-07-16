// Related-Searches integration tests. Mirrors paa.test.ts:
// parser unit tests with captured HTML + backend dispatch
// with mocked fetch.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseRelatedFromHtml,
  relatedOne,
  relatedAll,
  relatedBest,
  availableBackends,
} from "../src/integrations/related-searches.js";

const serpCredentials = { serpapi: { apiKey: "vault-serp-key" } };
const dataForSeoCredentials = {
  dataforseo: { login: "vault-login", password: "vault-password" },
};
const paidCredentials = { ...serpCredentials, ...dataForSeoCredentials };

const capturedModernRelatedHtml = `<!doctype html>
<html><body>
<h2>People also search for</h2>
<div>
  <a href="/search?q=seo+tools+free">seo tools free</a>
  <a href="/search?q=best+seo+tools+2026">best seo tools 2026</a>
  <a href="/search?q=seo+software+comparison">seo software comparison</a>
  <a href="/search?q=lighthouse+seo">lighthouse seo</a>
  <a href="/search?q=ahrefs+vs+screaming+frog">ahrefs vs screaming frog</a>
</div>
</body></html>`;

const capturedSectionHeaderHtml = `<!doctype html>
<html><body>
<div role='heading' aria-level='3'>Related searches</div>
<div><a href="/search?q=x">seo audit tool</a></div>
<div><a href="/search?q=y">free seo checker</a></div>
<div><a href="/search?q=z">website audit</a></div>
<div><a href="/search?q=w">seo health check</a></div>
</body></html>`;

const capturedFallbackHtml = `<!doctype html>
<html><body>
<a href="/search?q=fallback+1">fallback related 1</a>
<a href="/search?q=fallback+2">fallback related 2</a>
<a href="/search?q=fallback+3">fallback related 3</a>
<a href="/search?q=fallback+4">fallback related 4</a>
</body></html>`;

const emptyHtml = `<!doctype html><html><body><p>nothing</p></body></html>`;

describe("parseRelatedFromHtml (captured HTML shapes)", () => {
  it("strategy 1 — modern layout with 'People also search for' header", () => {
    const r = parseRelatedFromHtml(capturedModernRelatedHtml);
    expect(r).toContain("seo tools free");
    expect(r).toContain("ahrefs vs screaming frog");
    expect(r.length).toBeGreaterThanOrEqual(5);
  });

  it("strategy 1 — alt section header text 'Related searches'", () => {
    const r = parseRelatedFromHtml(capturedSectionHeaderHtml);
    expect(r).toContain("seo audit tool");
    expect(r.length).toBeGreaterThanOrEqual(4);
  });

  it("strategy 3 — fallback collects /search? anchors", () => {
    const r = parseRelatedFromHtml(capturedFallbackHtml);
    expect(r).toContain("fallback related 1");
    expect(r.length).toBeGreaterThanOrEqual(4);
  });

  it("returns [] on empty / malformed input", () => {
    expect(parseRelatedFromHtml("")).toEqual([]);
    expect(parseRelatedFromHtml(emptyHtml)).toEqual([]);
  });

  it("filters out question-shaped and too-short / too-long entries", () => {
    const longText = "a".repeat(120);
    const html = `<!doctype html><html><body>
      <a href="/search?q=a">ab</a>
      <a href="/search?q=c">${longText}</a>
      <a href="/search?q=d">why is this a question?</a>
      <a href="/search?q=e">valid related term</a>
      </body></html>`;
    const r = parseRelatedFromHtml(html);
    // "ab" is too short (<3), the 120-char entry is filtered, "?" entries filtered.
    // "valid related term" (length 18) is the only survivor.
    expect(r).toEqual(["valid related term"]);
  });
});

describe("relatedOne — backend dispatch with mocked fetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("custom backend hits google.com/search and parses the response", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("google.com/search");
      return new Response(capturedModernRelatedHtml, { status: 200 });
    });
    const r = await relatedOne(
      "seo tools",
      "custom",
      5_000,
      fetchImpl as unknown as typeof fetch,
    );
    expect(r.backend).toBe("custom");
    expect(r.error).toBeNull();
    expect(r.items).toContain("seo tools free");
    expect(r.requiresKey).toBe(false);
    expect(r.usage.actualCostUsd).toBe(0);
    expect(r.usage.costSource).toBe("free");
  });

  it("custom backend surfaces HTTP error in result", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("blocked", { status: 403 }),
    );
    const r = await relatedOne(
      "x",
      "custom",
      5_000,
      fetchImpl as unknown as typeof fetch,
    );
    expect(r.error).toContain("HTTP 403");
    expect(r.items).toEqual([]);
  });

  it("serpapi ignores legacy secret env values without vault credentials", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "must-not-be-used");
    const fetchImpl = vi.fn<typeof fetch>();
    const r = await relatedOne("x", "serpapi", 5_000, fetchImpl);
    expect(r.error).toContain("credential is not connected");
    expect(r.requiresKey).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serpapi backend parses related_searches array", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            related_searches: [
              { query: "serp api alternatives" },
              { query: "serpapi pricing" },
              { query: "serpapi vs value serps" },
            ],
          }),
          { status: 200 },
        ),
    );
    const r = await relatedOne(
      "serp api",
      "serpapi",
      5_000,
      fetchImpl as unknown as typeof fetch,
      serpCredentials,
    );
    expect(r.items).toEqual([
      "serp api alternatives",
      "serpapi pricing",
      "serpapi vs value serps",
    ]);
  });

  it("dataforseo backend returns error when creds are unset", async () => {
    const r = await relatedOne("x", "dataforseo");
    expect(r.error).toContain("credential is not connected");
    expect(r.requiresKey).toBe(true);
  });

  it("dataforseo backend posts and parses related_searches items", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("api.dataforseo.com");
      expect(init?.method).toBe("POST");
      return new Response(
        JSON.stringify({
          tasks: [
            {
              cost: 0.0017,
              result: [
                {
                  items: [
                    { type: "organic", title: "ignore" },
                    {
                      type: "related_searches",
                      title: "dataforseo alternative",
                    },
                    { type: "related_searches", title: "dataforseo review" },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const r = await relatedOne(
      "dataforseo",
      "dataforseo",
      5_000,
      fetchImpl as unknown as typeof fetch,
      dataForSeoCredentials,
    );
    expect(r.items).toEqual(["dataforseo alternative", "dataforseo review"]);
    expect(r.usage.actualCostUsd).toBe(0.0017);
    expect(r.usage.costSource).toBe("provider-reported");
  });
});

describe("relatedAll / relatedBest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("relatedBest returns the highest-priority non-empty result", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("serpapi.com")) {
        return new Response(
          JSON.stringify({ related_searches: [{ query: "from serpapi" }] }),
          { status: 200 },
        );
      }
      return new Response(emptyHtml, { status: 200 });
    });
    const best = await relatedBest("x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      credentials: serpCredentials,
    });
    expect(best.backend).toBe("serpapi");
    expect(best.items).toEqual(["from serpapi"]);
  });

  it("relatedBest falls through to custom when no creds are set", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(capturedModernRelatedHtml, { status: 200 }),
    );
    const best = await relatedBest("x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(best.backend).toBe("custom");
    expect(best.items.length).toBeGreaterThan(0);
  });

  it("relatedAll runs the configured backends in parallel", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("serpapi.com")) {
        return new Response(
          JSON.stringify({ related_searches: [{ query: "from serpapi" }] }),
          { status: 200 },
        );
      }
      if (url.includes("dataforseo.com")) {
        return new Response(
          JSON.stringify({
            tasks: [
              {
                result: [
                  {
                    items: [
                      { type: "related_searches", title: "from dataforseo" },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(capturedModernRelatedHtml, { status: 200 });
    });
    const results = await relatedAll("x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      credentials: paidCredentials,
    });
    expect(results).toHaveLength(3);
    const byBackend = new Map(results.map((r) => [r.backend, r]));
    expect(byBackend.get("serpapi")?.items).toEqual(["from serpapi"]);
    expect(byBackend.get("dataforseo")?.items).toEqual(["from dataforseo"]);
    expect(byBackend.get("custom")?.items.length).toBeGreaterThan(0);
  });

  it("availableBackends lists only the backends whose creds are present", () => {
    expect(availableBackends()).toEqual(["custom"]);

    expect(availableBackends(paidCredentials)).toEqual([
      "serpapi",
      "dataforseo",
      "custom",
    ]);
  });
});
