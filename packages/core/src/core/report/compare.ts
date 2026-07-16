// Report generators for competitive comparison: HTML, markdown, JSON.
// The HTML is a self-contained evidence artifact for marketers and clients.

import type { ComparisonResult, SiteSummary } from "../../compare.js";

export function compareToJson(c: ComparisonResult): string {
  return JSON.stringify(c, null, 2);
}

export function compareToMarkdown(c: ComparisonResult): string {
  const lines: string[] = [];
  lines.push(`# Competitive SEO comparison`);
  lines.push("");
  lines.push(`Generated: ${c.generatedAt}`);
  lines.push(`Sites: ${c.sites.length}`);
  lines.push("");
  // Overview table
  lines.push(`## Overview`);
  lines.push("");
  lines.push(
    `| Site | Pages | High | Med | Low | LCP (ms) | CLS | TTFB (ms) |`,
  );
  lines.push(
    `|------|------:|-----:|----:|----:|---------:|----:|----------:|`,
  );
  for (const s of c.sites) {
    const win = (key: keyof ComparisonResult["winners"]) =>
      c.winners[key] === c.sites.indexOf(s) ? " 🏆" : "";
    const cells = [
      s.url,
      String(s.pagesCrawled),
      `${s.issuesByPriority.High}${win("fewestHigh")}`,
      String(s.issuesByPriority.Medium),
      String(s.issuesByPriority.Low),
      s.avgLcpMs !== null ? s.avgLcpMs.toFixed(0) : "—",
      s.avgCls !== null ? s.avgCls.toFixed(3) : "—",
      s.avgTtfbMs !== null ? s.avgTtfbMs.toFixed(0) : "—",
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");
  // Lighthouse
  if (c.sites.some((s) => s.lighthouse)) {
    lines.push(`## Lighthouse (home)`);
    lines.push("");
    lines.push(`| Site | Perf | A11y | BP | SEO |`);
    lines.push(`|------|----:|-----:|---:|----:|`);
    for (const s of c.sites) {
      if (!s.lighthouse) continue;
      const lh = s.lighthouse;
      const win = (key: keyof ComparisonResult["winners"]) =>
        c.winners[key] === c.sites.indexOf(s) ? " 🏆" : "";
      lines.push(
        `| ${s.url} | ${fmtScore(lh.performance)}${win("bestPerformance")} | ${fmtScore(lh.accessibility)}${win("bestA11y")} | ${fmtScore(lh.bestPractices)}${win("bestBp")} | ${fmtScore(lh.seo)}${win("bestSeo")} |`,
      );
    }
    lines.push("");
  }
  // Per-site top issues
  for (const s of c.sites) {
    if (s.error) {
      lines.push(`## ${s.url}`);
      lines.push("");
      lines.push(`> ⚠️ ${s.error}`);
      lines.push("");
      continue;
    }
    lines.push(`## ${s.url}`);
    lines.push("");
    if (s.title) lines.push(`_Title:_ ${s.title}`);
    lines.push(
      `_Pages crawled:_ ${s.pagesCrawled}  |  _Duration:_ ${(s.durationMs / 1000).toFixed(1)}s`,
    );
    if (s.topIssues.length > 0) {
      lines.push("");
      lines.push(`**Top issues:**`);
      for (const i of s.topIssues) {
        lines.push(
          `- [${i.priority}] ${i.message} (${i.urlCount} URL${i.urlCount > 1 ? "s" : ""})`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function fmtScore(v: number | null): string {
  if (v === null) return "—";
  return String(v);
}

export function compareToHtml(c: ComparisonResult): string {
  // The HTML is intentionally minimal and self-contained. Inline CSS,
  // no external deps. Designed to be screenshotted in 30 seconds.
  const styles = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #1a1a1a; max-width: 1280px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #eee; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 14px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f8f8f8; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .winner { background: #fef9e7; font-weight: 600; }
    .winner::after { content: " 🏆"; }
    .high { color: #c0392b; font-weight: 600; }
    .med { color: #d68910; }
    .low { color: #7f8c8d; }
    .site-card { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .site-card h3 { margin: 0 0 8px; font-size: 16px; }
    .site-card .err { color: #c0392b; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .pill-High { background: #fde2e2; color: #c0392b; }
    .pill-Medium { background: #fef3cd; color: #856404; }
    .pill-Low { background: #e8eef3; color: #555; }
    ul { margin: 8px 0; padding-left: 20px; }
    code { background: #f1f1f1; padding: 1px 5px; border-radius: 3px; font-size: 13px; }
  `;
  const sites = c.sites;
  const cellWinners = new Map<string, number | null>();
  cellWinners.set("fewestHigh", c.winners.fewestHigh);
  cellWinners.set("fewestTotal", c.winners.fewestTotal);
  cellWinners.set("bestPerformance", c.winners.bestPerformance);
  cellWinners.set("bestSeo", c.winners.bestSeo);
  cellWinners.set("bestA11y", c.winners.bestA11y);
  cellWinners.set("bestBp", c.winners.bestBp);
  cellWinners.set("fastestLcp", c.winners.fastestLcp);

  const winnerClass = (key: string, idx: number) =>
    cellWinners.get(key) === idx ? "winner" : "";

  const overviewRows = sites
    .map((s, i) => {
      const total =
        s.issuesByPriority.High +
        s.issuesByPriority.Medium +
        s.issuesByPriority.Low;
      return `
        <tr>
          <td><code>${esc(s.url)}</code></td>
          <td class="num">${s.pagesCrawled}</td>
          <td class="num ${winnerClass("fewestHigh", i)}">${s.issuesByPriority.High}</td>
          <td class="num ${winnerClass("fewestTotal", i)}">${total}</td>
          <td class="num">${s.issuesByPriority.Medium}</td>
          <td class="num">${s.issuesByPriority.Low}</td>
          <td class="num ${winnerClass("fastestLcp", i)}">${s.avgLcpMs !== null ? s.avgLcpMs.toFixed(0) : "—"}</td>
          <td class="num">${s.avgCls !== null ? s.avgCls.toFixed(3) : "—"}</td>
          <td class="num">${s.avgTtfbMs !== null ? s.avgTtfbMs.toFixed(0) : "—"}</td>
        </tr>`;
    })
    .join("");

  const lighthouseSection = sites.some((s) => s.lighthouse)
    ? `
    <h2>Lighthouse (home)</h2>
    <table>
      <thead>
        <tr><th>Site</th><th class="num">Performance</th><th class="num">Accessibility</th><th class="num">Best Practices</th><th class="num">SEO</th></tr>
      </thead>
      <tbody>
        ${sites
          .map((s, i) => {
            if (!s.lighthouse)
              return `<tr><td><code>${esc(s.url)}</code></td><td colspan="4" class="num">—</td></tr>`;
            const lh = s.lighthouse;
            return `
            <tr>
              <td><code>${esc(s.url)}</code></td>
              <td class="num ${winnerClass("bestPerformance", i)}">${lh.performance ?? "—"}</td>
              <td class="num ${winnerClass("bestA11y", i)}">${lh.accessibility ?? "—"}</td>
              <td class="num ${winnerClass("bestBp", i)}">${lh.bestPractices ?? "—"}</td>
              <td class="num ${winnerClass("bestSeo", i)}">${lh.seo ?? "—"}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`
    : "";

  const siteCards = sites
    .map((s) => {
      if (s.error) {
        return `<div class="site-card"><h3><code>${esc(s.url)}</code></h3><div class="err">⚠️ ${esc(s.error)}</div></div>`;
      }
      const issuesList = s.topIssues.length
        ? s.topIssues
            .map(
              (i) =>
                `<li><span class="pill pill-${i.priority}">${i.priority}</span> ${esc(i.message)} (${i.urlCount} URL${i.urlCount > 1 ? "s" : ""})</li>`,
            )
            .join("")
        : "<li>No high-priority issues found.</li>";
      return `
        <div class="site-card">
          <h3><code>${esc(s.url)}</code></h3>
          <div>${s.title ? esc(s.title) : ""}</div>
          <div class="meta">${s.pagesCrawled} pages · ${(s.durationMs / 1000).toFixed(1)}s · ${s.issuesByPriority.High} high / ${s.issuesByPriority.Medium} med / ${s.issuesByPriority.Low} low</div>
          <ul>${issuesList}</ul>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Competitive SEO comparison</title>
  <meta name="generator" content="Golem SEO Community Edition 0.11">
  <style>${styles}</style>
</head>
<body>
  <h1>Competitive SEO comparison</h1>
  <div class="meta">Generated ${esc(c.generatedAt)} · ${sites.length} sites · 🏆 = category leader</div>

  <h2>Overview</h2>
  <table>
    <thead>
      <tr>
        <th>Site</th>
        <th class="num">Pages</th>
        <th class="num">High</th>
        <th class="num">Total</th>
        <th class="num">Medium</th>
        <th class="num">Low</th>
        <th class="num">LCP (ms)</th>
        <th class="num">CLS</th>
        <th class="num">TTFB (ms)</th>
      </tr>
    </thead>
    <tbody>${overviewRows}</tbody>
  </table>

  ${lighthouseSection}

  <h2>Per-site detail</h2>
  ${siteCards}
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
