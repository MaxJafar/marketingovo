import type { ReactNode } from "react";
import type { DataMeta } from "../api/contracts";
import { Button, Card, InlineNotice, StatusBadge, formatDate } from "./ui";
import { Icon } from "./icon";

export function QueryState({
  isLoading,
  error,
  siteId,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: Error | null;
  siteId?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (siteId !== undefined && !siteId) {
    return (
      <InlineNotice tone="info" title="Add a site to begin">
        This workspace needs a site before it can load SEO data. Open onboarding
        to connect your first property.
      </InlineNotice>
    );
  }

  if (isLoading) {
    return (
      <div
        className="skeleton-grid"
        role="status"
        aria-label="Loading data"
        aria-busy="true"
      >
        <span className="skeleton skeleton-tall" />
        <span className="skeleton skeleton-tall" />
        <span className="skeleton skeleton-tall" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="error-state" role="alert">
        <div className="error-state-icon">
          <Icon name="warning" />
        </div>
        <div>
          <h2>Data is unavailable</h2>
          <p>{error.message || "The API did not return this workspace."}</p>
          <p className="muted">
            No value has been replaced with zero. Check the local API and
            integration health.
          </p>
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              <Icon name="refresh" /> Try again
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}

export function FreshnessNotice({ meta }: { meta?: DataMeta }) {
  const state = meta?.state ?? "unknown";
  const timestamp = meta?.lastUpdatedAt ?? meta?.generatedAt;
  const warnings = meta?.warnings ?? [];

  if (state === "fresh" && warnings.length === 0) return null;

  const copy = {
    stale:
      "This view is using the latest available snapshot. Recent changes may not be included.",
    missing: "One or more sources have not supplied data for this view.",
    unavailable: "One or more sources could not be reached.",
    unknown: "The API did not provide a freshness guarantee for this response.",
    fresh: "The response includes source warnings.",
  }[state];

  return (
    <div className={`freshness freshness-${state}`} role="status">
      <div>
        <StatusBadge status={state} />
        <span>{copy}</span>
      </div>
      <span className="freshness-time">
        Snapshot: {formatDate(timestamp, true)}
      </span>
      {warnings.length > 0 ? (
        <ul>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
