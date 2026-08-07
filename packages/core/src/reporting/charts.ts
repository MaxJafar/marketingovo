// Charts for the client-facing report.
//
// A chart inherits every rule the numbers live by, and one more of its own: a
// mark can only be drawn from a measured value. An unmeasured row is not a
// zero-length bar — it is left out of the drawing and named below it with its
// reason, because an empty bar reads as "nothing happened" at a glance, and
// the glance is the whole point of a chart.
//
// The specs here are pure data so the SVG renderer (HTML report) and the
// pdf-lib renderer (PDF download) draw from the same decisions and cannot
// disagree about what was measurable.

import type { ReportBrand } from "./render.js";
import { formatMetricValue } from "./render.js";
import type { MarketingReport, ReportMetric, ReportSection } from "./types.js";

export interface ChartBarRow {
  label: string;
  value: number;
  /** The number as the report prints it, units and all. */
  display: string;
}

export interface ChartCompareRow {
  label: string;
  current: number;
  currentDisplay: string;
  previous: number;
  previousDisplay: string;
}

export interface ChartOmittedRow {
  label: string;
  reason: string;
}

export interface ChartSpec {
  sectionId: ReportSection["id"];
  kind: "bars" | "donut" | "compare";
  title: string;
  /** Bars and donut rows. Empty for `compare`. */
  rows: ChartBarRow[];
  /** Paired current/previous rows. Empty unless `compare`. */
  compareRows: ChartCompareRow[];
  /** Rows that could not be drawn, and why. Always rendered as text. */
  omitted: ChartOmittedRow[];
}

const MAX_BAR_ROWS = 8;
const MAX_DONUT_SLICES = 6;

function measured(metric: ReportMetric): boolean {
  return (
    metric.value !== null &&
    (metric.state === "available" || metric.state === "partial")
  );
}

/** The single breakdown metric a section charts, when it has one. */
const BREAKDOWN_CHART: Partial<
  Record<ReportSection["id"], { key: string; title: string }>
> = {
  paid: { key: "spend", title: "Spend by account and platform" },
  social: { key: "published", title: "Posts published by platform" },
  competitors: { key: "signals", title: "Public signals by competitor" },
};

/** Sections whose headline counts read well as plain bars. */
const METRIC_BAR_SECTIONS: ReadonlySet<ReportSection["id"]> = new Set([
  "email",
  "actions",
  "competitors",
]);

function breakdownSpecs(section: ReportSection): ChartSpec[] {
  const config = BREAKDOWN_CHART[section.id];
  if (!config || section.breakdown.length === 0) return [];

  const rows: ChartBarRow[] = [];
  const omitted: ChartOmittedRow[] = [];
  const currencies = new Set<string | null>();
  for (const entry of section.breakdown) {
    const metric = entry.metrics.find((m) => m.key === config.key);
    if (!metric) continue;
    if (!measured(metric)) {
      omitted.push({
        label: entry.label,
        reason: metric.note ?? "Not measured in this period.",
      });
      continue;
    }
    currencies.add(metric.currency);
    rows.push({
      label: entry.label,
      value: metric.value!,
      display: formatMetricValue(metric),
    });
  }

  // Bars invite comparison along one axis. Rows in two currencies would put
  // unlike quantities on that axis, so the drawing is declined; the table
  // above the chart still carries every figure.
  if (section.id === "paid" && currencies.size > 1) return [];
  if (rows.length === 0 || rows.length > MAX_BAR_ROWS) return [];

  const specs: ChartSpec[] = [
    {
      sectionId: section.id,
      kind: "bars",
      title: config.title,
      rows,
      compareRows: [],
      omitted,
    },
  ];

  // A donut claims to show the whole. It is only drawn when every row was
  // measured — a share of an incomplete total misstates every slice — and
  // competitor citation counts never become one, because a share of citations
  // reads as market share, which nobody measured.
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (
    section.id !== "competitors" &&
    omitted.length === 0 &&
    rows.length >= 2 &&
    rows.length <= MAX_DONUT_SLICES &&
    rows.every((row) => row.value >= 0) &&
    total > 0
  ) {
    specs.push({
      sectionId: section.id,
      kind: "donut",
      title: `${config.title} — share`,
      rows,
      compareRows: [],
      omitted: [],
    });
  }
  return specs;
}

function compareSpec(section: ReportSection): ChartSpec | null {
  const rows: ChartCompareRow[] = [];
  for (const metric of section.metrics) {
    // change is only ever non-null when BOTH periods were measured, so the
    // previous value can be recovered exactly: change = (cur - prev) / |prev|.
    if (!measured(metric) || metric.change === null) continue;
    if (1 + metric.change <= 0) continue;
    const previous = metric.value! / (1 + metric.change);
    rows.push({
      label: metric.label,
      current: metric.value!,
      currentDisplay: formatMetricValue(metric),
      previous,
      previousDisplay: formatMetricValue({ ...metric, value: previous }),
    });
  }
  if (rows.length === 0) return null;
  return {
    sectionId: section.id,
    kind: "compare",
    title: "This period against the one before it",
    rows: [],
    compareRows: rows,
    omitted: [],
  };
}

function metricBarSpec(section: ReportSection): ChartSpec | null {
  if (!METRIC_BAR_SECTIONS.has(section.id)) return null;
  const rows: ChartBarRow[] = [];
  const omitted: ChartOmittedRow[] = [];
  for (const metric of section.metrics) {
    if (metric.unit !== "count") continue;
    if (!measured(metric)) {
      omitted.push({
        label: metric.label,
        reason: metric.note ?? "Not measured in this period.",
      });
      continue;
    }
    rows.push({
      label: metric.label,
      value: metric.value!,
      display: formatMetricValue(metric),
    });
  }
  if (rows.length < 2 || rows.length > MAX_BAR_ROWS) return null;
  return {
    sectionId: section.id,
    kind: "bars",
    title: "At a glance",
    rows,
    compareRows: [],
    omitted,
  };
}

/**
 * Every chart the report can honestly draw, in section order.
 *
 * Sections with nothing measurable simply contribute no charts — the absence
 * and its reasons are already rendered as content by the section itself.
 */
export function reportChartSpecs(report: MarketingReport): ChartSpec[] {
  const specs: ChartSpec[] = [];
  for (const section of report.sections) {
    const compare = compareSpec(section);
    if (compare) specs.push(compare);
    specs.push(...breakdownSpecs(section));
    const counts = metricBarSpec(section);
    if (counts) specs.push(counts);
  }
  return specs;
}

/* ------------------------------------------------------------------ */
/* Geometry shared by the SVG and PDF renderers                        */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  label: string;
  value: number;
  display: string;
  /** Fraction of the whole, 0..1. */
  share: number;
  /** SVG path of the annular sector, y growing downwards. */
  path: string;
}

/** An annular sector path (SVG coordinates, y down), for donut slices. */
export function annularSectorPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  // Angles in radians, 0 at 12 o'clock, growing clockwise.
  const point = (radius: number, angle: number): [number, number] => [
    cx + radius * Math.sin(angle),
    cy - radius * Math.cos(angle),
  ];
  const clamped = Math.min(endAngle, startAngle + Math.PI * 2 - 0.0001);
  const large = clamped - startAngle > Math.PI ? 1 : 0;
  const [x0, y0] = point(outerRadius, startAngle);
  const [x1, y1] = point(outerRadius, clamped);
  const [x2, y2] = point(innerRadius, clamped);
  const [x3, y3] = point(innerRadius, startAngle);
  const r = (value: number): string => value.toFixed(2);
  return [
    `M ${r(x0)} ${r(y0)}`,
    `A ${r(outerRadius)} ${r(outerRadius)} 0 ${large} 1 ${r(x1)} ${r(y1)}`,
    `L ${r(x2)} ${r(y2)}`,
    `A ${r(innerRadius)} ${r(innerRadius)} 0 ${large} 0 ${r(x3)} ${r(y3)}`,
    "Z",
  ].join(" ");
}

export function donutSlices(
  spec: ChartSpec,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
): DonutSlice[] {
  const total = spec.rows.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return [];
  let angle = 0;
  return spec.rows.map((row) => {
    const share = row.value / total;
    const start = angle;
    angle += share * Math.PI * 2;
    return {
      label: row.label,
      value: row.value,
      display: row.display,
      share,
      path: annularSectorPath(cx, cy, outerRadius, innerRadius, start, angle),
    };
  });
}

/** Slice opacities derived from one brand accent, darkest first. */
export function sliceOpacity(index: number): number {
  const steps = [0.95, 0.75, 0.58, 0.44, 0.32, 0.22];
  return steps[index % steps.length]!;
}

/* ------------------------------------------------------------------ */
/* SVG rendering                                                       */
/* ------------------------------------------------------------------ */

const CHART_WIDTH = 640;
const BAR_LABEL_WIDTH = 190;
const BAR_VALUE_WIDTH = 120;
const BAR_TRACK_WIDTH = CHART_WIDTH - BAR_LABEL_WIDTH - BAR_VALUE_WIDTH;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateLabel(value: string, max = 30): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function svgOpen(height: number, title: string, brand: ReportBrand): string {
  return `<svg role="img" aria-label="${escapeXml(title)}" viewBox="0 0 ${CHART_WIDTH} ${height}" width="100%" style="max-width:${CHART_WIDTH}px;height:auto;display:block;font-family:${escapeXml(brand.bodyFont)};">`;
}

function barsSvg(spec: ChartSpec, brand: ReportBrand): string {
  const rowHeight = 30;
  const top = 6;
  const height = top + spec.rows.length * rowHeight + 6;
  const max = Math.max(...spec.rows.map((row) => row.value), 0);
  const parts: string[] = [svgOpen(height, spec.title, brand)];
  spec.rows.forEach((row, index) => {
    const y = top + index * rowHeight;
    const width =
      max > 0 ? Math.max((row.value / max) * BAR_TRACK_WIDTH, 1.5) : 1.5;
    parts.push(
      `<text x="${BAR_LABEL_WIDTH - 10}" y="${y + 19}" text-anchor="end" font-size="12" fill="${brand.text}">${escapeXml(truncateLabel(row.label))}</text>`,
      `<rect x="${BAR_LABEL_WIDTH}" y="${y + 8}" width="${BAR_TRACK_WIDTH}" height="14" fill="${brand.background}"/>`,
      `<rect x="${BAR_LABEL_WIDTH}" y="${y + 8}" width="${width.toFixed(1)}" height="14" fill="${brand.accent}"/>`,
      `<text x="${BAR_LABEL_WIDTH + BAR_TRACK_WIDTH + 10}" y="${y + 19}" font-size="12" fill="${brand.text}">${escapeXml(row.display)}</text>`,
    );
  });
  parts.push("</svg>");
  return parts.join("");
}

function compareSvg(spec: ChartSpec, brand: ReportBrand): string {
  const rowHeight = 46;
  const top = 4;
  const legendHeight = 22;
  const height = top + spec.compareRows.length * rowHeight + legendHeight;
  const parts: string[] = [svgOpen(height, spec.title, brand)];
  spec.compareRows.forEach((row, index) => {
    const y = top + index * rowHeight;
    // Each pair is scaled to its own metric's larger period: units differ
    // between rows, so bars are only comparable within a row, and the printed
    // figures carry the actual quantities.
    const max = Math.max(row.current, row.previous, 1e-9);
    const currentWidth = Math.max((row.current / max) * BAR_TRACK_WIDTH, 1.5);
    const previousWidth = Math.max((row.previous / max) * BAR_TRACK_WIDTH, 1.5);
    parts.push(
      `<text x="${BAR_LABEL_WIDTH - 10}" y="${y + 22}" text-anchor="end" font-size="12" fill="${brand.text}">${escapeXml(truncateLabel(row.label))}</text>`,
      `<rect x="${BAR_LABEL_WIDTH}" y="${y + 8}" width="${currentWidth.toFixed(1)}" height="11" fill="${brand.accent}"/>`,
      `<text x="${BAR_LABEL_WIDTH + BAR_TRACK_WIDTH + 10}" y="${y + 18}" font-size="12" fill="${brand.text}">${escapeXml(row.currentDisplay)}</text>`,
      `<rect x="${BAR_LABEL_WIDTH}" y="${y + 23}" width="${previousWidth.toFixed(1)}" height="11" fill="${brand.muted}" fill-opacity="0.55"/>`,
      `<text x="${BAR_LABEL_WIDTH + BAR_TRACK_WIDTH + 10}" y="${y + 33}" font-size="12" fill="${brand.muted}">${escapeXml(row.previousDisplay)}</text>`,
    );
  });
  const legendY = top + spec.compareRows.length * rowHeight + 12;
  parts.push(
    `<rect x="${BAR_LABEL_WIDTH}" y="${legendY - 8}" width="10" height="10" fill="${brand.accent}"/>`,
    `<text x="${BAR_LABEL_WIDTH + 16}" y="${legendY + 1}" font-size="11" fill="${brand.muted}">this period</text>`,
    `<rect x="${BAR_LABEL_WIDTH + 110}" y="${legendY - 8}" width="10" height="10" fill="${brand.muted}" fill-opacity="0.55"/>`,
    `<text x="${BAR_LABEL_WIDTH + 126}" y="${legendY + 1}" font-size="11" fill="${brand.muted}">previous period</text>`,
    "</svg>",
  );
  return parts.join("");
}

function donutSvg(spec: ChartSpec, brand: ReportBrand): string {
  const height = 190;
  const slices = donutSlices(spec, 95, 95, 72, 45);
  const parts: string[] = [svgOpen(height, spec.title, brand)];
  slices.forEach((slice, index) => {
    parts.push(
      `<path d="${slice.path}" fill="${brand.accent}" fill-opacity="${sliceOpacity(index)}" stroke="${brand.surface}" stroke-width="1.5"/>`,
    );
  });
  slices.forEach((slice, index) => {
    const y = 34 + index * 26;
    parts.push(
      `<rect x="220" y="${y - 10}" width="11" height="11" fill="${brand.accent}" fill-opacity="${sliceOpacity(index)}"/>`,
      `<text x="238" y="${y}" font-size="12" fill="${brand.text}">${escapeXml(truncateLabel(slice.label, 34))}</text>`,
      `<text x="${CHART_WIDTH - 10}" y="${y}" text-anchor="end" font-size="12" fill="${brand.muted}">${escapeXml(slice.display)} · ${(slice.share * 100).toFixed(1)}%</text>`,
    );
  });
  parts.push("</svg>");
  return parts.join("");
}

/** One chart as inline SVG. The `omitted` rows are rendered by the caller. */
export function renderChartSvg(spec: ChartSpec, brand: ReportBrand): string {
  if (spec.kind === "compare") return compareSvg(spec, brand);
  if (spec.kind === "donut") return donutSvg(spec, brand);
  return barsSvg(spec, brand);
}
