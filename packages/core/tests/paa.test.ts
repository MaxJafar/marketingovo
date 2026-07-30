// PAA integration tests. Three layers:
//
//   1. parser unit tests with captured Google HTML shapes
//      for each strategy (modern, historical, fallback).
//   2. backend dispatch — serpapi / dataforseo / custom — with
//      mocked fetch so no real network is touched.
//   3. module contract — keyword-research wires paa in
//      without breaking existing tests.
//
// All tests use vitest's `vi.fn()` for fetch, never touch the
// real internet. Live verification is a separate script.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parsePaaFromHtml,
  paaOne,
  paaAll,
  paaBest,
  availableBackends,
  type PaaResult,
} from "../src/integrations/paa.js";

const serpCredentials = { serpapi: { apiKey: "vault-serp-key" } };
const dataForSeoCredentials = {
  dataforseo: { login: "vault-login", password: "vault-password" },
};
const paidCredentials = { ...serpCredentials, ...dataForSeoCredentials };

const capturedModernPaaHtml = `<!doctype html>
<html><body>
<div jsname="cPGTQd">
  <div role="button"><div>how does lighthouse work</div></div>
  <div role="button"><div>what is lighthouse seo</div></div>
  <div role="button"><div>lighthouse vs pagespeed insights</div></div>
  <div role="button"><div>how to read lighthouse report</div></div>
</div>
</body></html>`;

const capturedHistoricalPaaHtml = `<!doctype html>
<html><body>
<div class="related-question-pair">
  <span>what is maxjafar</span>
</div>
<div class="related-question-pair">
  <span>maxjafar vs zapier</span>
</div>
<div class="related-question-pair">
  <span>is maxjafar free</span>
</div>
</body></html>`;

const capturedFallbackPaaHtml = `<!doctype html>
<html><body>
<h2>People also ask</h2>
<h3>how to write seo content</h3>
<h3>what are seo best practices</h3>
<p>some content</p>
<h3>is seo still important in 2026?</h3>
</body></html>`;

const emptyHtml = `<!doctype html><html><body><p>no PAA</p></body></html>`;

describe("parsePaaFromHtml (captured HTML shapes)", () => {
  it("strategy 1 — modern jsname=cPGTQd layout", () => {
    const r = parsePaaFromHtml(capturedModernPaaHtml);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r).toContain("how does lighthouse work");
    expect(r).toContain("lighthouse vs pagespeed insights");
  });

  it("strategy 2 — historical related-question class", () => {
    const r = parsePaaFromHtml(capturedHistoricalPaaHtml);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r).toContain("maxjafar vs zapier");
  });

  it("strategy 3 — h3 ending with ?", () => {
    const r = parsePaaFromHtml(capturedFallbackPaaHtml);
    // Only the third h3 ends with "?", so we expect 1 result from strategy 3.
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0]).toBe("is seo still important in 2026?");
    expect(r.some((q) => q.endsWith("?"))).toBe(true);
  });

  it("returns [] on empty / malformed input", () => {
    expect(parsePaaFromHtml("")).toEqual([]);
    expect(parsePaaFromHtml("   ")).toEqual([]);
    expect(parsePaaFromHtml(emptyHtml)).toEqual([]);
  });

  it("dedupes repeated questions (case-insensitive)", () => {
    const html = `<!doctype html><html><body>
      <div jsname="cPGTQd">
        <div role="button"><div>how does X work</div></div>
        <div role="button"><div>How Does X Work</div></div>
        <div role="button"><div>  how does x work  </div></div>
      </div></body></html>`;
    const r = parsePaaFromHtml(html);
    expect(r.length).toBe(1);
  });
});

describe("paaOne — backend dispatch with mocked fetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("custom backend hits google.com/search and parses the response", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("google.com/search");
      expect(url).toContain(encodeURIComponent("starbucks coffee"));
      return new Response(capturedModernPaaHtml, { status: 200 });
    });
    const r = await paaOne(
      "starbucks coffee",
      "custom",
      5_000,
      fetchImpl as unknown as typeof fetch,
    );
    expect(r.backend).toBe("custom");
    expect(r.error).toBeNull();
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.requiresKey).toBe(false);
    expect(r.usage).toEqual({
      requestMade: true,
      billable: false,
      actualCostUsd: 0,
      costSource: "free",
    });
  });

  it("custom backend surfaces HTTP error in result (no throw)", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("forbidden", { status: 429 }),
    );
    const r = await paaOne(
      "x",
      "custom",
      5_000,
      fetchImpl as unknown as typeof fetch,
    );
    expect(r.error).toContain("HTTP 429");
    expect(r.items).toEqual([]);
  });

  it("serpapi ignores legacy secret env values without vault credentials", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "must-not-be-used");
    const fetchImpl = vi.fn<typeof fetch>();
    const r = await paaOne("x", "serpapi", 5_000, fetchImpl);
    expect(r.error).toContain("credential is not connected");
    expect(r.requiresKey).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serpapi backend parses related_questions array", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("serpapi.com/search.json");
      expect(url).toContain("engine=google");
      return new Response(
        JSON.stringify({
          related_questions: [
            { question: "what is a serp api" },
            { question: "serp api pricing" },
            { question: "serp api vs scraperapi" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const r = await paaOne(
      "serp api",
      "serpapi",
      5_000,
      fetchImpl as unknown as typeof fetch,
      serpCredentials,
    );
    expect(r.error).toBeNull();
    expect(r.items).toEqual([
      "what is a serp api",
      "serp api pricing",
      "serp api vs scraperapi",
    ]);
  });

  it("uses an injected vault key when the legacy environment is empty", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("api_key=vault-only-key");
      return new Response(
        JSON.stringify({ related_questions: [{ question: "vault works" }] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    const result = await paaOne(
      "vault integration",
      "serpapi",
      5_000,
      fetchImpl as unknown as typeof fetch,
      { serpapi: { apiKey: "vault-only-key" } },
    );
    expect(result.items).toEqual(["vault works"]);
  });

  it("dataforseo backend returns error when creds are unset", async () => {
    const r = await paaOne("x", "dataforseo");
    expect(r.error).toContain("credential is not connected");
    expect(r.requiresKey).toBe(true);
  });

  it("dataforseo backend posts to the right endpoint and parses paa items", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain(
        "api.dataforseo.com/v3/serp/google/organic/live/advanced",
      );
      expect(init?.method).toBe("POST");
      const auth =
        (init?.headers as Record<string, string> | undefined)?.Authorization ??
        "";
      expect(auth).toMatch(/^Basic /);
      return new Response(
        JSON.stringify({
          tasks: [
            {
              cost: 0.0025,
              result: [
                {
                  items: [
                    {
                      type: "people_also_ask",
                      items: [
                        {
                          type: "people_also_ask_element",
                          question: "what is dataforseo",
                        },
                        {
                          type: "people_also_ask_element",
                          question: "dataforseo api pricing",
                        },
                        { type: "people_also_ask", question: "WRONG_TYPE" }, // ignored
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const r = await paaOne(
      "dataforseo",
      "dataforseo",
      5_000,
      fetchImpl as unknown as typeof fetch,
      dataForSeoCredentials,
    );
    expect(r.error).toBeNull();
    expect(r.items).toEqual(["what is dataforseo", "dataforseo api pricing"]);
    expect(r.usage.actualCostUsd).toBe(0.0025);
    expect(r.usage.costSource).toBe("provider-reported");
  });
});

describe("paaAll / paaBest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("paaAll runs the configured backends in parallel", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("serpapi.com")) {
        return new Response(
          JSON.stringify({ related_questions: [{ question: "from serpapi" }] }),
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
                      {
                        type: "people_also_ask",
                        items: [
                          {
                            type: "people_also_ask_element",
                            question: "from dataforseo",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(capturedModernPaaHtml, { status: 200 });
    });
    const results = await paaAll("x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      credentials: paidCredentials,
    });
    expect(results).toHaveLength(3);
    const byBackend = new Map(results.map((r) => [r.backend, r]));
    expect(byBackend.get("serpapi")?.items).toEqual(["from serpapi"]);
    expect(byBackend.get("dataforseo")?.items).toEqual(["from dataforseo"]);
    expect(byBackend.get("custom")?.items.length).toBeGreaterThan(0);
  });

  it("paaBest prefers the first non-empty result", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("serpapi.com")) {
        return new Response(
          JSON.stringify({ related_questions: [{ question: "from serpapi" }] }),
          { status: 200 },
        );
      }
      return new Response(emptyHtml, { status: 200 });
    });
    const best: PaaResult = await paaBest("x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      credentials: serpCredentials,
    });
    expect(best.backend).toBe("serpapi");
    expect(best.items).toEqual(["from serpapi"]);
  });

  it("paaBest falls through to custom when serpapi is unset", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(capturedModernPaaHtml, { status: 200 }),
    );
    const best = await paaBest("x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(best.backend).toBe("custom");
    expect(best.items.length).toBeGreaterThan(0);
  });

  it("availableBackends lists only the backends whose creds are present", () => {
    const noCreds = availableBackends();
    expect(noCreds).toEqual(["custom"]);

    const withSerp = availableBackends(serpCredentials);
    expect(withSerp).toContain("serpapi");
    expect(withSerp).toContain("custom");

    const withBoth = availableBackends(paidCredentials);
    expect(withBoth).toEqual(["serpapi", "dataforseo", "custom"]);
  });
});
