// Rendering the report a client actually receives.
//
// The rendering rule that matters: an unmeasured figure is never a dash. A
// dash reads as zero to anyone skimming, and skimming is what happens to a
// monthly report. Where a number is missing, its reason takes the number's
// place — in the same visual slot, at the same weight.

import type { ChartSpec } from "./charts.js";
import { renderChartSvg, reportChartSpecs } from "./charts.js";
import type { MarketingReport, ReportMetric, ReportSection } from "./types.js";

export interface ReportBrand {
  companyName: string;
  text: string;
  background: string;
  surface: string;
  accent: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
  logoUrl: string | null;
}

export const DEFAULT_REPORT_BRAND: ReportBrand = {
  companyName: "",
  text: "#101828",
  background: "#f4f4f5",
  surface: "#ffffff",
  accent: "#1570ef",
  muted: "#667085",
  headingFont: "Georgia, 'Times New Roman', serif",
  bodyFont: "Helvetica, Arial, sans-serif",
  logoUrl: null,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formats a measured figure. Never called for an unmeasured one. */
export function formatMetricValue(metric: ReportMetric): string {
  const value = metric.value;
  if (value === null) return "";
  switch (metric.unit) {
    case "currency": {
      const rounded = Math.round(value * 100) / 100;
      // A currency-less monetary figure prints bare rather than picking a
      // symbol, because the symbol would be the invention.
      return metric.currency
        ? `${rounded.toLocaleString("en-US")} ${metric.currency}`
        : rounded.toLocaleString("en-US");
    }
    case "percent":
      return `${Math.round(value * 10) / 10}%`;
    case "position":
      return (Math.round(value * 10) / 10).toFixed(1);
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

function formatChange(metric: ReportMetric): string {
  if (metric.change === null) return "";
  const percent = Math.round(metric.change * 1000) / 10;
  if (Math.abs(percent) < 0.1) return "no change";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

function metricCell(metric: ReportMetric, brand: ReportBrand): string {
  const measured = metric.value !== null;
  const partial = metric.state === "partial";

  return `<td style="padding:14px 16px;border-bottom:1px solid ${brand.background};vertical-align:top;">
  <div style="font-size:11px;letter-spacing:0.6px;text-transform:uppercase;color:${brand.muted};">${escapeHtml(metric.label)}</div>
  ${
    measured
      ? `<div style="font-size:26px;font-family:${brand.headingFont};color:${brand.text};margin-top:4px;">${escapeHtml(formatMetricValue(metric))}</div>
         ${metric.change !== null ? `<div style="font-size:12px;color:${brand.muted};margin-top:2px;">${escapeHtml(formatChange(metric))} vs previous period</div>` : ""}
         ${partial ? `<div style="font-size:12px;color:${brand.muted};margin-top:2px;">Partial: some days in this period could not be read.</div>` : ""}
         ${metric.note && metric.change === null ? `<div style="font-size:12px;color:${brand.muted};margin-top:2px;">${escapeHtml(metric.note)}</div>` : ""}`
      : // The reason occupies the number's slot, at readable weight. A dash
        // here would be read as zero by anyone skimming, and skimming is what
        // happens to a monthly report.
        `<div style="font-size:14px;line-height:1.45;color:${brand.muted};margin-top:6px;font-style:italic;">${escapeHtml(metric.note ?? "Not measured in this period.")}</div>`
  }
</td>`;
}

function chartHtml(spec: ChartSpec, brand: ReportBrand): string {
  return `<figure style="margin:18px 0 0;">
  <figcaption style="font-size:11px;letter-spacing:0.6px;text-transform:uppercase;color:${brand.muted};margin-bottom:8px;">${escapeHtml(spec.title)}</figcaption>
  ${renderChartSvg(spec, brand)}
  ${spec.omitted
    .map(
      // A row that could not be measured is named, not drawn: an empty bar
      // reads as zero at exactly the glance a chart exists for.
      (row) =>
        `<div style="font-size:12px;font-style:italic;color:${brand.muted};margin-top:6px;">Not drawn — ${escapeHtml(row.label)}: ${escapeHtml(row.reason)}</div>`,
    )
    .join("")}
</figure>`;
}

function sectionHtml(
  section: ReportSection,
  brand: ReportBrand,
  charts: ChartSpec[] = [],
): string {
  const stateLabel =
    section.state === "available"
      ? ""
      : section.state === "partial"
        ? "Partial coverage"
        : section.state === "failed"
          ? "Could not be read"
          : "Not measured";

  const metricRows: string[] = [];
  for (let index = 0; index < section.metrics.length; index += 2) {
    const pair = section.metrics.slice(index, index + 2);
    metricRows.push(
      `<tr>${pair.map((entry) => metricCell(entry, brand)).join("")}${pair.length === 1 ? "<td></td>" : ""}</tr>`,
    );
  }

  return `<section style="background:${brand.surface};margin:0 0 20px;padding:24px;">
  <h2 style="margin:0;font-family:${brand.headingFont};font-size:19px;color:${brand.text};">${escapeHtml(section.title)}${
    stateLabel
      ? ` <span style="font-family:${brand.bodyFont};font-size:11px;letter-spacing:0.6px;text-transform:uppercase;color:${brand.muted};">— ${escapeHtml(stateLabel)}</span>`
      : ""
  }</h2>
  <p style="margin:8px 0 16px;font-size:14px;line-height:1.55;color:${brand.muted};">${escapeHtml(section.summary)}</p>
  ${
    metricRows.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${metricRows.join("")}</table>`
      : ""
  }
  ${charts.map((spec) => chartHtml(spec, brand)).join("")}
  ${
    section.breakdown.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:16px;">
           ${section.breakdown
             .map(
               (row) =>
                 `<tr><td style="padding:8px 16px 8px 0;font-size:13px;color:${brand.text};border-bottom:1px solid ${brand.background};">${escapeHtml(row.label)}</td>${row.metrics
                   .map(
                     (entry) =>
                       `<td style="padding:8px 0;font-size:13px;color:${entry.value === null ? brand.muted : brand.text};border-bottom:1px solid ${brand.background};text-align:right;">${entry.value === null ? "not measured" : escapeHtml(formatMetricValue(entry))}</td>`,
                   )
                   .join("")}</tr>`,
             )
             .join("")}
         </table>`
      : ""
  }
  ${section.refusals
    .map(
      (refusal) =>
        // Rendered inside the section rather than as a footnote: the refusal
        // is information the client needs, and a footnote does not travel
        // with a number once it has been screenshotted.
        `<div style="margin-top:16px;padding:14px 16px;border-left:3px solid ${brand.accent};background:${brand.background};">
           <div style="font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:${brand.muted};">${escapeHtml(refusal.expected)}</div>
           <div style="font-size:13px;line-height:1.55;color:${brand.text};margin-top:6px;">${escapeHtml(refusal.explanation)}</div>
         </div>`,
    )
    .join("")}
</section>`;
}

export function renderReportHtml(
  report: MarketingReport,
  brand: ReportBrand = DEFAULT_REPORT_BRAND,
): string {
  const period = `${report.period.start} to ${report.period.end}`;
  const chartsBySection = new Map<string, ChartSpec[]>();
  for (const spec of reportChartSpecs(report)) {
    const existing = chartsBySection.get(spec.sectionId) ?? [];
    existing.push(spec);
    chartsBySection.set(spec.sectionId, existing);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(report.title)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.background};font-family:${brand.bodyFont};color:${brand.text};">
<div style="max-width:820px;margin:0 auto;padding:32px 20px;">
  <header style="background:${brand.surface};padding:28px 24px;margin-bottom:20px;">
    ${brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}" width="140" style="display:block;margin-bottom:16px;">` : ""}
    <h1 style="margin:0;font-family:${brand.headingFont};font-size:27px;color:${brand.text};">${escapeHtml(report.title)}</h1>
    <p style="margin:8px 0 0;font-size:14px;color:${brand.muted};">${escapeHtml(period)}${report.period.comparisonStart ? ` · compared with ${escapeHtml(report.period.comparisonStart)} to ${escapeHtml(report.period.comparisonEnd ?? "")}` : ""}</p>
    ${report.narrative ? `<p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:${brand.text};">${escapeHtml(report.narrative)}</p>` : ""}
  </header>

  ${report.sections.map((section) => sectionHtml(section, brand, chartsBySection.get(section.id) ?? [])).join("")}

  ${
    report.coverageGaps.length > 0
      ? `<section style="background:${brand.surface};padding:24px;margin-bottom:20px;">
           <h2 style="margin:0 0 8px;font-family:${brand.headingFont};font-size:19px;color:${brand.text};">What this report could not see</h2>
           <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:${brand.muted};">Listed together so a reader who skims the numbers still meets the gaps.</p>
           <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:${brand.text};">
             ${report.coverageGaps.map((gap) => `<li><strong>${escapeHtml(gap.source)}</strong> — ${escapeHtml(gap.reason)}</li>`).join("")}
           </ul>
         </section>`
      : ""
  }

  <footer style="padding:16px 4px;font-size:12px;line-height:1.6;color:${brand.muted};">
    Generated ${escapeHtml(report.generatedAt.slice(0, 10))}${brand.companyName ? ` for ${escapeHtml(brand.companyName)}` : ""}.
    Figures are as reported by each platform at the time of generation and are not restated afterwards.
  </footer>
</div>
</body>
</html>`;
}

/**
 * The plain-text form, for a covering email or a terminal.
 *
 * Derived from the same structure rather than from the HTML, so the two can
 * never disagree about what was and was not measured.
 */
export function renderReportText(report: MarketingReport): string {
  const lines: string[] = [
    report.title,
    `${report.period.start} to ${report.period.end}`,
    "",
  ];
  if (report.narrative) lines.push(report.narrative, "");

  for (const section of report.sections) {
    lines.push(
      `## ${section.title}${section.state === "available" ? "" : ` (${section.state})`}`,
      section.summary,
      "",
    );
    for (const entry of section.metrics) {
      lines.push(
        entry.value === null
          ? `  ${entry.label}: not measured — ${entry.note ?? "no reading in this period"}`
          : `  ${entry.label}: ${formatMetricValue(entry)}${entry.change !== null ? ` (${formatChange(entry)})` : ""}`,
      );
    }
    for (const refusal of section.refusals) {
      lines.push("", `  ${refusal.expected}: ${refusal.explanation}`);
    }
    lines.push("");
  }

  if (report.coverageGaps.length > 0) {
    lines.push("## What this report could not see", "");
    for (const gap of report.coverageGaps) {
      lines.push(`  ${gap.source} — ${gap.reason}`);
    }
  }
  return lines.join("\n").trim();
}
