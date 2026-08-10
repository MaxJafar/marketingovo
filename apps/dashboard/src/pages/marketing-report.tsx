import { useState } from "react";
import { useSite } from "../context/site-context";
import {
  useGenerateReport,
  useMarketingReport,
  useMarketingReports,
} from "../api/queries";
import type {
  MarketingReport,
  ReportMetric,
  ReportSection,
} from "../api/contracts";
import { fmt, useI18n, type Messages } from "../i18n";
import {
  MeterRow,
  PixelPairedBars,
  type PairedBarRow,
} from "../components/pixel-charts";

/**
 * The cross-channel report.
 *
 * One rendering rule carries the whole page: an unmeasured figure shows its
 * reason where the number would be, at readable weight. A dash reads as zero
 * to anyone skimming, and skimming is what happens to a monthly report — which
 * is exactly how a reporting tool ends up telling a client they got nothing
 * when the truth is nobody looked.
 *
 * The refusals are rendered as content rather than footnotes, for the same
 * reason. See ADR 0007.
 */

const STATE_TONE: Record<string, string> = {
  available: "ok",
  partial: "pending",
  unavailable: "muted",
  failed: "bad",
};

function formatValue(metric: ReportMetric): string {
  if (metric.value === null) return "";
  switch (metric.unit) {
    case "currency": {
      const rounded = Math.round(metric.value * 100) / 100;
      // No symbol is invented when the rows disagreed about currency.
      return metric.currency
        ? `${rounded.toLocaleString()} ${metric.currency}`
        : rounded.toLocaleString();
    }
    case "percent":
      return `${Math.round(metric.value * 10) / 10}%`;
    case "position":
      return metric.value.toFixed(1);
    default:
      return Math.round(metric.value).toLocaleString();
  }
}

function MetricCell({ metric }: { metric: ReportMetric }) {
  const { t } = useI18n();
  const measured = metric.value !== null;
  return (
    <li className="pixel-list-row">
      <div>
        <span className="pixel-hero-sub">{metric.label}</span>
        {measured ? (
          <>
            <strong style={{ display: "block", fontSize: "20px" }}>
              {formatValue(metric)}
            </strong>
            {metric.change !== null ? (
              <p className="pixel-hero-sub">
                {fmt(t.marketingReport.changeVsPrevious, {
                  change:
                    (metric.change > 0 ? "+" : "") +
                    Math.round(metric.change * 1000) / 10,
                })}
              </p>
            ) : metric.note ? (
              <p className="pixel-hero-sub">{metric.note}</p>
            ) : null}
          </>
        ) : (
          // The reason takes the number's slot. A dash here would be read as
          // zero, which is the failure this whole surface exists to avoid.
          <p className="pixel-hero-sub" style={{ fontStyle: "italic" }}>
            {metric.note ?? t.marketingReport.notMeasuredPeriod}
          </p>
        )}
      </div>
    </li>
  );
}

/** The one breakdown metric each section charts, when it has one. */
const BREAKDOWN_CHART: Partial<
  Record<
    ReportSection["id"],
    { key: string; title: keyof Messages["marketingReport"]["breakdownTitle"] }
  >
> = {
  paid: { key: "spend", title: "paid" },
  social: { key: "published", title: "social" },
  competitors: { key: "signals", title: "competitors" },
};

/**
 * The section's charts. A mark is only drawn from a measured value — an
 * unmeasured row is named below the chart with its reason, never drawn as an
 * empty bar, because an empty bar reads as zero at exactly the glance a chart
 * exists for.
 */
function SectionCharts({ section }: { section: ReportSection }) {
  const { t } = useI18n();
  const compareRows: PairedBarRow[] = [];
  const compareOmitted: Array<{ label: string; reason: string }> = [];
  for (const metric of section.metrics) {
    // change is only non-null when both periods were measured, so the
    // previous value can be recovered exactly from the stored figures.
    if (metric.value === null || metric.change === null) continue;
    if (1 + metric.change <= 1e-9) {
      // Fell to a measured zero: the previous value is unrecoverable from
      // value/(1+change), so the fall is stated rather than silently dropped.
      compareOmitted.push({
        label: metric.label,
        reason: t.marketingReport.fellToZero,
      });
      continue;
    }
    const previous = metric.value / (1 + metric.change);
    compareRows.push({
      name: metric.label,
      current: metric.value,
      currentDisplay: formatValue(metric),
      previous,
      previousDisplay: formatValue({ ...metric, value: previous }),
    });
  }

  const config = BREAKDOWN_CHART[section.id];
  const measuredRows: Array<{ label: string; metric: ReportMetric }> = [];
  const omittedRows: Array<{ label: string; reason: string }> = [];
  const currencies = new Set<string | null>();
  if (config) {
    for (const row of section.breakdown) {
      const metric = row.metrics.find((entry) => entry.key === config.key);
      if (!metric) continue;
      if (metric.value === null) {
        omittedRows.push({
          label: row.label,
          reason: metric.note ?? t.marketingReport.notMeasuredPeriod,
        });
        continue;
      }
      currencies.add(metric.currency);
      measuredRows.push({ label: row.label, metric });
    }
  }
  // Bars invite comparison along one axis; rows in two currencies would put
  // unlike quantities on it, so the drawing is declined and the table stands.
  const barsDrawable =
    config && measuredRows.length > 0 && currencies.size <= 1;
  const barMax = Math.max(
    ...measuredRows.map((row) => row.metric.value ?? 0),
    1e-9,
  );

  if (compareRows.length === 0 && compareOmitted.length === 0 && !barsDrawable)
    return null;
  return (
    <>
      {compareRows.length > 0 || compareOmitted.length > 0 ? (
        <div className="pixel-subsection">
          <h4>{t.marketingReport.compareHeading}</h4>
          <PixelPairedBars rows={compareRows} />
          {compareOmitted.map((row) => (
            <p
              key={row.label}
              className="pixel-hero-sub"
              style={{ fontStyle: "italic" }}
            >
              {fmt(t.marketingReport.notDrawn, {
                label: row.label,
                reason: row.reason,
              })}
            </p>
          ))}
        </div>
      ) : null}
      {barsDrawable ? (
        <div className="pixel-subsection">
          <h4>{t.marketingReport.breakdownTitle[config.title]}</h4>
          <div className="pixel-meters">
            {measuredRows.map((row) => (
              <MeterRow
                key={row.label}
                name={row.label}
                value={row.metric.value}
                max={barMax}
                display={formatValue(row.metric)}
              />
            ))}
          </div>
          {omittedRows.map((row) => (
            <p
              key={row.label}
              className="pixel-hero-sub"
              style={{ fontStyle: "italic" }}
            >
              {fmt(t.marketingReport.notDrawn, {
                label: row.label,
                reason: row.reason,
              })}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

function SectionPanel({ section }: { section: ReportSection }) {
  const { t } = useI18n();
  return (
    <section className="pixel-panel">
      <div className="pixel-panel-head">
        <h2>{section.title}</h2>
        <span className={`pixel-tag pixel-tag-${STATE_TONE[section.state]}`}>
          {t.marketingReport.stateLabel[section.state]}
        </span>
      </div>
      <div className="pixel-panel-body">
        <p className="pixel-hero-sub">{section.summary}</p>

        {section.metrics.length > 0 ? (
          <ul className="pixel-list">
            {section.metrics.map((metric) => (
              <MetricCell key={metric.key} metric={metric} />
            ))}
          </ul>
        ) : null}

        <SectionCharts section={section} />

        {section.breakdown.length > 0 ? (
          <div className="pixel-subsection">
            <h4>{t.marketingReport.breakdownHeading}</h4>
            <table className="pixel-table">
              <tbody>
                {section.breakdown.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.metrics.map((metric) => (
                      <td key={metric.key}>
                        {metric.value === null
                          ? t.marketingReport.notMeasuredCell
                          : formatValue(metric)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {section.refusals.map((refusal) => (
          <div key={refusal.expected} className="pixel-subsection">
            <h4>{refusal.expected}</h4>
            <p className="pixel-hero-sub">{refusal.explanation}</p>
          </div>
        ))}

        {section.sources.length > 0 ? (
          <p className="pixel-hero-sub">
            {t.marketingReport.sourcesPrefix}{" "}
            {section.sources
              .map((source) =>
                fmt(t.marketingReport.sourceEntry, {
                  label: source.label,
                  state: t.marketingReport.stateLabel[source.state],
                  reason: source.reason ? ` — ${source.reason}` : "",
                }),
              )
              .join(" · ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ReportView({ report }: { report: MarketingReport }) {
  const { t } = useI18n();
  return (
    <>
      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{report.title}</h2>
          <span className="pixel-panel-mark">
            {report.period.start} → {report.period.end}
          </span>
        </div>
        <div className="pixel-panel-body">
          {report.narrative ? (
            <p className="pixel-hero-sub">{report.narrative}</p>
          ) : (
            <p className="pixel-hero-sub">{t.marketingReport.noNarrative}</p>
          )}
          <div className="pixel-row-actions">
            <a
              className="pixel-button"
              href={`/api/v1/marketing-reports/${encodeURIComponent(report.id)}/render?format=html`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t.marketingReport.openClientVersion}
            </a>
            <a
              className="pixel-button"
              href={`/api/v1/marketing-reports/${encodeURIComponent(report.id)}/render?format=text`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t.marketingReport.plainText}
            </a>
            <a
              className="pixel-button"
              href={`/api/v1/marketing-reports/${encodeURIComponent(report.id)}/render?format=pdf`}
              download={`marketing-report-${report.id}.pdf`}
            >
              {t.marketingReport.downloadPdf}
            </a>
          </div>
        </div>
      </section>

      {report.coverageGaps.length > 0 ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>{t.marketingReport.gapsHeading}</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">{t.marketingReport.gapsBody}</p>
            <ul className="pixel-list">
              {report.coverageGaps.map((gap, index) => (
                <li key={index} className="pixel-list-row">
                  <div>
                    <strong>{gap.source}</strong>
                    <p className="pixel-hero-sub">{gap.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {report.sections.map((section) => (
        <SectionPanel key={section.id} section={section} />
      ))}
    </>
  );
}

export function MarketingReportPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const reports = useMarketingReports(siteId);
  const generate = useGenerateReport(siteId);
  const [selectedId, setSelectedId] = useState("");
  const stored = useMarketingReport(selectedId);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const items = reports.data?.data.items ?? [];
  const active = generate.data?.data ?? stored.data?.data ?? null;

  return (
    <>
      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.marketingReport.generateHeading}</h2>
          <div className="pixel-row-actions">
            <input
              type="date"
              className="pixel-input"
              value={start}
              aria-label={t.marketingReport.periodStart}
              onChange={(event) => setStart(event.target.value)}
            />
            <input
              type="date"
              className="pixel-input"
              value={end}
              aria-label={t.marketingReport.periodEnd}
              onChange={(event) => setEnd(event.target.value)}
            />
            <button
              type="button"
              className="pixel-button pixel-button-primary"
              disabled={generate.isPending}
              onClick={() =>
                generate.mutate({
                  ...(start ? { start } : {}),
                  ...(end ? { end } : {}),
                  compare: true,
                })
              }
            >
              {generate.isPending
                ? t.marketingReport.gathering
                : t.marketingReport.generate}
            </button>
          </div>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">{t.marketingReport.description}</p>
          {generate.isError ? (
            <p className="pixel-hero-sub" role="alert">
              {generate.error instanceof Error
                ? generate.error.message
                : t.marketingReport.generateFailed}
            </p>
          ) : null}
          {items.length > 0 ? (
            <ul className="pixel-list">
              {items.map((summary) => (
                <li key={summary.id} className="pixel-list-row">
                  <label>
                    <input
                      type="radio"
                      name="report"
                      checked={selectedId === summary.id}
                      onChange={() => setSelectedId(summary.id)}
                    />{" "}
                    <strong>{summary.title}</strong>
                  </label>
                  <p className="pixel-hero-sub">
                    <span
                      className={`pixel-tag pixel-tag-${STATE_TONE[summary.state]}`}
                    >
                      {t.marketingReport.stateLabel[summary.state]}
                    </span>{" "}
                    {fmt(t.marketingReport.generatedOn, {
                      date: new Date(summary.generatedAt).toLocaleString(),
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pixel-hero-sub">{t.marketingReport.empty}</p>
          )}
        </div>
      </section>

      {active ? <ReportView report={active} /> : null}
    </>
  );
}
