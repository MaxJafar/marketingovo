import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type {
  DataMeta,
  WorkspaceCapabilities,
  WorkspaceCapability,
  WorkspaceCapabilityState,
} from "../api/contracts";
import { fmt, useI18n } from "../i18n";
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
  const { t } = useI18n();

  // This gate is now about the workspace itself, not about a website. A
  // workspace with no site still has social, OSINT, keyword and research
  // surfaces worth showing; what those individual surfaces need is decided by
  // CapabilityGate, which can name the missing input instead of refusing the
  // whole page.
  if (siteId !== undefined && !siteId) {
    return (
      <InlineNotice tone="info" title={t.common.createWorkspaceTitle}>
        {t.common.createWorkspaceBody}
      </InlineNotice>
    );
  }

  if (isLoading) {
    return (
      <div
        className="skeleton-grid"
        role="status"
        aria-label={t.common.loadingLabel}
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
          <h2>{t.common.errorTitle}</h2>
          <p>{error.message || t.common.errorFallback}</p>
          <p className="muted">{t.common.errorHint}</p>
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              <Icon name="refresh" /> {t.common.tryAgain}
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
  const { t } = useI18n();

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
        <h2>{t.common.gateTitle}</h2>
        <ul className="capability-gate-reasons">
          {missing.map((state) => (
            <li key={state.capability}>{state.reason}</li>
          ))}
        </ul>
        <p className="muted">{t.common.gateHint}</p>
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
  const { t } = useI18n();
  const state = meta?.state ?? "unknown";
  const timestamp = meta?.lastUpdatedAt ?? meta?.generatedAt;
  const warnings = meta?.warnings ?? [];

  if (state === "fresh" && warnings.length === 0) return null;

  const copy = t.common.freshness[state];

  return (
    <div className={`freshness freshness-${state}`} role="status">
      <div>
        <StatusBadge status={state} />
        <span>{copy}</span>
      </div>
      <span className="freshness-time">
        {fmt(t.common.snapshot, { time: formatDate(timestamp, true) })}
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
