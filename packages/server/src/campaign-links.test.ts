import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";
const ORIGIN = "http://127.0.0.1:3210";

/**
 * Campaign links, end to end.
 *
 * The property worth defending is that this surface refuses rather than warns.
 * Everywhere else in this product a problem is recorded and the work carries
 * on, which is right when the output can be corrected. A QR code cannot be:
 * once it is on ten thousand leaflets the tagging inside it is fixed for the
 * life of the paper. So tagging that would lose data has to fail at creation,
 * not appear as a note beside a code somebody already sent to print.
 */
describe("campaign links", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-campaign-links-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const serviceToken = readFileSync(server.serviceTokenPath, "utf8").trim();
    const headers = {
      host: HOST,
      authorization: `Bearer ${serviceToken}`,
      origin: ORIGIN,
    };
    const project = await runtime.projects.create({
      name: "Link workspace",
      canonicalUrl: "https://example.com",
    });
    return { server, runtime, headers, projectId: project.id };
  }

  const goodUtm = {
    source: "flyer",
    medium: "referral",
    campaign: "summer-sale-2026",
    term: null,
    content: null,
  };

  it("builds a tagged URL and a scannable code", async () => {
    const { server, headers, projectId } = await setup();
    const response = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: {
        label: "Café window",
        destinationUrl: "https://example.com/summer",
        utm: goodUtm,
        placement: "print-handheld",
        printedWidthMm: 40,
      },
    });

    expect(response.statusCode).toBe(201);
    const link = response.json() as {
      id: string;
      taggedUrl: string;
      printedAt: string | null;
    };
    const tagged = new URL(link.taggedUrl);
    expect(tagged.searchParams.get("utm_source")).toBe("flyer");
    expect(tagged.searchParams.get("utm_medium")).toBe("referral");
    expect(tagged.searchParams.get("utm_campaign")).toBe("summer-sale-2026");
    expect(tagged.pathname).toBe("/summer");
    expect(link.printedAt).toBeNull();
  });

  it("refuses tagging that would split one campaign into two rows", async () => {
    const { server, headers, projectId } = await setup();
    const response = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: {
        label: "Capitalised",
        destinationUrl: "https://example.com/summer",
        utm: { ...goodUtm, source: "Flyer Q3" },
      },
    });

    expect(response.statusCode).toBe(422);
    const problem = response.json() as {
      code: string;
      findings: Array<{ rule: string; remedy: string | null }>;
    };
    expect(problem.code).toBe("campaign_link_invalid");
    // The remedy carries the corrected value, so the caller can act without
    // knowing the convention.
    const rules = problem.findings.map((finding) => finding.rule);
    expect(rules).toContain("utm-mixed-case");
    expect(rules).toContain("utm-whitespace");
    expect(problem.findings[0]?.remedy).toContain("flyer-q3");
  });

  it("refuses manual tagging on an already auto-tagged link", async () => {
    const { server, headers, projectId } = await setup();
    const response = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: {
        label: "Paid search landing",
        destinationUrl: "https://example.com/offer?gclid=abc123",
        utm: goodUtm,
      },
    });

    expect(response.statusCode).toBe(422);
    expect((response.json() as { detail: string }).detail).toMatch(
      /only the platform can supply/,
    );
  });

  it("refuses a second link with identical tagging", async () => {
    const { server, headers, projectId } = await setup();
    const payload = {
      label: "First",
      destinationUrl: "https://example.com/summer",
      utm: goodUtm,
    };
    const first = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: { ...payload, label: "Second" },
    });
    expect(second.statusCode).toBe(409);
    // Named, so the operator finds the link they already have rather than
    // wondering which one collided.
    expect((second.json() as { detail: string }).detail).toContain("First");
  });

  it("judges scannability against the width it will be printed at", async () => {
    const { server, headers, projectId } = await setup();
    const request = (printedWidthMm: number) =>
      server.app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/campaign-links/preview`,
        headers,
        payload: {
          destinationUrl: "https://example.com/a-reasonably-long-landing-page",
          utm: goodUtm,
          placement: "packaging",
          printedWidthMm,
        },
      });

    const tiny = (await request(12)).json() as {
      advice: { verdict: string; recommendedWidthMm: number };
      findings: Array<{ rule: string; severity: string }>;
    };
    expect(tiny.advice.verdict).toBe("unscannable");
    expect(
      tiny.findings.some(
        (finding) =>
          finding.rule === "qr-too-small" && finding.severity === "blocking",
      ),
    ).toBe(true);

    // The advice names a width that actually works, and it does.
    const fixed = (await request(tiny.advice.recommendedWidthMm)).json() as {
      advice: { verdict: string };
    };
    expect(fixed.advice.verdict).toBe("comfortable");
  });

  it("refuses colours a scanner cannot separate", async () => {
    const { server, headers, projectId } = await setup();
    const response = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links/preview`,
      headers,
      payload: {
        destinationUrl: "https://example.com/summer",
        utm: goodUtm,
        printedWidthMm: 60,
        // A brand palette that looks fine and thresholds to a single tone.
        style: { darkColor: "#8a8a8a", lightColor: "#a0a0a0" },
      },
    });

    const preview = response.json() as {
      advice: { contrastRatio: number };
      findings: Array<{ rule: string; severity: string }>;
    };
    expect(preview.advice.contrastRatio).toBeLessThan(3);
    expect(
      preview.findings.some(
        (finding) =>
          finding.rule === "qr-low-contrast" && finding.severity === "blocking",
      ),
    ).toBe(true);
  });

  it("serves the code as SVG and as PNG", async () => {
    const { server, headers, projectId } = await setup();
    const created = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: {
        label: "Poster",
        destinationUrl: "https://example.com/summer",
        utm: goodUtm,
        placement: "print-poster",
        printedWidthMm: 120,
      },
    });
    const { id } = created.json() as { id: string };

    const svg = await server.app.inject({
      method: "GET",
      url: `/api/v1/campaign-links/${id}/qr?format=svg`,
      headers,
    });
    expect(svg.statusCode).toBe(200);
    expect(svg.headers["content-type"]).toContain("image/svg+xml");
    expect(svg.body).toContain("<svg");

    const png = await server.app.inject({
      method: "GET",
      url: `/api/v1/campaign-links/${id}/qr?format=png&scale=4`,
      headers,
    });
    expect(png.statusCode).toBe(200);
    expect(png.headers["content-type"]).toContain("image/png");
    expect([...png.rawPayload.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
  });

  it("says plainly which redirect targets can enforce an expiry", async () => {
    const { server, headers, projectId } = await setup();
    await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: {
        label: "Summer",
        destinationUrl: "https://example.com/summer",
        utm: goodUtm,
      },
    });

    const worker = (
      await server.app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/campaign-links/redirect-config`,
        headers,
        payload: {
          target: "cloudflare-worker",
          expiresAt: "2026-10-01T00:00:00.000Z",
        },
      })
    ).json() as { enforcesExpiry: boolean; contents: string; filename: string };

    expect(worker.enforcesExpiry).toBe(true);
    expect(worker.filename).toBe("worker.js");
    expect(worker.contents).toContain("Date.parse(route.expiresAt)");
    // 302, never 301: a permanent redirect is cached by the browser forever,
    // which is exactly what makes a short link impossible to re-point.
    expect(worker.contents).toContain("302");
    expect(worker.contents).not.toMatch(/,\s*301\s*\)/);

    const netlify = (
      await server.app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/campaign-links/redirect-config`,
        headers,
        payload: {
          target: "netlify",
          expiresAt: "2026-10-01T00:00:00.000Z",
        },
      })
    ).json() as {
      enforcesExpiry: boolean;
      notes: string[];
      findings: Array<{ rule: string }>;
    };

    expect(netlify.enforcesExpiry).toBe(false);
    expect(netlify.notes.join(" ")).toMatch(/cannot expire a link on its own/);
    expect(netlify.findings.map((finding) => finding.rule)).toContain(
      "redirect-expiry-not-enforced",
    );
  });

  it("keeps the tagged URL out of the editable fields", async () => {
    const { server, headers, projectId } = await setup();
    const created = await server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/campaign-links`,
      headers,
      payload: {
        label: "Original",
        destinationUrl: "https://example.com/summer",
        utm: goodUtm,
      },
    });
    const link = created.json() as { id: string; taggedUrl: string };

    // A printed code cannot follow an edit, so the schema has no field for it.
    const rejected = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/campaign-links/${link.id}`,
      headers,
      payload: { destinationUrl: "https://example.com/elsewhere" },
    });
    expect(rejected.statusCode).toBe(400);

    const renamed = await server.app.inject({
      method: "PATCH",
      url: `/api/v1/campaign-links/${link.id}`,
      headers,
      payload: { label: "Renamed" },
    });
    expect(renamed.statusCode).toBe(200);
    const updated = renamed.json() as { label: string; taggedUrl: string };
    expect(updated.label).toBe("Renamed");
    expect(updated.taggedUrl).toBe(link.taggedUrl);
  });
});
