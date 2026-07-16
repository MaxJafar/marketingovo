import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type {
  AuditRun,
  RunComparisonLinkSnapshot,
  RunComparisonPageSnapshot,
} from "../api/contracts";
import { useRunComparison } from "../api/queries";
import {
  Card,
  InlineNotice,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "./ui";

const terminalAuditStatus = new Set(["completed", "partial"]);

function runTime(run: AuditRun): number {
  const value = Date.parse(run.startedAt);
  return Number.isFinite(value) ? value : 0;
}

function runOptionLabel(run: AuditRun): string {
  return `${formatDate(run.startedAt, true)} · ${run.status} · ${run.id.slice(0, 8)}`;
}

function signed(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function snapshotLabel(snapshot: RunComparisonPageSnapshot | null): string {
  if (!snapshot) return "Not in snapshot";
  const indexability =
    snapshot.indexable === null
      ? "indexability unknown"
      : snapshot.indexable
        ? "indexable"
        : "not indexable";
  return `${snapshot.statusCode ?? "status unavailable"} · ${indexability}`;
}

function linkSnapshotLabel(snapshot: RunComparisonLinkSnapshot | null): string {
  if (!snapshot) return "Not present";
  const status = snapshot.targetStatusCode ?? "status unavailable";
  return `${snapshot.targetState} · ${status} · ${formatNumber(snapshot.occurrences)} occurrence${snapshot.occurrences === 1 ? "" : "s"}`;
}

function linkReasonLabel(reason: string): string {
  return reason.replaceAll("_", " ");
}

export function AuditComparisonCard({ runs }: { runs: AuditRun[] }) {
  const eligibleRuns = useMemo(
    () =>
      runs
        .filter(
          (run) =>
            run.workflowId === "audit" && terminalAuditStatus.has(run.status),
        )
        .sort((left, right) => runTime(right) - runTime(left)),
    [runs],
  );
  const currentOptions = useMemo(
    () =>
      eligibleRuns.filter((candidate) =>
        eligibleRuns.some(
          (baseline) =>
            baseline.id !== candidate.id &&
            runTime(baseline) <= runTime(candidate),
        ),
      ),
    [eligibleRuns],
  );
  const [selectedCurrentId, setSelectedCurrentId] = useState("");
  const [selectedBaselineId, setSelectedBaselineId] = useState("");
  const currentRun =
    currentOptions.find((run) => run.id === selectedCurrentId) ??
    currentOptions[0];
  const baselineOptions = currentRun
    ? eligibleRuns.filter(
        (run) =>
          run.id !== currentRun.id && runTime(run) <= runTime(currentRun),
      )
    : [];
  const baselineRun =
    baselineOptions.find((run) => run.id === selectedBaselineId) ??
    baselineOptions[0];
  const comparisonQuery = useRunComparison(
    currentRun?.id ?? "",
    baselineRun?.id ?? "",
  );
  const comparison = comparisonQuery.data?.data;

  return (
    <Card className="audit-comparison-card">
      <header className="audit-comparison-header">
        <div>
          <p className="eyebrow">Snapshot intelligence</p>
          <h2>Compare audit runs</h2>
          <p>
            Separate regressions from verified fixes using immutable issue and
            page evidence. No new crawl is started.
          </p>
        </div>
        {comparison ? (
          <StatusBadge
            status={comparison.state}
            label={
              comparison.state === "available"
                ? "Comparable"
                : comparison.state === "partial"
                  ? "Partial evidence"
                  : "Page evidence unavailable"
            }
          />
        ) : null}
      </header>

      {currentOptions.length === 0 ? (
        <div className="comparison-empty">
          <strong>Two completed audits are required</strong>
          <p>
            Run a baseline and one follow-up audit. Keyword, content, and
            competitor research runs are excluded from technical history.
          </p>
        </div>
      ) : (
        <>
          <div className="comparison-selectors">
            <label htmlFor="comparison-baseline">
              Baseline audit
              <select
                id="comparison-baseline"
                value={baselineRun?.id ?? ""}
                onChange={(event) =>
                  setSelectedBaselineId(event.currentTarget.value)
                }
              >
                {baselineOptions.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runOptionLabel(run)}
                  </option>
                ))}
              </select>
            </label>
            <span className="comparison-arrow" aria-hidden="true">
              →
            </span>
            <label htmlFor="comparison-current">
              Current audit
              <select
                id="comparison-current"
                value={currentRun?.id ?? ""}
                onChange={(event) => {
                  setSelectedCurrentId(event.currentTarget.value);
                  setSelectedBaselineId("");
                }}
              >
                {currentOptions.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runOptionLabel(run)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="comparison-run-links">
            {baselineRun ? (
              <Link
                to="/audits/$runId"
                params={{ runId: baselineRun.id }}
                className="text-link"
              >
                Open baseline evidence
              </Link>
            ) : null}
            {currentRun ? (
              <Link
                to="/audits/$runId"
                params={{ runId: currentRun.id }}
                className="text-link"
              >
                Open current evidence
              </Link>
            ) : null}
          </div>

          {comparisonQuery.isLoading ? (
            <p className="comparison-loading" role="status">
              Calculating the evidence delta…
            </p>
          ) : null}
          {comparisonQuery.isError ? (
            <InlineNotice tone="danger" title="Comparison unavailable">
              {comparisonQuery.error.message}
            </InlineNotice>
          ) : null}

          {comparison ? (
            <div className="comparison-results">
              <div className="comparison-score-row">
                <div>
                  <span>Regression pressure</span>
                  <strong
                    className={
                      comparison.summary.regressionScore > 0
                        ? "comparison-negative"
                        : comparison.summary.regressionScore < 0
                          ? "comparison-positive"
                          : ""
                    }
                  >
                    {signed(comparison.summary.regressionScore)}
                  </strong>
                  <small>{comparison.scoreVersion}</small>
                </div>
                <p>
                  New issues add severity weight (critical 8, high 5, medium 3,
                  low 1); fixes subtract it. HTTP regressions add 3 and
                  indexability regressions add 2. Negative is net improvement.
                </p>
              </div>

              <dl className="comparison-summary-grid">
                <div>
                  <dt>New / worse issues</dt>
                  <dd>
                    {formatNumber(
                      comparison.summary.newIssues +
                        comparison.summary.severityIncreases,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Resolved / reduced</dt>
                  <dd>
                    {formatNumber(
                      comparison.summary.resolvedIssues +
                        comparison.summary.severityDecreases,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>SEO Health change</dt>
                  <dd>{signed(comparison.summary.healthDelta)}</dd>
                </div>
                <div>
                  <dt>Page regressions</dt>
                  <dd>
                    {formatNumber(
                      comparison.pageChanges.filter(
                        (change) => change.impact === "regression",
                      ).length,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Pages captured</dt>
                  <dd>
                    {formatNumber(comparison.summary.baselinePages)} →{" "}
                    {formatNumber(comparison.summary.currentPages)}
                  </dd>
                </div>
                <div>
                  <dt>Reviewed noise excluded</dt>
                  <dd>
                    {formatNumber(
                      comparison.summary.reviewedExcludedBaseline +
                        comparison.summary.reviewedExcludedCurrent,
                    )}
                  </dd>
                </div>
              </dl>

              <div className="comparison-configuration">
                <div>
                  <span>Configuration</span>
                  <StatusBadge status={comparison.configuration.state} />
                </div>
                <p>
                  {comparison.configuration.state === "matched"
                    ? "Stored crawl settings match across both snapshots."
                    : comparison.configuration.state === "different"
                      ? `Different inputs: ${comparison.configuration.differences.join(", ")}.`
                      : "Stored settings are unavailable, so scope equivalence cannot be proven."}
                </p>
                {comparison.configuration.baselineHash &&
                comparison.configuration.currentHash ? (
                  <small>
                    Config fingerprints:{" "}
                    {comparison.configuration.baselineHash.slice(0, 12)}… →{" "}
                    {comparison.configuration.currentHash.slice(0, 12)}…
                  </small>
                ) : null}
              </div>

              {comparison.warnings.length > 0 ? (
                <InlineNotice tone="warning" title="Interpretation notes">
                  <ul className="comparison-warning-list">
                    {comparison.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </InlineNotice>
              ) : null}

              <section aria-labelledby="issue-regressions-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="issue-regressions-heading">Issue regressions</h3>
                    <p>New findings and findings whose severity increased.</p>
                  </div>
                  <span>
                    {formatNumber(comparison.issueRegressions.length)}
                  </span>
                </div>
                {comparison.issueRegressions.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        New and worsened SEO issues
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Finding</th>
                          <th scope="col">Change</th>
                          <th scope="col">URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.issueRegressions
                          .slice(0, 12)
                          .map((item) => {
                            const href = safeExternalUrl(item.canonicalUrl);
                            return (
                              <tr key={`${item.fingerprint}-${item.change}`}>
                                <td>
                                  <strong>{item.title}</strong>
                                  <small>{item.ruleId}</small>
                                </td>
                                <td>
                                  <StatusBadge
                                    status={
                                      item.currentSeverity ??
                                      item.baselineSeverity ??
                                      "unknown"
                                    }
                                    label={item.change.replaceAll("_", " ")}
                                  />
                                </td>
                                <td>
                                  {href ? (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="table-link"
                                    >
                                      {item.canonicalUrl}
                                    </a>
                                  ) : (
                                    "Site-wide"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="comparison-zero-state">
                    No new or worsened effective issues were detected.
                  </p>
                )}
              </section>

              <section aria-labelledby="issue-improvements-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="issue-improvements-heading">Verified fixes</h3>
                    <p>Findings absent or reduced in the current snapshot.</p>
                  </div>
                  <span>
                    {formatNumber(comparison.issueImprovements.length)}
                  </span>
                </div>
                {comparison.issueImprovements.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        Resolved and reduced SEO issues
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Finding</th>
                          <th scope="col">Change</th>
                          <th scope="col">URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.issueImprovements
                          .slice(0, 12)
                          .map((item) => {
                            const href = safeExternalUrl(item.canonicalUrl);
                            return (
                              <tr key={`${item.fingerprint}-${item.change}`}>
                                <td>
                                  <strong>{item.title}</strong>
                                  <small>{item.ruleId}</small>
                                </td>
                                <td>
                                  <StatusBadge
                                    status="fresh"
                                    label={item.change.replaceAll("_", " ")}
                                  />
                                </td>
                                <td>
                                  {href ? (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="table-link"
                                    >
                                      {item.canonicalUrl}
                                    </a>
                                  ) : (
                                    "Site-wide"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="comparison-zero-state">
                    No issue resolution was verified in this pair.
                  </p>
                )}
              </section>

              <section aria-labelledby="page-changes-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="page-changes-heading">Page changes</h3>
                    <p>Status, indexability, additions, and removals.</p>
                  </div>
                  <span>{formatNumber(comparison.pageChanges.length)}</span>
                </div>
                {comparison.pageChanges.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        Page-level changes between audit snapshots
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">URL</th>
                          <th scope="col">Change</th>
                          <th scope="col">Before</th>
                          <th scope="col">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.pageChanges.slice(0, 20).map((item) => {
                          const href = safeExternalUrl(item.canonicalUrl);
                          return (
                            <tr key={`${item.canonicalUrl}-${item.kind}`}>
                              <td>
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="table-link"
                                  >
                                    {item.canonicalUrl}
                                  </a>
                                ) : (
                                  item.canonicalUrl
                                )}
                              </td>
                              <td>
                                <StatusBadge
                                  status={item.impact}
                                  label={item.kind.replaceAll("_", " ")}
                                />
                              </td>
                              <td>{snapshotLabel(item.before)}</td>
                              <td>{snapshotLabel(item.after)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="comparison-zero-state">
                    No page-level changes were captured for this pair.
                  </p>
                )}
              </section>

              <section aria-labelledby="link-changes-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="link-changes-heading">Internal-link changes</h3>
                    <p>
                      Exact source-to-target edges from immutable crawl graphs.
                      Broken-link creation and recovery are classified;
                      editorial structure stays neutral.
                    </p>
                  </div>
                  <StatusBadge
                    status={comparison.linkGraph.state}
                    label={comparison.linkGraph.version}
                  />
                </div>

                <dl className="comparison-summary-grid comparison-link-summary">
                  <div>
                    <dt>Graph coverage</dt>
                    <dd>
                      {formatNumber(
                        comparison.linkGraph.baseline.graphPageCount,
                      )}
                      /{formatNumber(comparison.linkGraph.baseline.pageCount)} →{" "}
                      {formatNumber(
                        comparison.linkGraph.current.graphPageCount,
                      )}
                      /{formatNumber(comparison.linkGraph.current.pageCount)}
                    </dd>
                  </div>
                  <div>
                    <dt>Edges captured</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.baseline.edgeCount)} →{" "}
                      {formatNumber(comparison.linkGraph.current.edgeCount)}
                    </dd>
                  </div>
                  <div>
                    <dt>Added / removed</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.summary.addedEdges)} /{" "}
                      {formatNumber(comparison.linkGraph.summary.removedEdges)}
                    </dd>
                  </div>
                  <div>
                    <dt>Modified</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.summary.changedEdges)}
                    </dd>
                  </div>
                  <div>
                    <dt>Regressions / recoveries</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.summary.regressions)} /{" "}
                      {formatNumber(comparison.linkGraph.summary.improvements)}
                    </dd>
                  </div>
                </dl>

                {comparison.linkGraph.warnings.length > 0 ? (
                  <InlineNotice tone="warning" title="Link comparison notes">
                    <ul className="comparison-warning-list">
                      {comparison.linkGraph.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </InlineNotice>
                ) : null}

                {comparison.linkGraph.changes.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        Internal-link changes between audit snapshots
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Source</th>
                          <th scope="col">Target</th>
                          <th scope="col">Change</th>
                          <th scope="col">Before → after</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.linkGraph.changes
                          .slice(0, 20)
                          .map((item) => {
                            const sourceHref = safeExternalUrl(item.sourceUrl);
                            const targetHref = safeExternalUrl(item.targetUrl);
                            return (
                              <tr
                                key={`${item.sourceUrl}-${item.targetUrl}-${item.change}`}
                              >
                                <td>
                                  {sourceHref ? (
                                    <a
                                      href={sourceHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="table-link"
                                    >
                                      {item.sourceUrl}
                                    </a>
                                  ) : (
                                    item.sourceUrl
                                  )}
                                </td>
                                <td>
                                  {targetHref ? (
                                    <a
                                      href={targetHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="table-link"
                                    >
                                      {item.targetUrl}
                                    </a>
                                  ) : (
                                    item.targetUrl
                                  )}
                                </td>
                                <td>
                                  <StatusBadge
                                    status={item.impact}
                                    label={item.change}
                                  />
                                  <small>
                                    {item.reasons
                                      .map(linkReasonLabel)
                                      .join(", ")}
                                  </small>
                                </td>
                                <td>
                                  {linkSnapshotLabel(item.before)} →{" "}
                                  {linkSnapshotLabel(item.after)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="comparison-zero-state">
                    {comparison.linkGraph.state === "unavailable"
                      ? "Replay both audits to capture comparable internal-link evidence."
                      : "No internal-link edge changes were captured for this pair."}
                  </p>
                )}
              </section>

              {comparison.truncated.issueRegressions ||
              comparison.truncated.issueImprovements ||
              comparison.truncated.pageChanges ||
              comparison.linkGraph.truncated ? (
                <p className="comparison-truncation">
                  The API response reached a safety limit. Export the run data
                  or use the SDK for the full stored corpus.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
