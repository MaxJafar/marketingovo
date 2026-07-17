import type { ComparisonReport } from "@golem-intel/sdk";

interface EvidencePanelProps {
  report: ComparisonReport;
}

export function EvidencePanel({
  report,
}: EvidencePanelProps): React.JSX.Element {
  const isV2 = report.schema_version === "golem.comparison-report.v2";

  const citationCount = isV2
    ? Object.keys((report as any).evidence || {}).length
    : report.targets.reduce(
        (count, target) => count + ((target as any).citations || []).length,
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
            {!isV2 && report.workflow === "research" ? "RESEARCH DOSSIER" : "COMPARISON"}
          </p>
          <h3>{isV2 ? "Dataset Comparison" : report.title}</h3>
          <p>{report.summary}</p>
        </div>
        {!isV2 && report.workflow === "research" && report.source_budget && (
          <span className="definition-chip">
            budget · {report.source_budget} sources
          </span>
        )}
      </div>
      {!isV2 && report.research_plan && (
        <div className="research-plan">
          <strong>Execution plan</strong>
          <ol>
            {report.research_plan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      {isV2 && (report as any).dataset && (
        <div className="dataset-details" style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--canvas)", borderRadius: "0.5rem" }}>
          <strong>Dataset details</strong>
          <dl className="derivation-grid" style={{ marginTop: "0.5rem" }}>
            <div>
              <dt>ID</dt>
              <dd className="mono">{(report as any).dataset.dataset_id.slice(0, 8)}...</dd>
            </div>
            <div>
              <dt>Hash</dt>
              <dd className="mono">{(report as any).dataset.input_sha256.slice(0, 8)}...</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{((report as any).dataset.input_size_bytes / 1024).toFixed(2)} KB</dd>
            </div>
            <div>
              <dt>Catalog</dt>
              <dd>{(report as any).dataset.metric_catalog_version}</dd>
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
        {isV2 ? (
          (report as any).targets.map((target: any) => {
            const citationIds = Array.from(
              new Set(
                (target.metrics || []).flatMap(
                  (m: any) => m.evidence_observation_ids || []
                )
              )
            ) as string[];
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
                  <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {(target.metrics || []).map((metric: any) => {
                      const label = {
                        "followers.delta": "Follower delta",
                        "public-engagement-by-followers.median": "Median engagement",
                        "posting-cadence": "Posting cadence",
                        "content-format-mix": "Content format mix",
                      }[metric.id as string] || metric.id;

                      let displayValue = "";
                      if (metric.availability === "available") {
                        if (metric.id === "public-engagement-by-followers.median") {
                          displayValue = `${(Number(metric.value) * 100).toFixed(2)}%`;
                        } else if (metric.id === "posting-cadence") {
                          displayValue = `${Number(metric.value).toFixed(2)} / wk`;
                        } else if (metric.id === "content-format-mix") {
                          displayValue = typeof metric.value === "object"
                            ? Object.entries(metric.value || {})
                                .map(([k, v]) => `${k}: ${Math.round(Number(v) * 100)}%`)
                                .join(", ")
                            : String(metric.value);
                        } else {
                          displayValue = String(metric.value);
                        }
                      } else {
                        displayValue = metric.availability.toUpperCase();
                      }

                      return (
                        <div key={metric.id} className="metric-item" style={{ padding: "0.5rem", background: "var(--canvas)", borderRadius: "0.25rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</span>
                          <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: metric.availability !== "available" ? "var(--danger)" : "inherit" }}>
                            {displayValue}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {citationIds.length > 0 && (
                  <ul className="citation-list" style={{ marginTop: "1rem" }}>
                    {citationIds.slice(0, 4).map((observationId) => {
                      const obs = ((report as any).evidence || {})[observationId];
                      if (!obs) return null;
                      const isWeb = obs.source_url && (obs.source_url.startsWith("http://") || obs.source_url.startsWith("https://"));
                      return (
                        <li key={observationId}>
                          {isWeb ? (
                            <a href={obs.source_url} target="_blank" rel="noreferrer">
                              {obs.native_id || observationId}
                            </a>
                          ) : (
                            <span>
                              {obs.native_id || observationId}
                            </span>
                          )}
                          <span>
                            {new Date(obs.observed_at).toLocaleDateString()}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })
        ) : (
          report.targets.map((target) => (
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
                {target.citations.slice(0, 4).map((citation) => (
                  <li key={citation.observation_id}>
                    <a
                      href={citation.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {citation.native_id || citation.observation_id}
                    </a>
                    <span>
                      {new Date(citation.observed_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
      {isV2 ? (
        (((report as any).contradictions && (report as any).contradictions.length > 0) || (report.limitations && report.limitations.length > 0)) && (
          <div className="limitations">
            <strong>Contradictions & limits</strong>
            <ul>
              {((report as any).contradictions || []).map((conflict: any, i: number) => (
                <li key={`conflict-${i}`} style={{ color: "var(--danger)" }}>
                  Conflict for target {conflict.target_id} observed at {new Date(conflict.observed_at).toLocaleDateString()} (Observation IDs: {conflict.observation_ids?.join(", ")})
                </li>
              ))}
              {(report.limitations || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )
      ) : (
        (report.contradictions.length > 0 || report.limitations.length > 0) && (
          <div className="limitations">
            <strong>Contradictions & limits</strong>
            <ul>
              {[...report.contradictions, ...report.limitations].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )
      )}
    </section>
  );
}
