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

const STATE_LABEL: Record<string, string> = {
  available: "complete",
  partial: "partial coverage",
  unavailable: "not measured",
  failed: "could not be read",
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
                {metric.change > 0 ? "+" : ""}
                {Math.round(metric.change * 1000) / 10}% vs previous period
              </p>
            ) : metric.note ? (
              <p className="pixel-hero-sub">{metric.note}</p>
            ) : null}
          </>
        ) : (
          // The reason takes the number's slot. A dash here would be read as
          // zero, which is the failure this whole surface exists to avoid.
          <p className="pixel-hero-sub" style={{ fontStyle: "italic" }}>
            {metric.note ?? "Not measured in this period."}
          </p>
        )}
      </div>
    </li>
  );
}

function SectionPanel({ section }: { section: ReportSection }) {
  return (
    <section className="pixel-panel">
      <div className="pixel-panel-head">
        <h2>{section.title}</h2>
        <span className={`pixel-tag pixel-tag-${STATE_TONE[section.state]}`}>
          {STATE_LABEL[section.state]}
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

        {section.breakdown.length > 0 ? (
          <div className="pixel-subsection">
            <h4>Breakdown</h4>
            <table className="pixel-table">
              <tbody>
                {section.breakdown.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.metrics.map((metric) => (
                      <td key={metric.key}>
                        {metric.value === null
                          ? "not measured"
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
            Sources:{" "}
            {section.sources
              .map(
                (source) =>
                  `${source.label} (${STATE_LABEL[source.state]}${source.reason ? ` — ${source.reason}` : ""})`,
              )
              .join(" · ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ReportView({ report }: { report: MarketingReport }) {
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
            <p className="pixel-hero-sub">
              No narrative yet. Write one, or ask an attached agent to — a
              summary assembled from the numbers reads as insight while being
              arithmetic, so this is deliberately not generated.
            </p>
          )}
          <div className="pixel-row-actions">
            <a
              className="pixel-button"
              href={`/api/v1/marketing-reports/${encodeURIComponent(report.id)}/render?format=html`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open the client version
            </a>
            <a
              className="pixel-button"
              href={`/api/v1/marketing-reports/${encodeURIComponent(report.id)}/render?format=text`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Plain text
            </a>
          </div>
        </div>
      </section>

      {report.coverageGaps.length > 0 ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>What this report could not see</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">
              Gathered here as well as in each section, so a reader who skims
              the numbers still meets the gaps.
            </p>
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
          <h2>Generate a report</h2>
          <div className="pixel-row-actions">
            <input
              type="date"
              className="pixel-input"
              value={start}
              aria-label="Period start"
              onChange={(event) => setStart(event.target.value)}
            />
            <input
              type="date"
              className="pixel-input"
              value={end}
              aria-label="Period end"
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
              {generate.isPending ? "Gathering…" : "Generate"}
            </button>
          </div>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">
            Spans paid, organic search, social publishing and email. Leave the
            dates empty for the last complete 30 days — the current day is
            excluded because providers restate it.
          </p>
          {generate.isError ? (
            <p className="pixel-hero-sub" role="alert">
              {generate.error instanceof Error
                ? generate.error.message
                : "The report could not be generated."}
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
                      {STATE_LABEL[summary.state]}
                    </span>{" "}
                    · generated {new Date(summary.generatedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pixel-hero-sub">
              No reports yet. A stored report is a frozen snapshot — figures are
              as each platform reported them on the day, and are not restated
              afterwards.
            </p>
          )}
        </div>
      </section>

      {active ? <ReportView report={active} /> : null}
    </>
  );
}
