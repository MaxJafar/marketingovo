import type { ComparisonReport } from "@golem-intel/sdk";

interface EvidencePanelProps {
  report: ComparisonReport;
}

export function EvidencePanel({
  report,
}: EvidencePanelProps): React.JSX.Element {
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
      <div className="research-plan">
        <strong>Execution plan</strong>
        <ol>
          {report.research_plan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
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
