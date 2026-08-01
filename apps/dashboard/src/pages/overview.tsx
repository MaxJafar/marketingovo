import { Link } from "@tanstack/react-router";
import { useOverview, useStartAudit } from "../api/queries";
import { useSite } from "../context/site-context";
import { ActionCard } from "../components/action-card";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Icon } from "../components/icon";
import { TrendChart } from "../components/trend-chart";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusBadge,
  formatDate,
  formatMetric,
  formatNumber,
} from "../components/ui";

export function OverviewPage() {
  const { siteId, site } = useSite();
  const overviewQuery = useOverview(siteId);
  const startAudit = useStartAudit();
  const overview = overviewQuery.data?.data;
  const sources = overview?.sources ?? overviewQuery.data?.meta.sources ?? [];
  const topActions = (overview?.topActions ?? []).slice(0, 5);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Decision center"
        title={site ? `${site.name} overview` : "Your marketing overview"}
        description="See what changed, what matters, and which move is most likely to improve results."
        actions={
          <Button
            onClick={() =>
              siteId && startAudit.mutate({ siteId, mode: "full" })
            }
            disabled={!siteId || startAudit.isPending}
          >
            <Icon name="audits" />{" "}
            {startAudit.isPending ? "Starting audit…" : "Run full audit"}
          </Button>
        }
      />
      {startAudit.isError ? (
        <InlineNotice tone="danger" title="Audit could not start">
          {startAudit.error.message}
        </InlineNotice>
      ) : null}
      {startAudit.isSuccess ? (
        <InlineNotice tone="success" title="Audit queued">
          The audit was accepted. Track progress from the Audits workspace.
        </InlineNotice>
      ) : null}
      <QueryState
        isLoading={overviewQuery.isLoading}
        error={overviewQuery.error}
        siteId={siteId}
        onRetry={() => void overviewQuery.refetch()}
      >
        {overview ? (
          <>
            <FreshnessNotice meta={overviewQuery.data?.meta} />
            <section className="overview-hero" aria-labelledby="health-title">
              <Card className="health-card">
                <div className="health-copy">
                  <p className="eyebrow">Site health</p>
                  <h2 id="health-title">
                    A clear baseline for your next decision
                  </h2>
                  <p>
                    The health score combines the signals returned by your
                    configured audit sources. Missing inputs remain visible.
                  </p>
                  <Link to="/actions" className="text-link">
                    Review prioritized actions <Icon name="arrow" />
                  </Link>
                </div>
                <div
                  className={`health-score ${overview.siteHealth.value === null || overview.siteHealth.value === undefined ? "health-score-missing" : ""}`}
                >
                  <span>Current score</span>
                  <strong>{formatMetric(overview.siteHealth)}</strong>
                  {overview.siteHealth.change !== null &&
                  overview.siteHealth.change !== undefined ? (
                    <small>
                      {overview.siteHealth.change >= 0 ? "+" : ""}
                      {formatNumber(overview.siteHealth.change)} health points
                      vs prior audit
                    </small>
                  ) : (
                    <small>Comparison unavailable</small>
                  )}
                </div>
              </Card>
              <Card className="regression-card">
                <div>
                  <span className="regression-icon">
                    <Icon name="warning" />
                  </span>
                  <p className="eyebrow">Watch now</p>
                </div>
                <strong>{formatMetric(overview.criticalRegressions)}</strong>
                <h2>Critical regressions</h2>
                <p>Issues that may need immediate triage.</p>
                <Link to="/actions" className="text-link">
                  Open action queue <Icon name="arrow" />
                </Link>
              </Card>
            </section>

            <section aria-labelledby="performance-title">
              <SectionHeading
                id="performance-title"
                title="Performance at a glance"
                description="Marketing outcomes and technical coverage, without turning missing data into zero."
              />
              <div className="metric-grid">
                <MetricCard
                  label="Organic clicks"
                  metric={overview.organicClicks}
                  help="Connect Search Console for comparisons"
                />
                <MetricCard
                  label="Organic key events"
                  metric={overview.organicKeyEvents}
                  tone="positive"
                  help="Connect GA4 to measure organic outcomes"
                />
                <MetricCard
                  label="Indexable coverage"
                  metric={overview.indexableCoverage}
                />
                <MetricCard
                  label="Core Web Vitals pass rate"
                  metric={overview.coreWebVitalsPassRate}
                />
              </div>
            </section>

            <section aria-labelledby="actions-title">
              <SectionHeading
                id="actions-title"
                title="Top 5 actions"
                description="Ranked by estimated impact, effort, confidence, and the evidence supplied by the API."
                action={
                  <Link to="/actions" className="text-link">
                    View all actions <Icon name="arrow" />
                  </Link>
                }
              />
              {topActions.length > 0 ? (
                <div className="action-grid">
                  {topActions.map((action, index) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      rank={index + 1}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No prioritized actions yet"
                  description="Run a baseline audit after connecting your data sources. A valid empty result is shown as empty—not as a perfect score."
                />
              )}
            </section>

            <div className="overview-lower-grid">
              <TrendChart
                points={overview.healthTrend ?? []}
                title="Health score trend"
              />
              <Card className="source-health">
                <SectionHeading
                  title="Data source health"
                  description="Know which inputs support this view."
                  action={
                    <Link to="/integrations" className="text-link">
                      Manage
                    </Link>
                  }
                />
                {sources.length > 0 ? (
                  <ul className="source-list">
                    {sources.map((source) => (
                      <li key={source.id}>
                        <div>
                          <span
                            className={`source-dot source-${source.status}`}
                          />
                          <div>
                            <strong>{source.name}</strong>
                            <small>
                              {source.message ??
                                `Updated ${formatDate(source.updatedAt, true)}`}
                            </small>
                          </div>
                        </div>
                        <div className="source-result">
                          <StatusBadge status={source.status} />
                          {source.coverage !== null &&
                          source.coverage !== undefined ? (
                            <small>
                              {formatNumber(source.coverage)}% coverage
                            </small>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <InlineNotice
                    tone="warning"
                    title="Source status unavailable"
                  >
                    The API did not identify the sources behind this overview.
                  </InlineNotice>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
