// The cross-channel report as a PDF a marketer can hand to a client.
//
// Drawn with pdf-lib rather than printed from the HTML through a browser: a
// report download must work on every install, including ones with no Chromium,
// and it must produce the same bytes for the same stored document. The charts
// come from the same specs as the HTML's SVG charts, so the two forms cannot
// disagree about what was measurable.
//
// Same tradeoff as the audit PDF: standard fonts cover WinAnsi, so anything
// outside it is replaced rather than mis-rendered. The HTML render carries the
// full text.

import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import {
  DEFAULT_REPORT_BRAND,
  donutSlices,
  formatMetricValue,
  reportChartSpecs,
  sliceOpacity,
  type ChartSpec,
  type MarketingReport,
  type ReportBrand,
  type ReportMetric,
} from "@marketingovo/core";

function hexColor(value: string, fallback: RGB): RGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return fallback;
  const raw = match[1]!;
  return rgb(
    parseInt(raw.slice(0, 2), 16) / 255,
    parseInt(raw.slice(2, 4), 16) / 255,
    parseInt(raw.slice(4, 6), 16) / 255,
  );
}

function mix(color: RGB, towards: RGB, amount: number): RGB {
  return rgb(
    color.red + (towards.red - color.red) * amount,
    color.green + (towards.green - color.green) * amount,
    color.blue + (towards.blue - color.blue) * amount,
  );
}

function formatChange(metric: ReportMetric): string {
  if (metric.change === null) return "";
  const percent = Math.round(metric.change * 1000) / 10;
  if (Math.abs(percent) < 0.1) return "no change vs previous period";
  return `${percent > 0 ? "+" : ""}${percent}% vs previous period`;
}

export async function createMarketingReportPdf(
  report: MarketingReport,
  brand: ReportBrand = DEFAULT_REPORT_BRAND,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(report.title.replace(/[^\x20-\x7E]/g, "?"));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const MARGIN = 48;
  const TOP = 794;
  const BOTTOM = 56;
  const WIDTH = 595 - MARGIN * 2;
  const white = rgb(1, 1, 1);
  const ink = hexColor(brand.text, rgb(0.12, 0.16, 0.23));
  const muted = hexColor(brand.muted, rgb(0.42, 0.46, 0.53));
  const accent = hexColor(brand.accent, rgb(0.08, 0.44, 0.94));
  const track = mix(ink, white, 0.92);

  let page = pdf.addPage([595, 842]);
  let y = TOP;

  const need = (height: number): void => {
    if (y - height >= BOTTOM) return;
    page = pdf.addPage([595, 842]);
    y = TOP;
  };
  const safe = (value: string): string => value.replace(/[^\x20-\x7E]/g, "?");

  const wrap = (value: string, size: number, maxWidth: number): string[] => {
    const words = safe(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  };

  const text = (
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      indent?: number;
      color?: RGB;
    } = {},
  ): void => {
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    const lineHeight = size + 4;
    for (const line of wrap(value, size, WIDTH - indent)) {
      need(lineHeight);
      page.drawText(line, {
        x: MARGIN + indent,
        y,
        size,
        font: options.bold ? bold : font,
        color: options.color ?? ink,
      });
      y -= lineHeight;
    }
  };
  const gap = (height: number): void => {
    need(height);
    y -= height;
  };
  const heading = (value: string): void => {
    gap(12);
    text(value, { size: 13, bold: true });
    gap(4);
  };

  const truncate = (value: string, size: number, maxWidth: number): string => {
    let candidate = safe(value);
    while (
      candidate.length > 1 &&
      font.widthOfTextAtSize(candidate, size) > maxWidth
    ) {
      candidate = candidate.slice(0, -1);
    }
    return candidate;
  };

  /* ---------------------------------------------------------------- */
  /* Charts                                                            */
  /* ---------------------------------------------------------------- */

  const LABEL_WIDTH = 150;
  const VALUE_WIDTH = 95;
  const TRACK_WIDTH = WIDTH - LABEL_WIDTH - VALUE_WIDTH;

  const chartTitle = (value: string): void => {
    gap(8);
    text(value.toUpperCase(), { size: 7.5, color: muted });
    gap(2);
  };

  const barRow = (
    label: string,
    display: string,
    fraction: number,
    color: RGB,
    barHeight = 9,
  ): void => {
    const rowHeight = 16;
    need(rowHeight);
    page.drawText(truncate(label, 8, LABEL_WIDTH - 8), {
      x: MARGIN,
      y: y - barHeight + 1,
      size: 8,
      font,
      color: ink,
    });
    page.drawRectangle({
      x: MARGIN + LABEL_WIDTH,
      y: y - barHeight,
      width: TRACK_WIDTH,
      height: barHeight,
      color: track,
    });
    page.drawRectangle({
      x: MARGIN + LABEL_WIDTH,
      y: y - barHeight,
      width: Math.max(fraction * TRACK_WIDTH, 1),
      height: barHeight,
      color,
    });
    page.drawText(truncate(display, 8, VALUE_WIDTH - 4), {
      x: MARGIN + LABEL_WIDTH + TRACK_WIDTH + 6,
      y: y - barHeight + 1,
      size: 8,
      font,
      color: ink,
    });
    y -= rowHeight;
  };

  const drawBars = (spec: ChartSpec): void => {
    chartTitle(spec.title);
    const max = Math.max(...spec.rows.map((row) => row.value), 0);
    need(spec.rows.length * 16 + 4);
    for (const row of spec.rows) {
      barRow(row.label, row.display, max > 0 ? row.value / max : 0, accent);
    }
  };

  const drawCompare = (spec: ChartSpec): void => {
    chartTitle(`${spec.title} (upper bar: this period; lower: previous)`);
    for (const row of spec.compareRows) {
      // Scaled within the row only — the rows carry different units, so the
      // printed figures are the comparison across rows.
      const max = Math.max(row.current, row.previous, 1e-9);
      need(30);
      barRow(row.label, row.currentDisplay, row.current / max, accent, 8);
      barRow(
        "",
        row.previousDisplay,
        row.previous / max,
        mix(muted, white, 0.35),
        8,
      );
      gap(2);
    }
  };

  const drawDonut = (spec: ChartSpec): void => {
    chartTitle(spec.title);
    const slices = donutSlices(spec, 70, 70, 62, 38);
    const chartHeight = 140;
    need(chartHeight + 6);
    const anchorY = y;
    for (const [index, slice] of slices.entries()) {
      page.drawSvgPath(slice.path, {
        x: MARGIN,
        y: anchorY,
        color: mix(white, accent, sliceOpacity(index)),
        borderColor: white,
        borderWidth: 1,
      });
    }
    let legendY = anchorY - 18;
    for (const [index, slice] of slices.entries()) {
      page.drawRectangle({
        x: MARGIN + 170,
        y: legendY - 1,
        width: 8,
        height: 8,
        color: mix(white, accent, sliceOpacity(index)),
      });
      page.drawText(
        truncate(
          `${slice.label} - ${slice.display} (${(slice.share * 100).toFixed(1)}%)`,
          8,
          WIDTH - 190,
        ),
        { x: MARGIN + 184, y: legendY, size: 8, font, color: ink },
      );
      legendY -= 15;
    }
    y = anchorY - chartHeight;
  };

  const drawChart = (spec: ChartSpec): void => {
    if (spec.kind === "compare") drawCompare(spec);
    else if (spec.kind === "donut") drawDonut(spec);
    else drawBars(spec);
    for (const omittedRow of spec.omitted) {
      // Named, not drawn: an empty bar reads as zero at a glance.
      text(`Not drawn - ${omittedRow.label}: ${omittedRow.reason}`, {
        size: 7.5,
        color: muted,
        indent: 4,
      });
    }
  };

  /* ---------------------------------------------------------------- */
  /* Document                                                          */
  /* ---------------------------------------------------------------- */

  const chartsBySection = new Map<string, ChartSpec[]>();
  for (const spec of reportChartSpecs(report)) {
    const existing = chartsBySection.get(spec.sectionId) ?? [];
    existing.push(spec);
    chartsBySection.set(spec.sectionId, existing);
  }

  text(report.title, { size: 20, bold: true });
  gap(4);
  text(
    `${report.period.start} to ${report.period.end}${
      report.period.comparisonStart
        ? `  |  compared with ${report.period.comparisonStart} to ${report.period.comparisonEnd ?? ""}`
        : ""
    }`,
    { size: 9, color: muted },
  );
  if (brand.companyName) {
    text(`Prepared for ${brand.companyName}`, { size: 9, color: muted });
  }
  if (report.narrative) {
    gap(8);
    text(report.narrative, { size: 10 });
  }

  for (const section of report.sections) {
    const stateLabel =
      section.state === "available"
        ? ""
        : section.state === "partial"
          ? "  (partial coverage)"
          : section.state === "failed"
            ? "  (could not be read)"
            : "  (not measured)";
    heading(`${section.title}${stateLabel}`);
    text(section.summary, { color: muted });
    gap(4);

    for (const metric of section.metrics) {
      if (metric.value === null) {
        // The reason takes the number's slot, at the same weight — a dash
        // would be read as zero by anyone skimming.
        text(
          `${metric.label}: not measured - ${metric.note ?? "no reading in this period"}`,
          { indent: 8, color: muted },
        );
        continue;
      }
      const change = formatChange(metric);
      text(
        `${metric.label}: ${formatMetricValue(metric)}${change ? `  (${change})` : ""}`,
        { indent: 8 },
      );
    }

    for (const spec of chartsBySection.get(section.id) ?? []) {
      drawChart(spec);
    }

    if (section.breakdown.length > 0) {
      gap(4);
      for (const row of section.breakdown) {
        text(
          `${row.label}: ${row.metrics
            .map((metric) =>
              metric.value === null
                ? `${metric.label.toLowerCase()} not measured`
                : `${metric.label.toLowerCase()} ${formatMetricValue(metric)}`,
            )
            .join(", ")}`,
          { indent: 8, size: 8, color: muted },
        );
      }
    }

    for (const refusal of section.refusals) {
      gap(6);
      need(24);
      page.drawRectangle({
        x: MARGIN,
        y: y - 2,
        width: 2,
        height: 11,
        color: accent,
      });
      text(refusal.expected.toUpperCase(), {
        size: 7.5,
        color: muted,
        indent: 8,
      });
      text(refusal.explanation, { size: 8.5, indent: 8 });
    }
  }

  heading("What this report could not see");
  if (report.coverageGaps.length === 0) {
    text("Every configured source reported for this period.");
  } else {
    text("Listed together so a skimming reader still meets the gaps.", {
      color: muted,
    });
    gap(4);
    for (const gapRow of report.coverageGaps) {
      text(`${gapRow.source} - ${gapRow.reason}`, { indent: 8 });
      gap(2);
    }
  }

  gap(10);
  text(
    `Generated ${report.generatedAt.slice(0, 10)}. Figures are as reported by each platform at the time of generation and are not restated afterwards.`,
    { size: 8, color: muted },
  );

  return pdf.save();
}
