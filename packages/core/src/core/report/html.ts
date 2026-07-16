// HTML report: opens in any browser. Self-contained, no external
// assets. Designed to be readable on both desktop and mobile.

import type { Report } from "./index.js";

const HTML_URL_SAMPLE_SIZE = 200;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortUrl(u: string, max = 70): string {
  if (u.length <= max) return u;
  return u.slice(0, max - 3) + "...";
}

function priorityClass(p: string): string {
  return `priority-${p.toLowerCase()}`;
}

function categorySection(issues: Report["issues"], cat: string): string {
  const list = issues.filter((i) => i.category === cat);
  if (list.length === 0) return "";
  return `<section class="category">
  <h3>${escapeHtml(cat)} <span class="count">${list.length}</span></h3>
  <ul class="issue-list">
    ${list
      .map(
        (i) => `
      <li class="${priorityClass(i.priority)}">
        <div class="issue-head">
          <span class="badge">${escapeHtml(i.priority)}</span>
          <span class="msg">${escapeHtml(i.message)}</span>
        </div>
        ${i.fix ? `<div class="fix"><strong>Fix:</strong> ${escapeHtml(i.fix)}</div>` : ""}
        ${
          i.urls.length > 0
            ? `<details><summary>${i.urls.length} URL(s)${i.urls.length > HTML_URL_SAMPLE_SIZE ? `; showing first ${HTML_URL_SAMPLE_SIZE}` : ""}</summary><ul class="url-list">${i.urls
                .slice(0, HTML_URL_SAMPLE_SIZE)
                .map(
                  (u) =>
                    `<li><a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortUrl(u))}</a></li>`,
                )
                .join(
                  "",
                )}</ul>${i.urls.length > HTML_URL_SAMPLE_SIZE ? `<p class="url-sample-note">Showing ${HTML_URL_SAMPLE_SIZE} of ${i.urls.length}. JSON and CSV exports contain the complete affected-URL cohort.</p>` : ""}</details>`
            : ""
        }
      </li>`,
      )
      .join("")}
  </ul>
</section>`;
}

export function reportToHtml(r: Report): string {
  const categories = Array.from(
    new Set(r.issues.map((i) => i.category)),
  ).sort();
  const total = r.issues.length;
  const high = r.summary.issuesByPriority.High ?? 0;
  const med = r.summary.issuesByPriority.Medium ?? 0;
  const low = r.summary.issuesByPriority.Low ?? 0;
  const generated = new Date(r.generatedAt).toUTCString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Golem SEO audit &mdash; ${escapeHtml(r.startUrl)}</title>
  <style>
    :root { --fg: #172033; --bg: #f4f5fb; --surface: #fff; --muted: #687086; --border: #e2e5ef; --brand: #6558e8; --brand-soft: #eeecff; --high: #c33b4a; --med: #b86a00; --low: #28659d; --code: #f7f8fc; }
    @media (prefers-color-scheme: dark) {
      :root { --fg: #edf0f8; --bg: #0d1020; --surface: #151a2d; --muted: #a1a8bb; --border: #2b3147; --brand-soft: #28234f; --code: #1c2236; }
    }
    * { box-sizing: border-box; }
    body { font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); max-width: 1160px; margin: 0 auto; padding: 2.5rem 1.5rem; line-height: 1.5; }
    .report-shell { background: var(--surface); border: 1px solid var(--border); border-radius: 22px; padding: clamp(1.25rem, 3vw, 2.5rem); box-shadow: 0 18px 48px rgb(27 32 55 / 8%); }
    .report-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
    .brand { display: inline-flex; align-items: center; gap: 0.55rem; color: var(--brand); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .brand-mark { display: grid; place-items: center; width: 28px; height: 28px; color: #fff; background: var(--brand); border-radius: 9px; font-size: 0.72rem; letter-spacing: 0; }
    .report-label { color: var(--muted); background: var(--brand-soft); border-radius: 999px; padding: 0.35rem 0.75rem; font-size: 0.78rem; white-space: nowrap; }
    h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); letter-spacing: -0.035em; margin: 0.8rem 0 0.5rem; }
    h2 { font-size: 1.2rem; margin: 2.5rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
    h3 { font-size: 1rem; margin: 1.5rem 0 0.6rem; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.8rem; margin: 1.5rem 0; }
    .stat { padding: 1rem 1.1rem; border: 1px solid var(--border); border-radius: 12px; background: var(--code); }
    .stat .n { font-size: 1.6rem; font-weight: 600; }
    .stat .l { color: var(--muted); font-size: 0.85rem; }
    .stat.high .n { color: var(--high); }
    .stat.med .n { color: var(--med); }
    .stat.low .n { color: var(--low); }
    .category { margin: 1rem 0 1.5rem; }
    .category h3 { display: flex; align-items: center; gap: 0.5rem; }
    .category h3 .count { font-size: 0.8rem; color: var(--muted); font-weight: 400; }
    .issue-list { list-style: none; padding: 0; margin: 0; }
    .issue-list li { border: 1px solid var(--border); border-left: 3px solid var(--border); padding: 0.8rem 0.9rem; margin: 0.55rem 0; background: var(--code); border-radius: 0 9px 9px 0; }
    .issue-list li.priority-high { border-left-color: var(--high); }
    .issue-list li.priority-medium { border-left-color: var(--med); }
    .issue-list li.priority-low { border-left-color: var(--low); }
    .issue-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .badge { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 10px; background: var(--border); color: var(--fg); }
    .priority-high .badge { background: var(--high); color: #fff; }
    .priority-medium .badge { background: var(--med); color: #fff; }
    .priority-low .badge { background: var(--low); color: #fff; }
    .msg { flex: 1; }
    .fix { font-size: 0.88rem; color: var(--muted); margin-top: 0.4rem; }
    details { margin-top: 0.4rem; font-size: 0.88rem; color: var(--muted); }
    details summary { cursor: pointer; }
    .url-sample-note { margin: 0.45rem 0 0; font-size: 0.8rem; }
    .url-list { list-style: none; padding: 0.4rem 0 0; columns: 2; }
    .url-list li { padding: 0.1rem 0; break-inside: avoid; }
    a { color: inherit; text-underline-offset: 0.16em; }
    .footer { color: var(--muted); font-size: 0.85rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    @media (max-width: 640px) { body { padding: 0; } .report-shell { border-radius: 0; border-inline: 0; } .report-header { display: block; } .report-label { display: inline-block; margin-top: 1rem; } .url-list { columns: 1; } }
    @media print { :root { --bg: #fff; --surface: #fff; --fg: #172033; --muted: #687086; --border: #dfe2eb; --code: #f8f9fc; } body { max-width: none; padding: 0; } .report-shell { border: 0; border-radius: 0; padding: 0; box-shadow: none; } details { break-inside: avoid; } a { text-decoration: none; } }
  </style>
</head>
<body>
<main class="report-shell">
  <header class="report-header">
    <div>
      <div class="brand"><span class="brand-mark">GS</span> Golem SEO</div>
      <h1>SEO evidence snapshot</h1>
      <div class="meta">A reproducible audit for prioritization and verification.</div>
    </div>
    <span class="report-label">Community Edition</span>
  </header>
  <div class="meta">
    <div><strong>Site:</strong> <a href="${escapeHtml(r.startUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.startUrl)}</a></div>
    <div><strong>Generated:</strong> ${escapeHtml(generated)}</div>
    <div><strong>Duration:</strong> ${(r.durationMs / 1000).toFixed(1)}s</div>
    <div><strong>Pages crawled:</strong> ${r.summary.pagesCrawled}</div>
  </div>

  <div class="summary">
    <div class="stat"><div class="n">${total}</div><div class="l">Total issues</div></div>
    <div class="stat high"><div class="n">${high}</div><div class="l">High priority</div></div>
    <div class="stat med"><div class="n">${med}</div><div class="l">Medium priority</div></div>
    <div class="stat low"><div class="n">${low}</div><div class="l">Low priority</div></div>
  </div>

  <div class="meta"><strong>Connected evidence:</strong> ${r.realData ? "Crawl plus configured search/analytics sources" : "Crawl evidence only; search and analytics data were unavailable for this run"}</div>

  <h2>Issues by category</h2>
  ${categories.map((c) => categorySection(r.issues, c)).join("")}

  ${
    r.topUrls.length > 0
      ? `
  <h2>Top affected URLs</h2>
  <ul class="url-list" style="columns: 1">
    ${r.topUrls
      .map(
        (u) => `<li>
          <a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(shortUrl(u.url, 80))}</a>
          <span class="meta"> &mdash; ${u.status} &middot; ${u.issueCount} issues${u.title ? ` &middot; ${escapeHtml(u.title.slice(0, 60))}` : ""}</span>
        </li>`,
      )
      .join("")}
  </ul>
  `
      : ""
  }

  <div class="footer">
    Golem SEO Community Edition &middot; report schema 0.11 &middot; pages: ${r.summary.pagesCrawled} &middot; request rate: ${r.config.requestsPerSecond}/s &middot; configured crawl scope: ${r.config.maxUrls} URLs
  </div>
</main>
</body>
</html>`;
}
