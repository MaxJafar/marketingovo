// HTML report: opens in any browser. Self-contained, no external
// assets. Designed to be readable on both desktop and mobile.

import type { Report } from "./index.js";
import {
  deriveExecutiveSummary,
  type ComparisonInput,
  type ExecutiveSummary,
} from "./executive.js";

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

function executiveHtml(summary: ExecutiveSummary): string {
  const change = summary.change;
  const changeBlock = change
    ? `<section class="exec-block">
    <h2>What changed since ${escapeHtml(new Date(change.baselineGeneratedAt).toLocaleDateString())}</h2>
    ${
      change.scopeChanged
        ? `<p class="caution"><strong>Scope changed.</strong> This crawl covered
           ${change.pagesCrawledDelta > 0 ? "+" : ""}${change.pagesCrawledDelta}
           pages versus the baseline. Issue counts across crawls of different
           sizes are not directly comparable.</p>`
        : ""
    }
    <table class="change-table">
      <thead><tr><th>Priority</th><th>Baseline</th><th>Now</th><th>Change</th></tr></thead>
      <tbody>
        ${change.byPriority
          .map(
            (row) => `<tr>
              <td>${escapeHtml(row.priority)}</td>
              <td>${row.baseline}</td>
              <td>${row.current}</td>
              <td class="${row.delta > 0 ? "worse" : row.delta < 0 ? "better" : ""}">${
                row.delta > 0 ? "+" : ""
              }${row.delta}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </section>`
    : `<section class="exec-block">
    <h2>What changed</h2>
    <p>This is the first audit for this site, so there is no baseline to compare
    against. The next audit will report movement against this one.</p>
  </section>`;

  return `<section class="executive">
  <h2 class="exec-title">Summary</h2>
  <p class="exec-lede">
    ${summary.pagesCrawled} page${summary.pagesCrawled === 1 ? "" : "s"} crawled.
    ${summary.issueTotal} finding${summary.issueTotal === 1 ? "" : "s"},
    of which ${summary.byPriority.find((p) => p.priority === "High")?.count ?? 0}
    are high priority.
    ${
      summary.dataPeriod
        ? `Search and analytics data covers ${escapeHtml(summary.dataPeriod.start)} to ${escapeHtml(summary.dataPeriod.end)}.`
        : ""
    }
  </p>

  ${changeBlock}

  <section class="exec-block">
    <h2>Do these first</h2>
    <p class="exec-note">Ranked by severity, then by how many pages the finding
    actually affects.</p>
    <ol class="action-list">
      ${summary.topActions
        .map(
          (action) => `<li class="${priorityClass(action.priority)}">
        <div class="action-head">
          <span class="badge">${escapeHtml(action.priority)}</span>
          <span class="msg">${escapeHtml(action.message)}</span>
        </div>
        <div class="action-meta">
          Affects <strong>${action.affectedUrls}</strong>
          page${action.affectedUrls === 1 ? "" : "s"} &middot;
          ${escapeHtml(action.category)}
        </div>
        ${action.fix ? `<div class="fix"><strong>Fix:</strong> ${escapeHtml(action.fix)}</div>` : ""}
        ${
          action.sampleUrls.length > 0
            ? `<div class="action-sample">Example${action.sampleUrls.length === 1 ? "" : "s"}:
               ${action.sampleUrls.map((url) => `<code>${escapeHtml(shortUrl(url))}</code>`).join(" ")}</div>`
            : ""
        }
      </li>`,
        )
        .join("")}
    </ol>
  </section>

  <section class="exec-block">
    <h2>What this audit could not measure</h2>
    ${
      summary.coverageGaps.length === 0
        ? `<p>Every configured source returned data for this run.</p>`
        : `<p class="exec-note">Stated so that absence is not read as a clean
           result.</p>
           <ul class="gap-list">
      ${summary.coverageGaps
        .map(
          (gap) =>
            `<li><strong>${escapeHtml(gap.source)}.</strong> ${escapeHtml(gap.consequence)}</li>`,
        )
        .join("")}
    </ul>`
    }
  </section>
</section>`;
}

export function reportToHtml(r: Report, baseline?: ComparisonInput): string {
  const executive = executiveHtml(
    deriveExecutiveSummary(r, { baseline: baseline ?? null }),
  );
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
  <title>Marketingovo audit &mdash; ${escapeHtml(r.startUrl)}</title>
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
    .executive { margin: 1.75rem 0 0.5rem; padding: 1.4rem; border: 1px solid var(--border); border-radius: 14px; background: var(--code); }
    .exec-title { margin: 0 0 0.35rem; font-size: 1.25rem; }
    .exec-lede { margin: 0 0 1.1rem; line-height: 1.55; }
    .exec-block { margin: 1.25rem 0 0; }
    .exec-block h2 { font-size: 1rem; margin: 0 0 0.5rem; }
    .exec-note { margin: 0 0 0.6rem; font-size: 0.85rem; color: var(--muted); }
    .caution { margin: 0 0 0.75rem; padding: 0.6rem 0.75rem; border-inline-start: 3px solid #d29a2a; background: rgb(210 154 42 / 10%); font-size: 0.85rem; }
    .change-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .change-table th, .change-table td { text-align: start; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--border); }
    .change-table td.worse { color: #b3261e; font-weight: 600; }
    .change-table td.better { color: #186a3b; font-weight: 600; }
    .action-list { margin: 0; padding-inline-start: 1.25rem; }
    .action-list li { margin: 0 0 0.9rem; }
    .action-head { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; }
    .action-head .msg { font-weight: 600; }
    .action-meta { font-size: 0.85rem; color: var(--muted); margin: 0.2rem 0; }
    .action-sample { font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }
    .action-sample code { background: var(--code); padding: 0.05rem 0.3rem; border-radius: 4px; }
    .gap-list { margin: 0; padding-inline-start: 1.25rem; line-height: 1.5; }
    .gap-list li { margin: 0 0 0.5rem; }
    @media (max-width: 640px) { body { padding: 0; } .report-shell { border-radius: 0; border-inline: 0; } .report-header { display: block; } .report-label { display: inline-block; margin-top: 1rem; } .url-list { columns: 1; } }
    @media print { :root { --bg: #fff; --surface: #fff; --fg: #172033; --muted: #687086; --border: #dfe2eb; --code: #f8f9fc; } body { max-width: none; padding: 0; } .report-shell { border: 0; border-radius: 0; padding: 0; box-shadow: none; } details { break-inside: avoid; } a { text-decoration: none; } }
  </style>
</head>
<body>
<main class="report-shell">
  <header class="report-header">
    <div>
      <div class="brand"><span class="brand-mark">M</span> Marketingovo</div>
      <h1>SEO audit</h1>
      <div class="meta">A reproducible audit for prioritization and verification.</div>
    </div>
    <span class="report-label">Marketingovo</span>
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

  ${executive}

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
    Marketingovo &middot; report schema 0.11 &middot; pages: ${r.summary.pagesCrawled} &middot; request rate: ${r.config.requestsPerSecond}/s &middot; configured crawl scope: ${r.config.maxUrls} URLs
  </div>
</main>
</body>
</html>`;
}
