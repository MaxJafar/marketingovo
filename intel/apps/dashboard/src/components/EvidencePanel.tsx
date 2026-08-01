import type { ComparisonReport } from "@agentintel/sdk";

type ImportComparisonReport = Extract<
  ComparisonReport,
  { schema_version: "agentintel.comparison-report.v2" }
>;
type ComparisonReportV1 = Extract<
  ComparisonReport,
  { schema_version: "agentintel.comparison-report.v1" }
>;

interface EvidencePanelProps {
  report: ComparisonReport;
}

export function EvidencePanel({
  report,
}: EvidencePanelProps): React.JSX.Element {
  if (report.schema_version === "agentintel.comparison-report.v2") {
    return <EvidencePanelV2 report={report} />;
  }
  return <EvidencePanelV1 report={report} />;
}

function EvidencePanelV2({
  report,
}: {
  report: ImportComparisonReport;
}): React.JSX.Element {
  const citationCount = Object.keys(report.evidence || {}).length;

  return (
    <section className="panel evidence-panel" aria-labelledby="evidence-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CLAIM → RECORD</p>
          <h2 id="evidence-title">Evidence ledger</h2>
        </div>
        <span className="definition-chip">{citationCount} citations</span>
      </div>
      <div className="dossier-summary">
        <div>
          <p className="eyebrow">COMPARISON</p>
          <h3>Dataset Comparison</h3>
          <p>{report.summary}</p>
        </div>
      </div>

      {report.dataset && (
        <div
          className="dataset-details"
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "var(--canvas)",
            borderRadius: "0.5rem",
          }}
        >
          <strong>Dataset details</strong>
          <dl className="derivation-grid" style={{ marginTop: "0.5rem" }}>
            <div>
              <dt>ID</dt>
              <dd className="mono">
                {report.dataset.dataset_id.slice(0, 8)}...
              </dd>
            </div>
            <div>
              <dt>Hash</dt>
              <dd className="mono">
                {report.dataset.input_sha256.slice(0, 8)}...
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{(report.dataset.input_size_bytes / 1024).toFixed(2)} KB</dd>
            </div>
            <div>
              <dt>Catalog</dt>
              <dd>{report.dataset.metric_catalog_version}</dd>
            </div>
          </dl>
        </div>
      )}
      <dl className="derivation-grid" aria-label="Report derivation">
        <div>
          <dt>Worker</dt>
          <dd>{report.derivation.worker_version}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{report.derivation.model_version}</dd>
        </div>
        <div>
          <dt>Connector</dt>
          <dd>{report.derivation.connector_version}</dd>
        </div>
        <div>
          <dt>Parser</dt>
          <dd>{report.derivation.parser_version}</dd>
        </div>
      </dl>
      <div className="finding-list">
        {report.targets.map((target) => {
          return (
            <article className="finding" key={target.target_id}>
              <header>
                <div>
                  <h3>{target.target_name}</h3>
                  <p className="mono">{target.target_id}</p>
                </div>
              </header>
              <div className="metrics-summary" style={{ marginTop: "1rem" }}>
                <strong>Metrics</strong>
                <div
                  className="metrics-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {(target.metrics || []).map((metric) => {
                    const label =
                      {
                        "followers.delta": "Follower delta",
                        "public-engagement-by-followers.median":
                          "Median engagement",
                        "posting-cadence": "Posting cadence",
                        "content-format-mix": "Content format mix",
                      }[metric.id] || metric.id;

                    let displayValue = "";
                    if (metric.availability === "available") {
                      if (
                        metric.id === "public-engagement-by-followers.median"
                      ) {
                        displayValue = `${(Number(metric.value) * 100).toFixed(2)}%`;
                      } else if (metric.id === "posting-cadence") {
                        displayValue = `${Number(metric.value).toFixed(2)} / wk`;
                      } else if (metric.id === "content-format-mix") {
                        const mix = metric.value;
                        if (typeof mix === "object" && mix !== null) {
                          displayValue = Object.entries(mix)
                            .filter(([, v]) => typeof v === "number")
                            .map(
                              ([k, v]) =>
                                `${k}: ${Math.round(Number(v) * 100)}%`,
                            )
                            .join(", ");
                        } else {
                          displayValue = String(mix);
                        }
                      } else {
                        displayValue = String(metric.value);
                      }
                    } else {
                      displayValue = metric.availability.toUpperCase();
                    }

                    return (
                      <div
                        key={metric.id}
                        className="metric-item"
                        style={{
                          padding: "0.5rem",
                          background: "var(--canvas)",
                          borderRadius: "0.25rem",
                        }}
                      >
                        <span
                          style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                        >
                          {label}
                        </span>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "0.9rem",
                            color:
                              metric.availability !== "available"
                                ? "var(--danger)"
                                : "inherit",
                          }}
                        >
                          {displayValue}
                        </div>

                        {metric.limitations &&
                          metric.limitations.length > 0 && (
                            <ul
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--warning)",
                                marginTop: "0.25rem",
                                paddingLeft: "1rem",
                              }}
                            >
                              {metric.limitations.map((lim, idx) => (
                                <li key={idx}>{lim}</li>
                              ))}
                            </ul>
                          )}

                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--muted)",
                            marginTop: "0.5rem",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "0.25rem",
                          }}
                        >
                          <div>Def: {metric.definition_version}</div>
                          <div>Pop: {metric.population}</div>
                          <div>Num: {metric.numerator}</div>
                          <div>Denom: {metric.denominator}</div>
                          {metric.period && (
                            <div style={{ gridColumn: "span 2" }}>
                              Period:{" "}
                              {new Date(
                                metric.period.start,
                              ).toLocaleDateString()}{" "}
                              -{" "}
                              {new Date(metric.period.end).toLocaleDateString()}
                            </div>
                          )}
                          {metric.quality && (
                            <>
                              <div
                                style={{
                                  gridColumn: "span 2",
                                  marginTop: "0.25rem",
                                  fontWeight: "bold",
                                }}
                              >
                                Quality
                              </div>
                              <div>
                                Included: {metric.quality.included_count} /{" "}
                                {metric.quality.candidate_count}
                              </div>
                              <div>
                                Excluded: {metric.quality.excluded_count}
                              </div>
                              {metric.quality.mean_input_coverage !== null && (
                                <div>
                                  Mean Coverage:{" "}
                                  {(
                                    metric.quality.mean_input_coverage * 100
                                  ).toFixed(1)}
                                  %
                                </div>
                              )}
                              {metric.quality.mean_input_confidence !==
                                null && (
                                <div>
                                  Mean Confidence:{" "}
                                  {(
                                    metric.quality.mean_input_confidence * 100
                                  ).toFixed(1)}
                                  %
                                </div>
                              )}
                              {metric.quality.min_input_confidence !== null && (
                                <div>
                                  Min Confidence:{" "}
                                  {(
                                    metric.quality.min_input_confidence * 100
                                  ).toFixed(1)}
                                  %
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {metric.evidence_observation_ids &&
                          metric.evidence_observation_ids.length > 0 && (
                            <div style={{ marginTop: "0.75rem" }}>
                              <strong style={{ fontSize: "0.75rem" }}>
                                Evidence
                              </strong>
                              <ul
                                className="citation-list"
                                style={{ marginTop: "0.25rem" }}
                              >
                                {metric.evidence_observation_ids.map(
                                  (observationId) => {
                                    const obs = report.evidence[observationId];
                                    if (!obs) return null;
                                    return (
                                      <li key={observationId}>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontFamily: "monospace",
                                              fontSize: "0.75rem",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                              maxWidth: "200px",
                                            }}
                                            title={obs.source_url}
                                          >
                                            {obs.source_url}
                                          </span>
                                          <button
                                            onClick={() =>
                                              navigator.clipboard.writeText(
                                                obs.source_url,
                                              )
                                            }
                                            aria-label="Copy source URL"
                                            style={{
                                              background: "none",
                                              border: "1px solid var(--border)",
                                              borderRadius: "0.25rem",
                                              cursor: "pointer",
                                              fontSize: "0.7rem",
                                              padding: "0.1rem 0.3rem",
                                            }}
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <span style={{ fontSize: "0.7rem" }}>
                                          Observed:{" "}
                                          {new Date(
                                            obs.observed_at,
                                          ).toLocaleDateString()}
                                        </span>
                                      </li>
                                    );
                                  },
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {((report.contradictions && report.contradictions.length > 0) ||
        (report.limitations && report.limitations.length > 0)) && (
        <div className="limitations">
          <strong>Contradictions & limits</strong>
          <ul>
            {(report.contradictions || []).map((conflict, i) => (
              <li key={`conflict-${i}`} style={{ color: "var(--danger)" }}>
                Conflict for target {conflict.target_id} observed at{" "}
                {new Date(conflict.observed_at).toLocaleDateString()}{" "}
                (Observation IDs: {conflict.observation_ids?.join(", ")})
              </li>
            ))}
            {(report.limitations || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EvidencePanelV1({
  report,
}: {
  report: ComparisonReportV1;
}): React.JSX.Element {
  const citationCount = report.targets.reduce(
    (count, target) => count + target.citations.length,
    0,
  );

  return (
    <section className="panel evidence-panel" aria-labelledby="evidence-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CLAIM → RECORD</p>
          <h2 id="evidence-title">Evidence ledger</h2>
        </div>
        <span className="definition-chip">{citationCount} citations</span>
      </div>
      <div className="dossier-summary">
        <div>
          <p className="eyebrow">
            {report.workflow === "research" ? "RESEARCH DOSSIER" : "COMPARISON"}
          </p>
          <h3>{report.title}</h3>
          <p>{report.summary}</p>
        </div>
        {report.workflow === "research" && report.source_budget && (
          <span className="definition-chip">
            budget · {report.source_budget} sources
          </span>
        )}
      </div>
      {report.research_plan && (
        <div className="research-plan">
          <strong>Execution plan</strong>
          <ol>
            {report.research_plan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      <dl className="derivation-grid" aria-label="Report derivation">
        <div>
          <dt>Worker</dt>
          <dd>{report.derivation.worker_version}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{report.derivation.model_version}</dd>
        </div>
        <div>
          <dt>Connector</dt>
          <dd>{report.derivation.connector_version}</dd>
        </div>
        <div>
          <dt>Parser</dt>
          <dd>{report.derivation.parser_version}</dd>
        </div>
      </dl>
      <div className="finding-list">
        {report.targets.map((target) => (
          <article className="finding" key={target.entity_id}>
            <header>
              <div>
                <h3>{target.entity_name}</h3>
                <p className="mono">{target.entity_id}</p>
              </div>
              <span>{Math.round(target.confidence * 100)}% confidence</span>
            </header>
            <dl className="finding-metrics">
              <div>
                <dt>Median engagement</dt>
                <dd>{(target.median_engagement_rate * 100).toFixed(2)}%</dd>
              </div>
              <div>
                <dt>Posts / week</dt>
                <dd>{target.posting_cadence_per_week.toFixed(2)}</dd>
              </div>
            </dl>
            <ul className="citation-list">
              {target.citations.slice(0, 4).map((citation) => {
                const isWeb =
                  citation.source_url.startsWith("http://") ||
                  citation.source_url.startsWith("https://");
                return (
                  <li key={citation.observation_id}>
                    {isWeb ? (
                      <a
                        href={citation.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {citation.native_id || citation.observation_id}
                      </a>
                    ) : (
                      <span>
                        {citation.native_id || citation.observation_id}
                      </span>
                    )}
                    <span>
                      {new Date(citation.observed_at).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
      {(report.contradictions.length > 0 || report.limitations.length > 0) && (
        <div className="limitations">
          <strong>Contradictions & limits</strong>
          <ul>
            {[...report.contradictions, ...report.limitations].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
