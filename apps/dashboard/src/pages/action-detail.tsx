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
  label: string;
  weight: number;
}> = [
  { key: "severity", label: "Severity", weight: 0.35 },
  {
    key: "organicExposure",
    unavailableKey: "organic_exposure",
    label: "Organic exposure",
    weight: 0.25,
  },
  {
    key: "conversionExposure",
    unavailableKey: "conversion_exposure",
    label: "Conversion exposure",
    weight: 0.15,
  },
  { key: "urlReach", label: "URL reach", weight: 0.15 },
  { key: "confidence", label: "Confidence", weight: 0.1 },
];

function displayLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function evidenceValue(value: unknown): string {
  if (value === null || value === undefined) return "Unavailable";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Structured evidence";
  }
}

function periodLabel(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "Period unavailable";
  return `${formatDate(start)} – ${formatDate(end)}`;
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
  const inputs = action.scoreInputs;
  if (!inputs) {
    return (
      <InlineNotice tone="warning" title="Score inputs unavailable">
        The API returned a priority score without its reproducible inputs.
      </InlineNotice>
    );
  }
  const unavailable = new Set(inputs.unavailable);
  const multiplier = effortMultiplier(action.effort);
  const reproduced = reproducePriority(inputs, action.effort);

  return (
    <Card className="score-explanation-card">
      <SectionHeading
        title="Why this action is prioritized"
        description="The score is a transparent prioritization heuristic, not a traffic forecast. All normalized inputs are 0–1."
        action={
          <StatusBadge
            status="info"
            label={action.scoreVersion ?? "Unknown model"}
          />
        }
      />
      <div className="score-formula" aria-label="Priority version one formula">
        <code>
          priority = 100 × (0.35×severity + 0.25×organic exposure +
          0.15×conversion exposure + 0.15×URL reach + 0.10×confidence) × effort
          multiplier
        </code>
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
              <span>{term.label}</span>
              <strong>
                {missing
                  ? "Unavailable"
                  : formatNumber(raw, { maximumFractionDigits: 2 })}
              </strong>
              <small>
                Weight {formatNumber(term.weight * 100)}% · contribution{" "}
                {formatNumber(scoredValue * term.weight, {
                  maximumFractionDigits: 3,
                })}
              </small>
              {missing ? (
                <small>Neutral 0.50 substitute; confidence is reduced.</small>
              ) : null}
            </div>
          );
        })}
        <div>
          <span>Effort multiplier</span>
          <strong>
            {formatNumber(multiplier, { maximumFractionDigits: 2 })}
          </strong>
          <small>{action.effort ?? "Effort unavailable"}</small>
        </div>
      </div>
      <div className="score-reproduction">
        <div>
          <span>Stored score</span>
          <strong>{formatNumber(action.priorityScore)}</strong>
        </div>
        <div>
          <span>Reproduced from inputs</span>
          <strong>{formatNumber(reproduced)}</strong>
        </div>
      </div>
    </Card>
  );
}

function EvidenceList({ evidence }: { evidence: ActionIssueEvidence[] }) {
  if (evidence.length === 0)
    return <p className="muted">No evidence values were returned.</p>;
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
          <code>{evidenceValue(item.value)}</code>
          {item.observedAt ? (
            <small>Observed {formatDate(item.observedAt, true)}</small>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SourceStateList({ sources }: { sources: SourceState[] }) {
  if (sources.length === 0)
    return (
      <InlineNotice tone="warning" title="Source state unavailable">
        The API did not identify which sources support this evidence.
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
                `Updated ${formatDate(source.updatedAt, true)}`}
            </small>
          </div>
          <div>
            <StatusBadge status={source.status} />
            {source.availability ? (
              <StatusBadge status={source.availability} />
            ) : null}
            <small>
              {source.coverage === null || source.coverage === undefined
                ? "Coverage unavailable"
                : `${formatNumber(source.coverage)}% coverage`}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

function UrlEvidenceCard({ item }: { item: ActionEvidenceUrl }) {
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
                ? "Indexable"
                : item.indexable === false
                  ? "Not indexable"
                  : "Indexability unavailable"
            }
          />
          <span className="http-status">
            HTTP {formatNumber(item.statusCode, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </header>

      <div className="evidence-outcome-grid">
        <section aria-label="Technical evidence">
          <span className="outcome-kicker">Technical evidence</span>
          {item.issue ? (
            <>
              <strong>{item.issue.title}</strong>
              <p>{item.issue.description}</p>
              <small>
                First seen {formatDate(item.issue.firstSeenAt, true)} · Last
                seen {formatDate(item.issue.lastSeenAt, true)}
              </small>
            </>
          ) : (
            <p>No active issue occurrence is attached to this snapshot.</p>
          )}
          <dl className="compact-metrics">
            <div>
              <dt>LCP</dt>
              <dd>
                {item.cwv?.lcp === null || item.cwv?.lcp === undefined
                  ? "Unavailable"
                  : `${formatNumber(item.cwv.lcp)} ms`}
              </dd>
            </div>
            <div>
              <dt>CLS</dt>
              <dd>{formatNumber(item.cwv?.cls)}</dd>
            </div>
            <div>
              <dt>TTFB</dt>
              <dd>
                {item.cwv?.ttfb === null || item.cwv?.ttfb === undefined
                  ? "Unavailable"
                  : `${formatNumber(item.cwv.ttfb)} ms`}
              </dd>
            </div>
          </dl>
          <StatusBadge status={item.cwv?.state ?? "unavailable"} />
        </section>

        <section aria-label="Search exposure">
          <span className="outcome-kicker">Search exposure</span>
          <p className="outcome-context">
            Observed Search Console demand, not forecasted traffic gain.
          </p>
          <dl className="compact-metrics">
            <div>
              <dt>Clicks</dt>
              <dd>{formatNumber(item.gsc?.clicks)}</dd>
            </div>
            <div>
              <dt>Impressions</dt>
              <dd>{formatNumber(item.gsc?.impressions)}</dd>
            </div>
            <div>
              <dt>CTR</dt>
              <dd>
                {item.gsc?.ctr === null || item.gsc?.ctr === undefined
                  ? "Unavailable"
                  : `${formatNumber(item.gsc.ctr * 100)}%`}
              </dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{formatNumber(item.gsc?.position)}</dd>
            </div>
          </dl>
          <small>
            {periodLabel(item.gsc?.periodStart, item.gsc?.periodEnd)}
          </small>
          <StatusBadge status={item.gsc?.state ?? "unavailable"} />
        </section>

        <section aria-label="Organic outcomes">
          <span className="outcome-kicker">Organic outcomes</span>
          <p className="outcome-context">
            Observed GA4 outcomes; correlation does not guarantee lift.
          </p>
          <dl className="compact-metrics">
            <div>
              <dt>Sessions</dt>
              <dd>{formatNumber(item.ga4?.sessions)}</dd>
            </div>
            <div>
              <dt>Key events</dt>
              <dd>{formatNumber(item.ga4?.keyEvents)}</dd>
            </div>
          </dl>
          <small>
            {periodLabel(item.ga4?.periodStart, item.ga4?.periodEnd)}
          </small>
          <StatusBadge status={item.ga4?.state ?? "unavailable"} />
        </section>
      </div>

      <details className="raw-evidence-details">
        <summary>
          Inspect raw evidence ({formatNumber(item.issue?.evidence.length ?? 0)}
          )
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

  return (
    <div className="page-stack action-detail-page">
      <Link to="/actions" className="back-link">
        <Icon name="arrow" /> Back to actions
      </Link>
      <PageHeader
        eyebrow="Action evidence and verification"
        title={detail?.action.title ?? "Action workbench"}
        description="Trace the recommendation to every observed URL, separate technical evidence from business context, and verify the fix with a durable follow-up run."
        actions={
          detail ? (
            <label className="detail-status-control">
              Workflow status
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
                    {displayLabel(status)}
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
              <InlineNotice tone="danger" title="Workflow status was not saved">
                {updateAction.error.message}
              </InlineNotice>
            ) : null}

            <section
              className="action-outcome-grid"
              aria-label="Action summary"
            >
              <Card className="action-outcome-card technical-outcome-card">
                <span className="outcome-kicker">Technical evidence</span>
                <strong>{formatNumber(detail.summary.totalUrls)}</strong>
                <h2>Affected URLs</h2>
                <p>
                  {formatNumber(detail.summary.issueOccurrences)} issue
                  occurrences across the loaded audit history.
                </p>
                <dl className="lifecycle-summary">
                  <div>
                    <dt>New</dt>
                    <dd>{formatNumber(detail.summary.newOccurrences)}</dd>
                  </div>
                  <div>
                    <dt>Persistent</dt>
                    <dd>
                      {formatNumber(detail.summary.persistentOccurrences)}
                    </dd>
                  </div>
                  <div>
                    <dt>Resolved</dt>
                    <dd>{formatNumber(detail.summary.resolvedOccurrences)}</dd>
                  </div>
                  <div>
                    <dt>Reappeared</dt>
                    <dd>
                      {formatNumber(detail.summary.reappearedOccurrences)}
                    </dd>
                  </div>
                </dl>
              </Card>
              <Card className="action-outcome-card business-outcome-card">
                <span className="outcome-kicker">Business context</span>
                <div className="business-summary-grid">
                  <div>
                    <strong>{formatNumber(detail.summary.clicks)}</strong>
                    <span>observed clicks</span>
                  </div>
                  <div>
                    <strong>{formatNumber(detail.summary.impressions)}</strong>
                    <span>impressions</span>
                  </div>
                  <div>
                    <strong>{formatNumber(detail.summary.keyEvents)}</strong>
                    <span>organic key events</span>
                  </div>
                </div>
                <p>
                  Exposure explains why the action matters. It is observed
                  context—not a promise that resolving the issue will create the
                  same amount of incremental traffic.
                </p>
              </Card>
            </section>

            <section className="action-context-grid">
              <Card className="action-rationale-card">
                <span className="outcome-kicker">Why now</span>
                <h2>{detail.action.ruleId}</h2>
                <p>{detail.action.whyNow ?? detail.action.summary}</p>
                <dl>
                  <div>
                    <dt>Module</dt>
                    <dd>{detail.action.moduleId}</dd>
                  </div>
                  <div>
                    <dt>Impact</dt>
                    <dd>{detail.action.impact ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Effort</dt>
                    <dd>{detail.action.effort ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>
                      {detail.action.confidence === null ||
                      detail.action.confidence === undefined
                        ? "Unavailable"
                        : `${formatNumber(detail.action.confidence * 100)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(detail.action.createdAt, true)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(detail.action.updatedAt, true)}</dd>
                  </div>
                </dl>
              </Card>
              <Card className="verification-card">
                <div className="verification-heading">
                  <div>
                    <span className="outcome-kicker">Proof loop</span>
                    <h2>Fix → checkpoint → verify</h2>
                  </div>
                  <StatusBadge status={verificationState} />
                </div>
                <InlineNotice
                  tone={verificationTone(verificationState)}
                  title={`Verification ${displayLabel(verificationState)}`}
                >
                  {detail.verification.reason ??
                    "Create a checkpoint before implementation, then run a targeted verification after the fix is deployed."}
                </InlineNotice>
                <dl className="verification-metadata">
                  <div>
                    <dt>Checkpoint</dt>
                    <dd>{checkpointId ?? "Not created"}</dd>
                  </div>
                  <div>
                    <dt>Verification run</dt>
                    <dd>
                      {verify.data?.data.runId ??
                        detail.verification.runId ??
                        "Not started"}
                    </dd>
                  </div>
                  <div>
                    <dt>Coverage</dt>
                    <dd>
                      {detail.verification.coverage === null
                        ? "Unavailable"
                        : `${formatNumber(detail.verification.coverage * 100)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Checked</dt>
                    <dd>{formatDate(detail.verification.checkedAt, true)}</dd>
                  </div>
                </dl>
                {checkpoint.isError ? (
                  <InlineNotice
                    tone="danger"
                    title="Checkpoint was not created"
                  >
                    {checkpoint.error.message}
                  </InlineNotice>
                ) : null}
                {verify.isError ? (
                  <InlineNotice
                    tone="danger"
                    title="Verification did not start"
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
                      ? "Creating checkpoint…"
                      : checkpointId
                        ? "Replace checkpoint"
                        : "Create checkpoint"}
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
                      ? "Verification running…"
                      : "Verify current fix"}
                  </Button>
                </div>
                {!checkpointId ? (
                  <p className="verification-help">
                    A checkpoint preserves the before-state required for a
                    defensible verification result.
                  </p>
                ) : null}
              </Card>
            </section>

            <ScoreExplanation action={detail.action} />

            <section className="two-column-grid">
              <Card>
                <SectionHeading
                  title="Evidence source health"
                  description="Freshness and coverage qualify every technical or business claim above."
                />
                <SourceStateList sources={detail.sources} />
              </Card>
              <Card>
                <SectionHeading
                  title="Occurrence history"
                  description="The same evidence group across completed audit runs."
                />
                {detail.history.length > 0 ? (
                  <ol className="action-history-list">
                    {detail.history.map((entry) => (
                      <li key={entry.runId}>
                        <div>
                          <StatusBadge status={entry.status} />
                          <strong>
                            {formatNumber(entry.affectedCount)} URLs
                          </strong>
                        </div>
                        <span>{formatDate(entry.observedAt, true)}</span>
                        <Link
                          to="/audits/$runId"
                          params={{ runId: entry.runId }}
                          className="text-link"
                        >
                          Open run
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    title="No occurrence history"
                    description="A second audit is required to distinguish new, persistent, resolved, and reappeared evidence."
                  />
                )}
              </Card>
            </section>

            <section aria-labelledby="affected-url-title">
              <SectionHeading
                id="affected-url-title"
                title="Affected URL evidence"
                description="Inspect technical facts, Search Console exposure, GA4 outcomes, and raw issue evidence without mixing their claims."
              />
              <div className="url-evidence-controls">
                <label className="workbench-search">
                  <span>Search loaded URLs</span>
                  <span className="search-field">
                    <Icon name="search" />
                    <input
                      type="search"
                      value={urlSearch}
                      onChange={(event) =>
                        setUrlSearch(event.currentTarget.value)
                      }
                      placeholder="URL, page title, or issue"
                    />
                  </span>
                </label>
                <label>
                  Lifecycle
                  <select
                    value={lifecycle}
                    onChange={(event) =>
                      setLifecycle(event.currentTarget.value as LifecycleFilter)
                    }
                  >
                    <option value="all">All lifecycle states</option>
                    {lifecycleStates.map((state) => (
                      <option key={state} value={state}>
                        {displayLabel(state)}
                      </option>
                    ))}
                  </select>
                </label>
                <p role="status" aria-live="polite">
                  {formatNumber(visibleUrls.length)} matching ·{" "}
                  {formatNumber(loadedUrls.length)} loaded of{" "}
                  {formatNumber(detail.pageInfo.total)}
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
                  title="No loaded URLs match"
                  description="Change the URL search or lifecycle filter. Missing evidence remains visible in unfiltered results."
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
                      ? "Loading evidence…"
                      : "Load 100 more URLs"}
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
