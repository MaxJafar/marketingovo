import { Link } from "@tanstack/react-router";
import { useOverview, useStartAudit } from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
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
  const { t } = useI18n();
  const { siteId, site } = useSite();
  const overviewQuery = useOverview(siteId);
  const startAudit = useStartAudit();
  const overview = overviewQuery.data?.data;
  const sources = overview?.sources ?? overviewQuery.data?.meta.sources ?? [];
  const topActions = (overview?.topActions ?? []).slice(0, 5);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.overview.eyebrow}
        title={
          site
            ? fmt(t.overview.siteTitle, { name: site.name })
            : t.overview.fallbackTitle
        }
        description={t.overview.description}
        actions={
          <Button
            onClick={() =>
              siteId && startAudit.mutate({ siteId, mode: "full" })
            }
            disabled={!siteId || startAudit.isPending}
          >
            <Icon name="audits" />{" "}
            {startAudit.isPending
              ? t.overview.startingAudit
              : t.overview.runFullAudit}
          </Button>
        }
      />
      {startAudit.isError ? (
        <InlineNotice tone="danger" title={t.overview.auditNotStartedTitle}>
          {startAudit.error.message}
        </InlineNotice>
      ) : null}
      {startAudit.isSuccess ? (
        <InlineNotice tone="success" title={t.overview.auditQueuedTitle}>
          {t.overview.auditQueuedBody}
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
                  <p className="eyebrow">{t.overview.health.eyebrow}</p>
                  <h2 id="health-title">{t.overview.health.title}</h2>
                  <p>{t.overview.health.body}</p>
                  <Link to="/actions" className="text-link">
                    {t.overview.health.reviewActions} <Icon name="arrow" />
                  </Link>
                </div>
                <div
                  className={`health-score ${overview.siteHealth.value === null || overview.siteHealth.value === undefined ? "health-score-missing" : ""}`}
                >
                  <span>{t.overview.health.currentScore}</span>
                  <strong>{formatMetric(overview.siteHealth)}</strong>
                  {overview.siteHealth.change !== null &&
                  overview.siteHealth.change !== undefined ? (
                    <small>
                      {fmt(t.overview.health.pointsVsPriorAudit, {
                        change:
                          (overview.siteHealth.change >= 0 ? "+" : "") +
                          formatNumber(overview.siteHealth.change),
                      })}
                    </small>
                  ) : (
                    <small>{t.overview.health.comparisonUnavailable}</small>
                  )}
                </div>
              </Card>
              <Card className="regression-card">
                <div>
                  <span className="regression-icon">
                    <Icon name="warning" />
                  </span>
                  <p className="eyebrow">{t.overview.regressions.eyebrow}</p>
                </div>
                <strong>{formatMetric(overview.criticalRegressions)}</strong>
                <h2>{t.overview.regressions.title}</h2>
                <p>{t.overview.regressions.body}</p>
                <Link to="/actions" className="text-link">
                  {t.overview.regressions.openQueue} <Icon name="arrow" />
                </Link>
              </Card>
            </section>

            <section aria-labelledby="performance-title">
              <SectionHeading
                id="performance-title"
                title={t.overview.performance.title}
                description={t.overview.performance.description}
              />
              <div className="metric-grid">
                <MetricCard
                  label={t.overview.performance.organicClicks}
                  metric={overview.organicClicks}
                  help={t.overview.performance.organicClicksHelp}
                />
                <MetricCard
                  label={t.overview.performance.organicKeyEvents}
                  metric={overview.organicKeyEvents}
                  tone="positive"
                  help={t.overview.performance.organicKeyEventsHelp}
                />
                <MetricCard
                  label={t.overview.performance.indexableCoverage}
                  metric={overview.indexableCoverage}
                />
                <MetricCard
                  label={t.overview.performance.coreWebVitalsPassRate}
                  metric={overview.coreWebVitalsPassRate}
                />
              </div>
            </section>

            <section aria-labelledby="actions-title">
              <SectionHeading
                id="actions-title"
                title={t.overview.topActions.title}
                description={t.overview.topActions.description}
                action={
                  <Link to="/actions" className="text-link">
                    {t.overview.topActions.viewAll} <Icon name="arrow" />
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
                  title={t.overview.topActions.emptyTitle}
                  description={t.overview.topActions.emptyDescription}
                />
              )}
            </section>

            <div className="overview-lower-grid">
              <TrendChart
                points={overview.healthTrend ?? []}
                title={t.overview.trendTitle}
              />
              <Card className="source-health">
                <SectionHeading
                  title={t.overview.sources.title}
                  description={t.overview.sources.description}
                  action={
                    <Link to="/integrations" className="text-link">
                      {t.overview.sources.manage}
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
                                fmt(t.overview.sources.updated, {
                                  date: formatDate(source.updatedAt, true),
                                })}
                            </small>
                          </div>
                        </div>
                        <div className="source-result">
                          <StatusBadge status={source.status} />
                          {source.coverage !== null &&
                          source.coverage !== undefined ? (
                            <small>
                              {fmt(t.overview.sources.coverage, {
                                value: formatNumber(source.coverage),
                              })}
                            </small>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <InlineNotice
                    tone="warning"
                    title={t.overview.sources.unavailableTitle}
                  >
                    {t.overview.sources.unavailableBody}
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
