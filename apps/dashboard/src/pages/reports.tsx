import { useReports } from "../api/queries";
import { useSite } from "../context/site-context";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Icon } from "../components/icon";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  formatDate,
  safeSameOriginUrl,
} from "../components/ui";

const REPORT_FORMATS = ["html", "pdf", "csv", "json"] as const;

export function ReportsPage() {
  const { siteId } = useSite();
  const query = useReports(siteId);
  const reports = query.data?.data.items ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Share outcomes"
        title="Reports"
        description="Keep stakeholders aligned with exportable snapshots and scheduled performance summaries."
      />
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        siteId={siteId}
        onRetry={() => void query.refetch()}
      >
        <FreshnessNotice meta={query.data?.meta} />
        {reports.length > 0 ? (
          <div className="report-grid">
            {reports.map((report) => {
              const downloadUrl = safeSameOriginUrl(report.downloadUrl);
              const downloadUrls = downloadUrl
                ? REPORT_FORMATS.flatMap((format) => {
                    const candidate =
                      format === "html"
                        ? downloadUrl
                        : safeSameOriginUrl(
                            `/api/v1/runs/${encodeURIComponent(report.id)}/report?format=${format}`,
                          );
                    return candidate ? [{ format, url: candidate }] : [];
                  })
                : [];
              return (
                <Card className="report-card" key={report.id}>
                  <div className="report-icon">
                    <Icon name="reports" />
                  </div>
                  <div className="report-body">
                    <div>
                      <StatusBadge status={report.status ?? "unknown"} />
                      <span>{report.type ?? "SEO report"}</span>
                    </div>
                    <h2>{report.name}</h2>
                    <p>
                      {report.generatedAt
                        ? `Generated ${formatDate(report.generatedAt, true)}`
                        : report.scheduledFor
                          ? `Scheduled for ${formatDate(report.scheduledFor, true)}`
                          : "Schedule unavailable"}
                    </p>
                    {(report.recipients ?? []).length > 0 ? (
                      <small>Recipients: {report.recipients?.join(", ")}</small>
                    ) : null}
                  </div>
                  {downloadUrls.length > 0 ? (
                    <div
                      className="report-downloads"
                      role="group"
                      aria-label={`Download ${report.name}`}
                    >
                      {downloadUrls.map(({ format, url }) => (
                        <a
                          className="button button-secondary"
                          href={url}
                          download
                          aria-label={`Download ${format.toUpperCase()} report: ${report.name}`}
                          key={format}
                        >
                          {format.toUpperCase()}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">Download unavailable</span>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No reports yet"
            description="Generate reports through the API or configure a schedule once your baseline data is available."
          />
        )}
      </QueryState>
    </div>
  );
}
