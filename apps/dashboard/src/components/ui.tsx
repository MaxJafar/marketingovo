import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type {
  DataAvailability,
  MetricValue,
  ServiceStatus,
} from "../api/contracts";
import { Icon } from "./icon";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}

export function StatusBadge({
  status,
  label,
}: {
  status: ServiceStatus | DataAvailability | string;
  label?: string;
}) {
  const display = label ?? status.replaceAll("_", " ");
  return <span className={`status-badge status-${status}`}>{display}</span>;
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
) {
  if (value === null || value === undefined || Number.isNaN(value))
    return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

export function formatMetric(metric: MetricValue | undefined): string {
  if (!metric || metric.value === null || metric.value === undefined)
    return "Unavailable";
  const value = metric.value;
  if (metric.unit === "percent") return `${formatNumber(value)}%`;
  if (metric.unit === "milliseconds") return `${formatNumber(value)} ms`;
  if (metric.unit === "seconds") return `${formatNumber(value)} s`;
  if (metric.unit === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: metric.currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return formatNumber(value, {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
  });
}

export function formatDate(
  value: string | null | undefined,
  withTime = false,
): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

export function safeExternalUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function safeSameOriginUrl(
  value: string | null | undefined,
): string | undefined {
  const url = safeExternalUrl(value);
  if (!url) return undefined;
  return new URL(url).origin === window.location.origin ? url : undefined;
}

export function MetricCard({
  label,
  metric,
  tone = "default",
  help,
}: {
  label: string;
  metric?: MetricValue;
  tone?: "default" | "positive" | "warning";
  help?: string;
}) {
  const unavailable = metric?.value === null || metric?.value === undefined;
  const change = metric?.change;
  return (
    <Card
      className={`metric-card metric-${tone} ${unavailable ? "metric-unavailable" : ""}`}
    >
      <div className="metric-label-row">
        <span className="metric-label">{label}</span>
        {metric?.status && metric.status !== "fresh" ? (
          <StatusBadge status={metric.status} />
        ) : null}
      </div>
      <strong className="metric-value">{formatMetric(metric)}</strong>
      <div className="metric-support">
        {change !== null && change !== undefined ? (
          <span className={change >= 0 ? "change-positive" : "change-negative"}>
            {change >= 0 ? "+" : ""}
            {formatNumber(change)}% vs prior period
          </span>
        ) : (
          <span>{help ?? metric?.note ?? "No comparison available"}</span>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="empty-state">
      <div className="empty-state-icon">
        <Icon name="search" />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </Card>
  );
}

export function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`inline-notice notice-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon
        name={
          tone === "success" ? "check" : tone === "info" ? "health" : "warning"
        }
      />
      <div>
        <strong>{title}</strong>
        <div className="inline-notice-body">{children}</div>
      </div>
    </div>
  );
}
