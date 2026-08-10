import { useSystemHealth } from "../api/queries";
import { fmt, getMessages, useI18n } from "../i18n";
import { FreshnessNotice, QueryState } from "../components/data-state";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
} from "../components/ui";

function formatUptime(value: number | null | undefined) {
  const t = getMessages();
  if (value === null || value === undefined) return t.common.unavailable;
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  return days > 0
    ? fmt(t.systemHealth.uptimeDaysHours, { days, hours })
    : fmt(t.systemHealth.uptimeHours, { hours });
}

export function SystemHealthPage() {
  const { t } = useI18n();
  const query = useSystemHealth();
  const health = query.data?.data;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.systemHealth.eyebrow}
        title={t.systemHealth.title}
        description={t.systemHealth.description}
      />
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {health ? (
          <>
            <FreshnessNotice meta={query.data?.meta} />
            <Card className="system-overview">
              <div>
                <span className={`system-pulse pulse-${health.status}`} />
                <div>
                  <p className="eyebrow">{t.systemHealth.overallStatus}</p>
                  <h2>
                    {health.status === "healthy"
                      ? t.systemHealth.statusHealthy
                      : health.status === "degraded"
                        ? t.systemHealth.statusDegraded
                        : health.status === "offline"
                          ? t.systemHealth.statusOffline
                          : t.systemHealth.statusUnknown}
                  </h2>
                </div>
              </div>
              <StatusBadge status={health.status} />
              <dl>
                <div>
                  <dt>{t.systemHealth.version}</dt>
                  <dd>{health.version ?? t.common.unavailable}</dd>
                </div>
                <div>
                  <dt>{t.systemHealth.uptime}</dt>
                  <dd>{formatUptime(health.uptimeSeconds)}</dd>
                </div>
                <div>
                  <dt>{t.systemHealth.checked}</dt>
                  <dd>{formatDate(health.checkedAt, true)}</dd>
                </div>
              </dl>
            </Card>
            {(health.checks ?? []).length > 0 ? (
              <div className="health-check-grid">
                {health.checks?.map((check) => (
                  <Card key={check.id} className="health-check">
                    <div>
                      <span className={`source-dot source-${check.status}`} />
                      <h3>{check.name}</h3>
                    </div>
                    <StatusBadge status={check.status} />
                    <dl>
                      <div>
                        <dt>{t.systemHealth.latency}</dt>
                        <dd>
                          {check.latencyMs === null ||
                          check.latencyMs === undefined
                            ? t.common.unavailable
                            : fmt(t.systemHealth.latencyValue, {
                                value: formatNumber(check.latencyMs),
                              })}
                        </dd>
                      </div>
                      <div>
                        <dt>{t.systemHealth.checked}</dt>
                        <dd>{formatDate(check.checkedAt, true)}</dd>
                      </div>
                    </dl>
                    {check.message ? <p>{check.message}</p> : null}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t.systemHealth.emptyTitle}
                description={t.systemHealth.emptyDescription}
              />
            )}
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
