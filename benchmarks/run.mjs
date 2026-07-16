import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { crawl } from "../packages/core/dist/index.js";
import { assessCorpus, validateCorpusManifest } from "./corpus-metrics.mjs";

const root = resolve(import.meta.dirname, "..");
const fixtureRoot = resolve(root, "examples/demo-site");
const manifest = validateCorpusManifest(
  JSON.parse(
    await readFile(
      resolve(import.meta.dirname, "corpus/manifest.json"),
      "utf8",
    ),
  ),
);
const routeFiles = new Map([
  ["/", "index.html"],
  ["/untitled", "untitled.html"],
  ["/no-h1", "no-h1.html"],
  ["/image", "image.html"],
  ["/duplicate-a", "duplicate-a.html"],
  ["/duplicate-b", "duplicate-b.html"],
  ["/missing-meta", "missing-meta.html"],
  ["/long-title", "long-title.html"],
  ["/long-description", "long-description.html"],
  ["/multiple-h1", "multiple-h1.html"],
  ["/no-canonical", "no-canonical.html"],
  ["/noindex", "noindex.html"],
  ["/no-viewport", "no-viewport.html"],
  ["/duplicate-id", "duplicate-id.html"],
  ["/bad-jsonld", "bad-jsonld.html"],
  ["/very-thin", "very-thin.html"],
  ["/soft-404", "soft-404.html"],
  ["/picture-no-fallback", "picture-no-fallback.html"],
  ["/canonical-broken", "canonical-broken.html"],
  ["/redirect-target", "redirect-target.html"],
  ["/healthy-a", "healthy-a.html"],
  ["/healthy-b", "healthy-b.html"],
  ["/pixel.svg", "pixel.svg"],
]);
const longCopy = (route) => {
  const token = route.replace(/\W+/gu, "") || "index";
  return Array.from(
    { length: 18 },
    (_, index) =>
      `The ${token} benchmark page gives teams clear search data so they can plan useful changes and verify results with calm review number ${index + 1}.`,
  ).join(" ");
};

let origin = "";
const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", origin).pathname;
  if (path === "/robots.txt") {
    response.writeHead(200, {
      "content-type": "text/plain",
      "x-content-type-options": "nosniff",
    });
    response.end("User-agent: *\nAllow: /\n");
    return;
  }
  if (path === "/sitemap.xml") {
    response.writeHead(200, {
      "content-type": "application/xml",
      "x-content-type-options": "nosniff",
    });
    response.end(
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
        ...routeFiles.keys(),
      ]
        .filter((route) => !route.endsWith(".svg"))
        .map((route) => `<url><loc>${origin}${route}</loc></url>`)
        .join("")}</urlset>`,
    );
    return;
  }
  if (path === "/redirect-source") {
    response.writeHead(302, {
      location: "/redirect-target",
      "x-content-type-options": "nosniff",
    });
    response.end();
    return;
  }
  if (path === "/server-error") {
    response.writeHead(503, {
      "content-type": "text/html; charset=utf-8",
      "retry-after": "60",
      "x-content-type-options": "nosniff",
    });
    response.end(
      '<!doctype html><html lang="en"><title>Temporary benchmark failure</title><h1>Temporary failure</h1></html>',
    );
    return;
  }
  const file = routeFiles.get(path);
  if (!file) {
    response.writeHead(404, {
      "content-type": "text/html",
      "x-content-type-options": "nosniff",
    });
    response.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
    return;
  }
  const source = await readFile(resolve(fixtureRoot, file), "utf8");
  const body = source
    .replaceAll("{{ORIGIN}}", origin)
    .replaceAll("{{COPY}}", longCopy(path));
  response.writeHead(200, {
    "content-type":
      extname(file) === ".svg" ? "image/svg+xml" : "text/html; charset=utf-8",
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'self'",
    "referrer-policy": "no-referrer",
  });
  response.end(body);
});

await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Unable to start benchmark fixture");
origin = `http://127.0.0.1:${address.port}`;
const startedAt = performance.now();
try {
  const result = await crawl({
    startUrl: `${origin}/`,
    renderMode: "static",
    collectVitals: false,
    limits: {
      allowPrivate: true,
      maxUrls: 40,
      maxDepth: 4,
      maxConcurrency: 3,
      requestsPerSecond: 30,
    },
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const correctness = assessCorpus(manifest, result.report.issues);
  const configuredBaseline = Number(
    process.env.GOLEMSEO_BENCHMARK_BASELINE_MS ?? manifest.baselineElapsedMs,
  );
  if (!Number.isFinite(configuredBaseline) || configuredBaseline <= 0)
    throw new Error("Benchmark baseline must be a positive number");
  const maximumElapsedMs =
    configuredBaseline * (1 + manifest.maximumRegressionPercent / 100);
  const performancePassed = elapsedMs <= maximumElapsedMs;
  const report = {
    corpus: manifest.name,
    corpusVersion: manifest.version,
    elapsedMs,
    pagesCrawled: result.report.summary.pagesCrawled,
    ...correctness,
    baselineElapsedMs: configuredBaseline,
    maximumElapsedMs,
    performanceRegressionPercent:
      ((elapsedMs - configuredBaseline) / configuredBaseline) * 100,
    performancePassed,
    passed: correctness.correctnessPassed && performancePassed,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}
