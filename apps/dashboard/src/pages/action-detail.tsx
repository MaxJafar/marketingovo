import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import type {
  ActionEvidenceUrl,
  ActionIssueEvidence,
  ActionLifecycle,
  ActionScoreInputs,
  ActionStatus,
  SeoAction,
  SourceState,
  VerificationRunState,
} from "../api/contracts";
import {
  useActionEvidence,
  useCreateActionCheckpoint,
  useUpdateAction,
  useVerifyAction,
} from "../api/queries";
import { fmt, useI18n, type Messages } from "../i18n";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Icon } from "../components/icon";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";
import { useSite } from "../context/site-context";

type LifecycleFilter = "all" | ActionLifecycle;

const actionStatuses: readonly ActionStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
];

const lifecycleStates: readonly ActionLifecycle[] = [
  "new",
  "persistent",
  "resolved",
  "reappeared",
];

const scoreTerms: ReadonlyArray<{
  key: keyof Pick<
    ActionScoreInputs,
    | "severity"
    | "organicExposure"
    | "conversionExposure"
    | "urlReach"
    | "confidence"
  >;
  unavailableKey?: string;
  weight: number;
}> = [
  { key: "severity", weight: 0.35 },
  {
    key: "organicExposure",
    unavailableKey: "organic_exposure",
    weight: 0.25,
  },
  {
    key: "conversionExposure",
    unavailableKey: "conversion_exposure",
    weight: 0.15,
  },
  { key: "urlReach", weight: 0.15 },
  { key: "confidence", weight: 0.1 },
];

function displayLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function evidenceValue(value: unknown, t: Messages): string {
  if (value === null || value === undefined) return t.common.unavailable;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return t.actionDetail.structuredEvidence;
  }
}

function periodLabel(
  start: string | null | undefined,
  end: string | null | undefined,
  t: Messages,
): string {
  if (!start && !end) return t.actionDetail.periodUnavailable;
  return fmt(t.actionDetail.periodRange, {
    start: formatDate(start),
    end: formatDate(end),
  });
}

function effortMultiplier(effort: SeoAction["effort"]): number {
  if (effort === "high" || effort === "large") return 0.5;
  if (effort === "medium") return 0.75;
  return 1;
}

function reproducePriority(
  scoreInputs: ActionScoreInputs,
  effort: SeoAction["effort"],
): number {
  const base = scoreTerms.reduce((total, term) => {
    const value = scoreInputs[term.key];
    return total + term.weight * (value === null ? 0.5 : value);
  }, 0);
  return Math.round(base * effortMultiplier(effort) * 1_000) / 10;
}

function ScoreExplanation({ action }: { action: SeoAction }) {
  const { t } = useI18n();
  const inputs = action.scoreInputs;
  if (!inputs) {
    return (
      <InlineNotice
        tone="warning"
        title={t.actionDetail.scoreInputsUnavailableTitle}
      >
        {t.actionDetail.scoreInputsUnavailableBody}
      </InlineNotice>
    );
  }
  const unavailable = new Set(inputs.unavailable);
  const multiplier = effortMultiplier(action.effort);
  const reproduced = reproducePriority(inputs, action.effort);

  return (
    <Card className="score-explanation-card">
      <SectionHeading
        title={t.actionDetail.scoreTitle}
        description={t.actionDetail.scoreDescription}
        action={
          <StatusBadge
            status="info"
            label={action.scoreVersion ?? t.actionDetail.unknownModel}
          />
        }
      />
      <div className="score-formula" aria-label={t.actionDetail.formulaLabel}>
        <code>{t.actionDetail.formula}</code>
      </div>
      <div className="score-input-grid">
        {scoreTerms.map((term) => {
          const raw = inputs[term.key];
          const missing =
            raw === null ||
            (term.unavailableKey
              ? unavailable.has(term.unavailableKey)
              : false);
          const scoredValue = raw === null ? 0.5 : raw;
          return (
            <div
              key={term.key}
              className={missing ? "score-input-missing" : ""}
            >
              <span>{t.actionDetail.scoreTermLabel[term.key]}</span>
              <strong>
                {missing
                  ? t.common.unavailable
                  : formatNumber(raw, { maximumFractionDigits: 2 })}
              </strong>
              <small>
                {fmt(t.actionDetail.weightContribution, {
                  weight: formatNumber(term.weight * 100),
                  contribution: formatNumber(scoredValue * term.weight, {
                    maximumFractionDigits: 3,
                  }),
                })}
              </small>
              {missing ? (
                <small>{t.actionDetail.neutralSubstitute}</small>
              ) : null}
            </div>
          );
        })}
        <div>
          <span>{t.actionDetail.effortMultiplier}</span>
          <strong>
            {formatNumber(multiplier, { maximumFractionDigits: 2 })}
          </strong>
          <small>{action.effort ?? t.actionDetail.effortUnavailable}</small>
        </div>
      </div>
      <div className="score-reproduction">
        <div>
          <span>{t.actionDetail.storedScore}</span>
          <strong>{formatNumber(action.priorityScore)}</strong>
        </div>
        <div>
          <span>{t.actionDetail.reproducedScore}</span>
          <strong>{formatNumber(reproduced)}</strong>
        </div>
      </div>
    </Card>
  );
}

function EvidenceList({ evidence }: { evidence: ActionIssueEvidence[] }) {
  const { t } = useI18n();
  if (evidence.length === 0)
    return <p className="muted">{t.actionDetail.noEvidenceValues}</p>;
  return (
    <ul className="issue-evidence-list">
      {evidence.map((item, index) => (
        <li key={`${item.kind ?? item.label}-${index}`}>
          <div>
            <strong>{item.label}</strong>
            {item.source ? (
              <StatusBadge status="info" label={item.source} />
            ) : null}
          </div>
          <code>{evidenceValue(item.value, t)}</code>
          {item.observedAt ? (
            <small>
              {fmt(t.actionDetail.observedAt, {
                date: formatDate(item.observedAt, true),
              })}
            </small>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SourceStateList({ sources }: { sources: SourceState[] }) {
  const { t } = useI18n();
  if (sources.length === 0)
    return (
      <InlineNotice
        tone="warning"
        title={t.actionDetail.sourceStateUnavailableTitle}
      >
        {t.actionDetail.sourceStateUnavailableBody}
      </InlineNotice>
    );
  return (
    <ul className="workbench-source-list">
      {sources.map((source) => (
        <li key={source.id}>
          <div>
            <strong>{source.name}</strong>
            <small>
              {source.message ??
                fmt(t.actionDetail.sourceUpdated, {
                  date: formatDate(source.updatedAt, true),
                })}
            </small>
          </div>
          <div>
            <StatusBadge status={source.status} />
            {source.availability ? (
              <StatusBadge status={source.availability} />
            ) : null}
            <small>
              {source.coverage === null || source.coverage === undefined
                ? t.actionDetail.coverageUnavailable
                : fmt(t.actionDetail.coveragePercent, {
                    coverage: formatNumber(source.coverage),
                  })}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

function UrlEvidenceCard({ item }: { item: ActionEvidenceUrl }) {
  const { t } = useI18n();
  const externalUrl = safeExternalUrl(item.url);
  return (
    <article className="evidence-url-card">
      <header>
        <div className="evidence-url-title">
          <div>
            <StatusBadge status={item.lifecycle} />
            {item.issue ? <StatusBadge status={item.issue.severity} /> : null}
          </div>
          <h3>
            {externalUrl ? (
              <a href={externalUrl} target="_blank" rel="noreferrer">
                {item.title ?? item.url} <Icon name="external" />
              </a>
            ) : (
              (item.title ?? item.url)
            )}
          </h3>
          <small>{item.url}</small>
        </div>
        <div className="technical-badges">
          <StatusBadge
            status={
              item.indexable === true
                ? "indexable"
                : item.indexable === false
                  ? "noindex"
                  : "unknown"
            }
            label={
              item.indexable === true
                ? t.actionDetail.indexable
                : item.indexable === false
                  ? t.actionDetail.notIndexable
                  : t.actionDetail.indexabilityUnavailable
            }
          />
          <span className="http-status">
            {fmt(t.actionDetail.httpStatus, {
              code: formatNumber(item.statusCode, {
                maximumFractionDigits: 0,
              }),
            })}
          </span>
        </div>
      </header>

      <div className="evidence-outcome-grid">
        <section aria-label={t.actionDetail.technicalEvidence}>
          <span className="outcome-kicker">
            {t.actionDetail.technicalEvidence}
          </span>
          {item.issue ? (
            <>
              <strong>{item.issue.title}</strong>
              <p>{item.issue.description}</p>
              <small>
                {fmt(t.actionDetail.firstLastSeen, {
                  firstSeen: formatDate(item.issue.firstSeenAt, true),
                  lastSeen: formatDate(item.issue.lastSeenAt, true),
                })}
              </small>
            </>
          ) : (
            <p>{t.actionDetail.noActiveIssue}</p>
          )}
          <dl className="compact-metrics">
            <div>
              <dt>{t.actionDetail.metric.lcp}</dt>
              <dd>
                {item.cwv?.lcp === null || item.cwv?.lcp === undefined
                  ? t.common.unavailable
                  : `${formatNumber(item.cwv.lcp)} ms`}
              </dd>
            </div>
            <div>
              <dt>{t.actionDetail.metric.cls}</dt>
              <dd>{formatNumber(item.cwv?.cls)}</dd>
            </div>
            <div>
              <dt>{t.actionDetail.metric.ttfb}</dt>
              <dd>
                {item.cwv?.ttfb === null || item.cwv?.ttfb === undefined
                  ? t.common.unavailable
                  : `${formatNumber(item.cwv.ttfb)} ms`}
              </dd>
            </div>
          </dl>
          <StatusBadge status={item.cwv?.state ?? "unavailable"} />
        </section>

        <section aria-label={t.actionDetail.searchExposure}>
          <span className="outcome-kicker">
            {t.actionDetail.searchExposure}
          </span>
          <p className="outcome-context">{t.actionDetail.searchExposureNote}</p>
          <dl className="compact-metrics">
            <div>
              <dt>{t.actionDetail.metric.clicks}</dt>
              <dd>{formatNumber(item.gsc?.clicks)}</dd>
            </div>
            <div>
              <dt>{t.actionDetail.metric.impressions}</dt>
              <dd>{formatNumber(item.gsc?.impressions)}</dd>
            </div>
            <div>
              <dt>{t.actionDetail.metric.ctr}</dt>
              <dd>
                {item.gsc?.ctr === null || item.gsc?.ctr === undefined
                  ? t.common.unavailable
                  : `${formatNumber(item.gsc.ctr * 100)}%`}
              </dd>
            </div>
            <div>
              <dt>{t.actionDetail.metric.position}</dt>
              <dd>{formatNumber(item.gsc?.position)}</dd>
            </div>
          </dl>
          <small>
            {periodLabel(item.gsc?.periodStart, item.gsc?.periodEnd, t)}
          </small>
          <StatusBadge status={item.gsc?.state ?? "unavailable"} />
        </section>

        <section aria-label={t.actionDetail.organicOutcomes}>
          <span className="outcome-kicker">
            {t.actionDetail.organicOutcomes}
          </span>
          <p className="outcome-context">
            {t.actionDetail.organicOutcomesNote}
          </p>
          <dl className="compact-metrics">
            <div>
              <dt>{t.actionDetail.metric.sessions}</dt>
              <dd>{formatNumber(item.ga4?.sessions)}</dd>
            </div>
            <div>
              <dt>{t.actionDetail.metric.keyEvents}</dt>
              <dd>{formatNumber(item.ga4?.keyEvents)}</dd>
            </div>
          </dl>
          <small>
            {periodLabel(item.ga4?.periodStart, item.ga4?.periodEnd, t)}
          </small>
          <StatusBadge status={item.ga4?.state ?? "unavailable"} />
        </section>
      </div>

      <details className="raw-evidence-details">
        <summary>
          {fmt(t.actionDetail.inspectRawEvidence, {
            count: formatNumber(item.issue?.evidence.length ?? 0),
          })}
        </summary>
        {item.issue ? <EvidenceList evidence={item.issue.evidence} /> : null}
      </details>
    </article>
  );
}

function verificationTone(
  state: VerificationRunState,
): "info" | "warning" | "danger" | "success" {
  if (state === "verified") return "success";
  if (state === "regressed") return "danger";
  if (state === "inconclusive") return "warning";
  return "info";
}

export function ActionDetailPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const params = useParams({ strict: false }) as { actionId?: string };
  const actionId = params.actionId ?? "";
  const query = useActionEvidence(actionId);
  const checkpoint = useCreateActionCheckpoint(actionId);
  const verify = useVerifyAction(actionId);
  const updateAction = useUpdateAction(siteId);
  const [urlSearch, setUrlSearch] = useState("");
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("all");
  const firstPage = query.data?.pages[0];
  const detail = firstPage?.data;

  const loadedUrls = useMemo(() => {
    const unique = new Map<string, ActionEvidenceUrl>();
    for (const page of query.data?.pages ?? []) {
      for (const item of page.data.urls) unique.set(item.url, item);
    }
    return [...unique.values()];
  }, [query.data?.pages]);

  const visibleUrls = useMemo(() => {
    const term = urlSearch.trim().toLowerCase();
    return loadedUrls.filter(
      (item) =>
        (lifecycle === "all" || item.lifecycle === lifecycle) &&
        (!term ||
          item.url.toLowerCase().includes(term) ||
          item.title?.toLowerCase().includes(term) ||
          item.issue?.title.toLowerCase().includes(term)),
    );
  }, [lifecycle, loadedUrls, urlSearch]);

  const checkpointId =
    checkpoint.data?.data.id ?? detail?.verification.checkpointId ?? null;
  const verificationState =
    verify.isSuccess && detail?.verification.state === "not_started"
      ? "queued"
      : (detail?.verification.state ?? "not_started");
  const verificationBusy =
    verificationState === "queued" || verificationState === "running";
  const verificationStateLabel =
    t.actionDetail.verificationStateLabel[verificationState] ??
    displayLabel(verificationState);

  return (
    <div className="page-stack action-detail-page">
      <Link to="/actions" className="back-link">
        <Icon name="arrow" /> {t.actionDetail.backToActions}
      </Link>
      <PageHeader
        eyebrow={t.actionDetail.eyebrow}
        title={detail?.action.title ?? t.actionDetail.fallbackTitle}
        description={t.actionDetail.description}
        actions={
          detail ? (
            <label className="detail-status-control">
              {t.actionDetail.workflowStatus}
              <select
                value={detail.action.status ?? "open"}
                disabled={updateAction.isPending}
                onChange={(event) =>
                  updateAction.mutate({
                    actionId,
                    status: event.currentTarget.value as ActionStatus,
                  })
                }
              >
                {actionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t.actionDetail.statusLabel[status]}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {detail ? (
          <>
            <FreshnessNotice meta={firstPage?.meta} />
            {updateAction.isError ? (
              <InlineNotice
                tone="danger"
                title={t.actionDetail.workflowNotSavedTitle}
              >
                {updateAction.error.message}
              </InlineNotice>
            ) : null}

            <section
              className="action-outcome-grid"
              aria-label={t.actionDetail.summaryLabel}
            >
              <Card className="action-outcome-card technical-outcome-card">
                <span className="outcome-kicker">
                  {t.actionDetail.technicalEvidence}
                </span>
                <strong>{formatNumber(detail.summary.totalUrls)}</strong>
                <h2>{t.actionDetail.affectedUrls}</h2>
                <p>
                  {fmt(t.actionDetail.issueOccurrences, {
                    count: formatNumber(detail.summary.issueOccurrences),
                  })}
                </p>
                <dl className="lifecycle-summary">
                  <div>
                    <dt>{t.actionDetail.lifecycleSummary.new}</dt>
                    <dd>{formatNumber(detail.summary.newOccurrences)}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.lifecycleSummary.persistent}</dt>
                    <dd>
                      {formatNumber(detail.summary.persistentOccurrences)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.lifecycleSummary.resolved}</dt>
                    <dd>{formatNumber(detail.summary.resolvedOccurrences)}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.lifecycleSummary.reappeared}</dt>
                    <dd>
                      {formatNumber(detail.summary.reappearedOccurrences)}
                    </dd>
                  </div>
                </dl>
              </Card>
              <Card className="action-outcome-card business-outcome-card">
                <span className="outcome-kicker">
                  {t.actionDetail.businessContext}
                </span>
                <div className="business-summary-grid">
                  <div>
                    <strong>{formatNumber(detail.summary.clicks)}</strong>
                    <span>{t.actionDetail.businessSummary.observedClicks}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(detail.summary.impressions)}</strong>
                    <span>{t.actionDetail.businessSummary.impressions}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(detail.summary.keyEvents)}</strong>
                    <span>
                      {t.actionDetail.businessSummary.organicKeyEvents}
                    </span>
                  </div>
                </div>
                <p>{t.actionDetail.exposureNote}</p>
              </Card>
            </section>

            <section className="action-context-grid">
              <Card className="action-rationale-card">
                <span className="outcome-kicker">{t.actionDetail.whyNow}</span>
                <h2>{detail.action.ruleId}</h2>
                <p>{detail.action.whyNow ?? detail.action.summary}</p>
                <dl>
                  <div>
                    <dt>{t.actionDetail.module}</dt>
                    <dd>{detail.action.moduleId}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.impact}</dt>
                    <dd>{detail.action.impact ?? t.common.unavailable}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.effort}</dt>
                    <dd>{detail.action.effort ?? t.common.unavailable}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.confidence}</dt>
                    <dd>
                      {detail.action.confidence === null ||
                      detail.action.confidence === undefined
                        ? t.common.unavailable
                        : `${formatNumber(detail.action.confidence * 100)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.created}</dt>
                    <dd>{formatDate(detail.action.createdAt, true)}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.updated}</dt>
                    <dd>{formatDate(detail.action.updatedAt, true)}</dd>
                  </div>
                </dl>
              </Card>
              <Card className="verification-card">
                <div className="verification-heading">
                  <div>
                    <span className="outcome-kicker">
                      {t.actionDetail.proofLoop}
                    </span>
                    <h2>{t.actionDetail.proofLoopTitle}</h2>
                  </div>
                  <StatusBadge status={verificationState} />
                </div>
                <InlineNotice
                  tone={verificationTone(verificationState)}
                  title={fmt(t.actionDetail.verificationTitle, {
                    state: verificationStateLabel,
                  })}
                >
                  {detail.verification.reason ??
                    t.actionDetail.verificationFallback}
                </InlineNotice>
                <dl className="verification-metadata">
                  <div>
                    <dt>{t.actionDetail.checkpoint}</dt>
                    <dd>{checkpointId ?? t.actionDetail.notCreated}</dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.verificationRun}</dt>
                    <dd>
                      {verify.data?.data.runId ??
                        detail.verification.runId ??
                        t.actionDetail.notStarted}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.coverage}</dt>
                    <dd>
                      {detail.verification.coverage === null
                        ? t.common.unavailable
                        : `${formatNumber(detail.verification.coverage * 100)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.actionDetail.checked}</dt>
                    <dd>{formatDate(detail.verification.checkedAt, true)}</dd>
                  </div>
                </dl>
                {checkpoint.isError ? (
                  <InlineNotice
                    tone="danger"
                    title={t.actionDetail.checkpointNotCreatedTitle}
                  >
                    {checkpoint.error.message}
                  </InlineNotice>
                ) : null}
                {verify.isError ? (
                  <InlineNotice
                    tone="danger"
                    title={t.actionDetail.verificationNotStartedTitle}
                  >
                    {verify.error.message}
                  </InlineNotice>
                ) : null}
                <div className="verification-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={checkpoint.isPending || verificationBusy}
                    onClick={() => checkpoint.mutate()}
                  >
                    {checkpoint.isPending
                      ? t.actionDetail.creatingCheckpoint
                      : checkpointId
                        ? t.actionDetail.replaceCheckpoint
                        : t.actionDetail.createCheckpoint}
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      !checkpointId || verify.isPending || verificationBusy
                    }
                    onClick={() => checkpointId && verify.mutate(checkpointId)}
                  >
                    <Icon name="refresh" />{" "}
                    {verify.isPending || verificationBusy
                      ? t.actionDetail.verificationRunning
                      : t.actionDetail.verifyCurrentFix}
                  </Button>
                </div>
                {!checkpointId ? (
                  <p className="verification-help">
                    {t.actionDetail.checkpointHelp}
                  </p>
                ) : null}
              </Card>
            </section>

            <ScoreExplanation action={detail.action} />

            <section className="two-column-grid">
              <Card>
                <SectionHeading
                  title={t.actionDetail.sourceHealthTitle}
                  description={t.actionDetail.sourceHealthDescription}
                />
                <SourceStateList sources={detail.sources} />
              </Card>
              <Card>
                <SectionHeading
                  title={t.actionDetail.historyTitle}
                  description={t.actionDetail.historyDescription}
                />
                {detail.history.length > 0 ? (
                  <ol className="action-history-list">
                    {detail.history.map((entry) => (
                      <li key={entry.runId}>
                        <div>
                          <StatusBadge status={entry.status} />
                          <strong>
                            {fmt(t.actionDetail.historyUrls, {
                              count: formatNumber(entry.affectedCount),
                            })}
                          </strong>
                        </div>
                        <span>{formatDate(entry.observedAt, true)}</span>
                        <Link
                          to="/audits/$runId"
                          params={{ runId: entry.runId }}
                          className="text-link"
                        >
                          {t.actionDetail.openRun}
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    title={t.actionDetail.noHistoryTitle}
                    description={t.actionDetail.noHistoryDescription}
                  />
                )}
              </Card>
            </section>

            <section aria-labelledby="affected-url-title">
              <SectionHeading
                id="affected-url-title"
                title={t.actionDetail.affectedUrlEvidenceTitle}
                description={t.actionDetail.affectedUrlEvidenceDescription}
              />
              <div className="url-evidence-controls">
                <label className="workbench-search">
                  <span>{t.actionDetail.searchLoadedUrls}</span>
                  <span className="search-field">
                    <Icon name="search" />
                    <input
                      type="search"
                      value={urlSearch}
                      onChange={(event) =>
                        setUrlSearch(event.currentTarget.value)
                      }
                      placeholder={t.actionDetail.urlSearchPlaceholder}
                    />
                  </span>
                </label>
                <label>
                  {t.actionDetail.lifecycle}
                  <select
                    value={lifecycle}
                    onChange={(event) =>
                      setLifecycle(event.currentTarget.value as LifecycleFilter)
                    }
                  >
                    <option value="all">
                      {t.actionDetail.allLifecycleStates}
                    </option>
                    {lifecycleStates.map((state) => (
                      <option key={state} value={state}>
                        {t.actionDetail.lifecycleLabel[state]}
                      </option>
                    ))}
                  </select>
                </label>
                <p role="status" aria-live="polite">
                  {fmt(t.actionDetail.matchingCount, {
                    matching: formatNumber(visibleUrls.length),
                    loaded: formatNumber(loadedUrls.length),
                    total: formatNumber(detail.pageInfo.total),
                  })}
                </p>
              </div>
              {visibleUrls.length > 0 ? (
                <div className="evidence-url-list">
                  {visibleUrls.map((item) => (
                    <UrlEvidenceCard key={item.url} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t.actionDetail.noLoadedUrlsTitle}
                  description={t.actionDetail.noLoadedUrlsDescription}
                />
              )}
              {query.hasNextPage ? (
                <div className="load-more-evidence">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {query.isFetchingNextPage
                      ? t.actionDetail.loadingEvidence
                      : t.actionDetail.loadMoreUrls}
                  </Button>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
