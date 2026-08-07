import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type {
  DataMeta,
  WorkspaceCapabilities,
  WorkspaceCapability,
  WorkspaceCapabilityState,
} from "../api/contracts";
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
  // This gate is now about the workspace itself, not about a website. A
  // workspace with no site still has social, OSINT, keyword and research
  // surfaces worth showing; what those individual surfaces need is decided by
  // CapabilityGate, which can name the missing input instead of refusing the
  // whole page.
  if (siteId !== undefined && !siteId) {
    return (
      <InlineNotice tone="info" title="Create a workspace to begin">
        A workspace holds your channels, research and notes. Create one to start
        — you can add a website later, or never.
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

/**
 * Guards one surface on what it actually needs.
 *
 * The point is the opposite of hiding: a locked surface stays visible and says
 * which input is missing and the single step that supplies it. Requirements are
 * satisfied when *any* listed capability is present, because several surfaces
 * have more than one honest source — keyword work reads from a crawl or from
 * Search Console, and either is enough.
 *
 * While capabilities are still loading the children render. A brief optimistic
 * pass is better than flashing a "you cannot do this" panel at someone who can.
 */
export function CapabilityGate({
  capabilities,
  requires,
  children,
}: {
  capabilities?: WorkspaceCapabilities;
  requires: WorkspaceCapability[];
  children: ReactNode;
}) {
  if (!capabilities || requires.length === 0) return <>{children}</>;

  const satisfied = requires.some((capability) =>
    capabilities.available.includes(capability),
  );
  if (satisfied) return <>{children}</>;

  const missing = requires
    .map((capability) =>
      capabilities.states.find((state) => state.capability === capability),
    )
    .filter((state): state is WorkspaceCapabilityState => state !== undefined);
  const remedy = missing.find((state) => state.remedy !== null)?.remedy ?? null;

  return (
    <Card className="capability-gate">
      <div className="capability-gate-icon" aria-hidden="true">
        <Icon name="warning" />
      </div>
      <div>
        <h2>This needs one more thing</h2>
        <ul className="capability-gate-reasons">
          {missing.map((state) => (
            <li key={state.capability}>{state.reason}</li>
          ))}
        </ul>
        <p className="muted">
          Everything else in this workspace keeps working. Nothing here has been
          filled in with a placeholder.
        </p>
        {remedy ? (
          <Link to={remedy.href} className="button button-primary">
            {remedy.label} <Icon name="arrow" />
          </Link>
        ) : null}
      </div>
    </Card>
  );
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
