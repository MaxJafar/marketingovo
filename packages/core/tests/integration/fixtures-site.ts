// Integration fixture: a synthetic website served by node:http that
// exercises every check in v0.2. Used for MVT and as a regression
// suite for the whole pipeline (crawl + render + parse + checks).
//
// Endpoints:
//   /            -> 200, no meta description, no canonical, no viewport
//   /has-all     -> 200, has title, meta, canonical, viewport, alt
//   /no-h1       -> 200, no H1
//   /multi-h1    -> 200, two H1s
//   /noindex     -> 200, noindex
//   /broken      -> 404
//   /soft-404    -> 200, title "Page not found", thin body
//   /dup-1       -> 200, title "Best running shoes for marathon training 2026"
//   /dup-2       -> 200, title "Best running shoes for marathon training 2025"
//   /jsonld-bad  -> 200, malformed JSON-LD block
//   /jsonld-ok   -> 200, valid JSON-LD
//   /hreflang-no -> 200, hreflang to /x but /x has no reciprocal
//   /hreflang-ok -> 200, hreflang reciprocated
//   /robots.txt  -> Disallow /private
//   /private/x   -> blocked by robots
//   /sitemap.xml -> sitemap index pointing to /sitemap-pages.xml
//   /sitemap-pages.xml -> URL set listing /, /has-all and /broken
//   /mixed       -> 200, https page with http image (mixed content)
//   /redirect    -> 302 -> /has-all

import { createServer, type Server } from "node:http";

export interface FixtureSite {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startFixtureSite(): Promise<FixtureSite> {
  const server: Server = createServer((req, res) => {
    const url = req.url ?? "/";
    const send = (
      status: number,
      body: string,
      type = "text/html; charset=utf-8",
    ): void => {
      res.writeHead(status, { "content-type": type });
      res.end(body);
    };

    if (url === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("User-agent: *\nDisallow: /private/\n");
      return;
    }
    if (url.startsWith("/private/")) {
      send(
        200,
        "<html><head><title>Private</title></head><body>Should not be crawled</body></html>",
      );
      return;
    }
    if (url === "/sitemap.xml") {
      const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex>
  <sitemap><loc>${base}/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`,
      );
      return;
    }
    if (url === "/sitemap-pages.xml") {
      const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>${base}/</loc></url>
  <url><loc>${base}/has-all</loc></url>
  <url><loc>${base}/broken</loc></url>
</urlset>`,
      );
      return;
    }
    if (url === "/redirect") {
      res.writeHead(302, { location: "/has-all" });
      res.end();
      return;
    }
    if (url === "/") {
      send(
        200,
        `<!doctype html><html><head><title>Home page</title></head><body>
        <h1>Home</h1>
        <ul>
          <li><a href="/has-all">A</a></li>
          <li><a href="/no-h1">B</a></li>
          <li><a href="/multi-h1">C</a></li>
          <li><a href="/noindex">D</a></li>
          <li><a href="/broken">broken</a></li>
          <li><a href="/soft-404">F</a></li>
          <li><a href="/dup-1">G</a></li>
          <li><a href="/dup-2">H</a></li>
          <li><a href="/jsonld-bad">I</a></li>
          <li><a href="/jsonld-ok">J</a></li>
          <li><a href="/hreflang-no">K</a></li>
          <li><a href="/hreflang-target-en">K-en</a></li>
          <li><a href="/hreflang-ok">L</a></li>
          <li><a href="/hreflang-ok-en">L-en</a></li>
          <li><a href="/hreflang-ok-de">L-de</a></li>
          <li><a href="/mixed">M</a></li>
          <li><a href="/redirect">R</a></li>
          <li><a href="/no-title">T</a></li>
        </ul>
      </body></html>`,
      );
      return;
    }
    if (url === "/has-all") {
      send(
        200,
        `<!doctype html><html lang="en"><head>
        <title>Has all the things</title>
        <meta name="description" content="A page with everything we expect">
        <link rel="canonical" href="FIXTURE_BASE/has-all">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head><body><h1>Has all</h1><img src="/x.png" alt="x"></body></html>`.replace(
          /FIXTURE_BASE/g,
          "",
        ),
      );
      return;
    }
    if (url === "/no-h1") {
      send(
        200,
        `<!doctype html><html><head><title>Page without H1 title</title></head><body><p>no h1</p><img src="/o.png"></body></html>`,
      );
      return;
    }
    if (url === "/multi-h1") {
      send(
        200,
        `<!doctype html><html><head><title>Page with multiple H1</title></head><body><h1>One</h1><h1>Two</h1></body></html>`,
      );
      return;
    }
    if (url === "/noindex") {
      send(
        200,
        `<!doctype html><html><head><title>Noindex page title</title><meta name="robots" content="noindex"></head><body><h1>Noindex</h1></body></html>`,
      );
      return;
    }
    if (url === "/broken") {
      send(
        404,
        `<!doctype html><html><head><title>Broken page</title></head><body><h1>404</h1></body></html>`,
      );
      return;
    }
    if (url === "/soft-404") {
      send(
        200,
        `<!doctype html><html><head><title>Page not found</title></head><body><p>nope</p></body></html>`,
      );
      return;
    }
    if (url === "/dup-1") {
      send(
        200,
        `<!doctype html><html><head><title>Best running shoes for marathon training 2026</title></head><body><h1>Dup 1</h1></body></html>`,
      );
      return;
    }
    if (url === "/dup-2") {
      send(
        200,
        `<!doctype html><html><head><title>Best running shoes for marathon training 2025</title></head><body><h1>Dup 2</h1></body></html>`,
      );
      return;
    }
    if (url === "/jsonld-bad") {
      send(
        200,
        `<!doctype html><html><head><title>JSON-LD bad page</title><script type="application/ld+json">{not valid json</script></head><body><h1>Bad</h1></body></html>`,
      );
      return;
    }
    if (url === "/jsonld-ok") {
      send(
        200,
        `<!doctype html><html><head><title>JSON-LD ok page</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Thing"}</script></head><body><h1>Ok</h1></body></html>`,
      );
      return;
    }
    if (url === "/hreflang-no") {
      send(
        200,
        `<!doctype html><html><head><title>Hreflang no</title><link rel="alternate" hreflang="en" href="FIXTURE_BASE/hreflang-target-en"></head><body><h1>No rec</h1></body></html>`.replace(
          /FIXTURE_BASE/g,
          "",
        ),
      );
      return;
    }
    if (url === "/hreflang-target-en") {
      send(
        200,
        `<!doctype html><html><head><title>EN target</title></head><body><h1>EN</h1></body></html>`,
      );
      return;
    }
    if (url === "/hreflang-ok") {
      send(
        200,
        `<!doctype html><html><head>
        <title>Hreflang ok page</title>
        <link rel="alternate" hreflang="en" href="FIXTURE_BASE/hreflang-ok-en">
        <link rel="alternate" hreflang="de" href="FIXTURE_BASE/hreflang-ok-de">
      </head><body><h1>Ok</h1></body></html>`.replace(/FIXTURE_BASE/g, ""),
      );
      return;
    }
    if (url === "/hreflang-ok-en") {
      send(
        200,
        `<!doctype html><html><head>
        <title>EN reciprocal</title>
        <link rel="alternate" hreflang="en" href="FIXTURE_BASE/hreflang-ok-en">
        <link rel="alternate" hreflang="de" href="FIXTURE_BASE/hreflang-ok-de">
      </head><body><h1>EN</h1></body></html>`.replace(/FIXTURE_BASE/g, ""),
      );
      return;
    }
    if (url === "/hreflang-ok-de") {
      send(
        200,
        `<!doctype html><html><head>
        <title>DE reciprocal</title>
        <link rel="alternate" hreflang="en" href="FIXTURE_BASE/hreflang-ok-en">
        <link rel="alternate" hreflang="de" href="FIXTURE_BASE/hreflang-ok-de">
      </head><body><h1>DE</h1></body></html>`.replace(/FIXTURE_BASE/g, ""),
      );
      return;
    }
    if (url === "/mixed") {
      send(
        200,
        `<!doctype html><html><head><title>Mixed content page</title></head><body><h1>Mixed</h1><img src="http://example.com/x.jpg"></body></html>`,
      );
      return;
    }
    if (url === "/missing") {
      send(
        404,
        "<html><head><title>Missing</title></head><body>nope</body></html>",
      );
      return;
    }
    if (url === "/no-title") {
      send(
        200,
        `<!doctype html><html><head></head><body><h1>No title here</h1></body></html>`,
      );
      return;
    }
    if (url === "/orphan") {
      send(
        200,
        `<!doctype html><html><head><title>Orphan page</title></head><body><h1>Orphan</h1></body></html>`,
      );
      return;
    }
    send(404, "nope");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr !== "object") {
    throw new Error("fixture server did not bind");
  }
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
