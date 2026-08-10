import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type {
  AuditRun,
  RunComparisonLinkSnapshot,
  RunComparisonPageSnapshot,
} from "../api/contracts";
import { useRunComparison } from "../api/queries";
import { fmt, useI18n, type Messages } from "../i18n";
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

function signed(value: number | null, messages: Messages): string {
  if (value === null) return messages.common.unavailable;
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function snapshotLabel(
  snapshot: RunComparisonPageSnapshot | null,
  messages: Messages,
): string {
  const labels = messages.auditComparison;
  if (!snapshot) return labels.notInSnapshot;
  const indexability =
    snapshot.indexable === null
      ? labels.indexabilityUnknown
      : snapshot.indexable
        ? labels.indexable
        : labels.notIndexable;
  return `${snapshot.statusCode ?? labels.statusUnavailable} · ${indexability}`;
}

function linkSnapshotLabel(
  snapshot: RunComparisonLinkSnapshot | null,
  messages: Messages,
): string {
  const labels = messages.auditComparison;
  if (!snapshot) return labels.notPresent;
  const status = snapshot.targetStatusCode ?? labels.statusUnavailable;
  const occurrences = fmt(
    snapshot.occurrences === 1 ? labels.occurrenceOne : labels.occurrenceOther,
    { count: formatNumber(snapshot.occurrences) },
  );
  return `${snapshot.targetState} · ${status} · ${occurrences}`;
}

function linkReasonLabel(reason: string): string {
  return reason.replaceAll("_", " ");
}

export function AuditComparisonCard({ runs }: { runs: AuditRun[] }) {
  const { t } = useI18n();
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
          <p className="eyebrow">{t.auditComparison.eyebrow}</p>
          <h2>{t.auditComparison.title}</h2>
          <p>{t.auditComparison.description}</p>
        </div>
        {comparison ? (
          <StatusBadge
            status={comparison.state}
            label={
              comparison.state === "available"
                ? t.auditComparison.state.comparable
                : comparison.state === "partial"
                  ? t.auditComparison.state.partial
                  : t.auditComparison.state.unavailable
            }
          />
        ) : null}
      </header>

      {currentOptions.length === 0 ? (
        <div className="comparison-empty">
          <strong>{t.auditComparison.emptyTitle}</strong>
          <p>{t.auditComparison.emptyBody}</p>
        </div>
      ) : (
        <>
          <div className="comparison-selectors">
            <label htmlFor="comparison-baseline">
              {t.auditComparison.baselineAudit}
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
              {t.auditComparison.currentAudit}
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
                {t.auditComparison.openBaselineEvidence}
              </Link>
            ) : null}
            {currentRun ? (
              <Link
                to="/audits/$runId"
                params={{ runId: currentRun.id }}
                className="text-link"
              >
                {t.auditComparison.openCurrentEvidence}
              </Link>
            ) : null}
          </div>

          {comparisonQuery.isLoading ? (
            <p className="comparison-loading" role="status">
              {t.auditComparison.loading}
            </p>
          ) : null}
          {comparisonQuery.isError ? (
            <InlineNotice tone="danger" title={t.auditComparison.errorTitle}>
              {comparisonQuery.error.message}
            </InlineNotice>
          ) : null}

          {comparison ? (
            <div className="comparison-results">
              <div className="comparison-score-row">
                <div>
                  <span>{t.auditComparison.regressionPressure}</span>
                  <strong
                    className={
                      comparison.summary.regressionScore > 0
                        ? "comparison-negative"
                        : comparison.summary.regressionScore < 0
                          ? "comparison-positive"
                          : ""
                    }
                  >
                    {signed(comparison.summary.regressionScore, t)}
                  </strong>
                  <small>{comparison.scoreVersion}</small>
                </div>
                <p>{t.auditComparison.scoreExplainer}</p>
              </div>

              <dl className="comparison-summary-grid">
                <div>
                  <dt>{t.auditComparison.summary.newWorse}</dt>
                  <dd>
                    {formatNumber(
                      comparison.summary.newIssues +
                        comparison.summary.severityIncreases,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.auditComparison.summary.resolvedReduced}</dt>
                  <dd>
                    {formatNumber(
                      comparison.summary.resolvedIssues +
                        comparison.summary.severityDecreases,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.auditComparison.summary.healthChange}</dt>
                  <dd>{signed(comparison.summary.healthDelta, t)}</dd>
                </div>
                <div>
                  <dt>{t.auditComparison.summary.pageRegressions}</dt>
                  <dd>
                    {formatNumber(
                      comparison.pageChanges.filter(
                        (change) => change.impact === "regression",
                      ).length,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.auditComparison.summary.pagesCaptured}</dt>
                  <dd>
                    {formatNumber(comparison.summary.baselinePages)} →{" "}
                    {formatNumber(comparison.summary.currentPages)}
                  </dd>
                </div>
                <div>
                  <dt>{t.auditComparison.summary.reviewedExcluded}</dt>
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
                  <span>{t.auditComparison.configuration}</span>
                  <StatusBadge status={comparison.configuration.state} />
                </div>
                <p>
                  {comparison.configuration.state === "matched"
                    ? t.auditComparison.configMatched
                    : comparison.configuration.state === "different"
                      ? fmt(t.auditComparison.configDifferent, {
                          differences:
                            comparison.configuration.differences.join(", "),
                        })
                      : t.auditComparison.configUnavailable}
                </p>
                {comparison.configuration.baselineHash &&
                comparison.configuration.currentHash ? (
                  <small>
                    {fmt(t.auditComparison.configFingerprints, {
                      baseline: comparison.configuration.baselineHash.slice(
                        0,
                        12,
                      ),
                      current: comparison.configuration.currentHash.slice(
                        0,
                        12,
                      ),
                    })}
                  </small>
                ) : null}
              </div>

              {comparison.warnings.length > 0 ? (
                <InlineNotice
                  tone="warning"
                  title={t.auditComparison.warningsTitle}
                >
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
                    <h3 id="issue-regressions-heading">
                      {t.auditComparison.regressions.title}
                    </h3>
                    <p>{t.auditComparison.regressions.description}</p>
                  </div>
                  <span>
                    {formatNumber(comparison.issueRegressions.length)}
                  </span>
                </div>
                {comparison.issueRegressions.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        {t.auditComparison.regressions.caption}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            {t.auditComparison.columns.finding}
                          </th>
                          <th scope="col">
                            {t.auditComparison.columns.change}
                          </th>
                          <th scope="col">{t.auditComparison.columns.url}</th>
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
                                    t.auditComparison.siteWide
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
                    {t.auditComparison.regressions.empty}
                  </p>
                )}
              </section>

              <section aria-labelledby="issue-improvements-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="issue-improvements-heading">
                      {t.auditComparison.fixes.title}
                    </h3>
                    <p>{t.auditComparison.fixes.description}</p>
                  </div>
                  <span>
                    {formatNumber(comparison.issueImprovements.length)}
                  </span>
                </div>
                {comparison.issueImprovements.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        {t.auditComparison.fixes.caption}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            {t.auditComparison.columns.finding}
                          </th>
                          <th scope="col">
                            {t.auditComparison.columns.change}
                          </th>
                          <th scope="col">{t.auditComparison.columns.url}</th>
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
                                    t.auditComparison.siteWide
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
                    {t.auditComparison.fixes.empty}
                  </p>
                )}
              </section>

              <section aria-labelledby="page-changes-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="page-changes-heading">
                      {t.auditComparison.pages.title}
                    </h3>
                    <p>{t.auditComparison.pages.description}</p>
                  </div>
                  <span>{formatNumber(comparison.pageChanges.length)}</span>
                </div>
                {comparison.pageChanges.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <caption className="sr-only">
                        {t.auditComparison.pages.caption}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">{t.auditComparison.columns.url}</th>
                          <th scope="col">
                            {t.auditComparison.columns.change}
                          </th>
                          <th scope="col">
                            {t.auditComparison.columns.before}
                          </th>
                          <th scope="col">{t.auditComparison.columns.after}</th>
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
                              <td>{snapshotLabel(item.before, t)}</td>
                              <td>{snapshotLabel(item.after, t)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="comparison-zero-state">
                    {t.auditComparison.pages.empty}
                  </p>
                )}
              </section>

              <section aria-labelledby="link-changes-heading">
                <div className="comparison-section-heading">
                  <div>
                    <h3 id="link-changes-heading">
                      {t.auditComparison.links.title}
                    </h3>
                    <p>{t.auditComparison.links.description}</p>
                  </div>
                  <StatusBadge
                    status={comparison.linkGraph.state}
                    label={comparison.linkGraph.version}
                  />
                </div>

                <dl className="comparison-summary-grid comparison-link-summary">
                  <div>
                    <dt>{t.auditComparison.links.graphCoverage}</dt>
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
                    <dt>{t.auditComparison.links.edgesCaptured}</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.baseline.edgeCount)} →{" "}
                      {formatNumber(comparison.linkGraph.current.edgeCount)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.auditComparison.links.addedRemoved}</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.summary.addedEdges)} /{" "}
                      {formatNumber(comparison.linkGraph.summary.removedEdges)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.auditComparison.links.modified}</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.summary.changedEdges)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.auditComparison.links.regressionsRecoveries}</dt>
                    <dd>
                      {formatNumber(comparison.linkGraph.summary.regressions)} /{" "}
                      {formatNumber(comparison.linkGraph.summary.improvements)}
                    </dd>
                  </div>
                </dl>

                {comparison.linkGraph.warnings.length > 0 ? (
                  <InlineNotice
                    tone="warning"
                    title={t.auditComparison.links.warningsTitle}
                  >
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
                        {t.auditComparison.links.caption}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            {t.auditComparison.columns.source}
                          </th>
                          <th scope="col">
                            {t.auditComparison.columns.target}
                          </th>
                          <th scope="col">
                            {t.auditComparison.columns.change}
                          </th>
                          <th scope="col">
                            {t.auditComparison.columns.beforeAfter}
                          </th>
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
                                  {linkSnapshotLabel(item.before, t)} →{" "}
                                  {linkSnapshotLabel(item.after, t)}
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
                      ? t.auditComparison.links.emptyUnavailable
                      : t.auditComparison.links.empty}
                  </p>
                )}
              </section>

              {comparison.truncated.issueRegressions ||
              comparison.truncated.issueImprovements ||
              comparison.truncated.pageChanges ||
              comparison.linkGraph.truncated ? (
                <p className="comparison-truncation">
                  {t.auditComparison.truncationNotice}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
