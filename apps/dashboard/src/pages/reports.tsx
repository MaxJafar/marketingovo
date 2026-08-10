import { useReports } from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
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
  const { t } = useI18n();
  const { siteId } = useSite();
  const query = useReports(siteId);
  const reports = query.data?.data.items ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.reports.eyebrow}
        title={t.reports.title}
        description={t.reports.description}
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
                      <span>{report.type ?? t.reports.typeFallback}</span>
                    </div>
                    <h2>{report.name}</h2>
                    <p>
                      {report.generatedAt
                        ? fmt(t.reports.generated, {
                            date: formatDate(report.generatedAt, true),
                          })
                        : report.scheduledFor
                          ? fmt(t.reports.scheduledFor, {
                              date: formatDate(report.scheduledFor, true),
                            })
                          : t.reports.scheduleUnavailable}
                    </p>
                    {(report.recipients ?? []).length > 0 ? (
                      <small>
                        {fmt(t.reports.recipients, {
                          list: report.recipients?.join(", ") ?? "",
                        })}
                      </small>
                    ) : null}
                  </div>
                  {downloadUrls.length > 0 ? (
                    <div
                      className="report-downloads"
                      role="group"
                      aria-label={fmt(t.reports.downloadGroupLabel, {
                        name: report.name,
                      })}
                    >
                      {downloadUrls.map(({ format, url }) => (
                        <a
                          className="button button-secondary"
                          href={url}
                          download
                          aria-label={fmt(t.reports.downloadFormatLabel, {
                            format: format.toUpperCase(),
                            name: report.name,
                          })}
                          key={format}
                        >
                          {format.toUpperCase()}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">
                      {t.reports.downloadUnavailable}
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={t.reports.emptyTitle}
            description={t.reports.emptyDescription}
          />
        )}
      </QueryState>
    </div>
  );
}
