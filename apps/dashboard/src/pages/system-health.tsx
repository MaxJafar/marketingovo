import { useSystemHealth } from "../api/queries";
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
  if (value === null || value === undefined) return "Unavailable";
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export function SystemHealthPage() {
  const query = useSystemHealth();
  const health = query.data?.data;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Local runtime"
        title="System health"
        description="Verify the dashboard API, storage, workers, and external connectors before trusting a reporting snapshot."
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
                  <p className="eyebrow">Overall status</p>
                  <h2>
                    {health.status === "healthy"
                      ? "All reported systems operational"
                      : health.status === "degraded"
                        ? "Some services need attention"
                        : health.status === "offline"
                          ? "Local API reports an outage"
                          : "Status is unknown"}
                  </h2>
                </div>
              </div>
              <StatusBadge status={health.status} />
              <dl>
                <div>
                  <dt>Version</dt>
                  <dd>{health.version ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Uptime</dt>
                  <dd>{formatUptime(health.uptimeSeconds)}</dd>
                </div>
                <div>
                  <dt>Checked</dt>
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
                        <dt>Latency</dt>
                        <dd>
                          {check.latencyMs === null ||
                          check.latencyMs === undefined
                            ? "Unavailable"
                            : `${formatNumber(check.latencyMs)} ms`}
                        </dd>
                      </div>
                      <div>
                        <dt>Checked</dt>
                        <dd>{formatDate(check.checkedAt, true)}</dd>
                      </div>
                    </dl>
                    {check.message ? <p>{check.message}</p> : null}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No component checks"
                description="The API returned overall health but no component-level checks."
              />
            )}
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
