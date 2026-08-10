import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { AuditRun } from "../api/contracts";
import { useRuns, useStartAudit } from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, getMessages, useI18n } from "../i18n";
import { exactUrlHostname } from "../lib/url";
import { DataTable } from "../components/data-table";
import { AuditComparisonCard } from "../components/audit-comparison-card";
import {
  CapabilityGate,
  FreshnessNotice,
  QueryState,
} from "../components/data-state";
import { NEEDS_WEBSITE, useWorkspaceCapabilities } from "../lib/capabilities";
import { Icon } from "../components/icon";
import {
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
} from "../components/ui";

export function AuditsPage() {
  const { t } = useI18n();
  const { siteId, site } = useSite();
  const query = useRuns(siteId);
  const startAudit = useStartAudit();
  const { capabilities, has } = useWorkspaceCapabilities(siteId);
  const hasWebsite = has("website");
  const runs = query.data?.data.items ?? [];
  const auditRuns = runs.filter((run) => run.workflowId === "audit");
  const [urlList, setUrlList] = useState("");
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [privateAccessApproved, setPrivateAccessApproved] = useState(false);
  const privateAccessHost = useMemo(
    () => exactUrlHostname(site?.url),
    [site?.url],
  );
  const columns = useMemo<ColumnDef<AuditRun, unknown>[]>(
    () => [
      {
        id: "startedAt",
        header: t.audits.columns.started,
        cell: ({ row }) => (
          <Link
            to="/audits/$runId"
            params={{ runId: row.original.id }}
            className="table-link"
          >
            {formatDate(row.original.startedAt, true)}
          </Link>
        ),
      },
      {
        id: "status",
        header: t.audits.columns.status,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "trigger",
        header: t.audits.columns.trigger,
        cell: ({ row }) => row.original.trigger ?? t.common.unavailable,
      },
      {
        id: "pages",
        header: t.audits.columns.pagesCrawled,
        cell: ({ row }) => formatNumber(row.original.pagesCrawled),
      },
      {
        id: "issues",
        header: t.audits.columns.issues,
        cell: ({ row }) => formatNumber(row.original.issuesFound),
      },
      {
        id: "score",
        header: t.audits.columns.healthScore,
        cell: ({ row }) => formatNumber(row.original.healthScore),
      },
    ],
    [t],
  );

  useEffect(() => setPrivateAccessApproved(false), [privateAccessHost]);

  function privateHostOptions() {
    return privateAccessApproved && privateAccessHost
      ? { privateHostAllowlist: [privateAccessHost] }
      : {};
  }

  function startFullAudit() {
    if (!siteId) return;
    startAudit.mutate({
      siteId,
      mode: "full",
      ...privateHostOptions(),
    });
  }

  function startExactCohort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siteId) return;
    try {
      const exactUrls = parseExactAuditUrls(urlList);
      setScopeError(null);
      startAudit.mutate({
        siteId,
        mode: "full",
        exactUrls,
        ...privateHostOptions(),
      });
    } catch (error) {
      setScopeError((error as Error).message);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.audits.eyebrow}
        title={t.audits.title}
        description={t.audits.description}
        actions={
          <Button
            onClick={startFullAudit}
            disabled={!siteId || !hasWebsite || startAudit.isPending}
          >
            <Icon name="audits" />{" "}
            {startAudit.isPending ? t.audits.starting : t.audits.runFullAudit}
          </Button>
        }
      />
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        {privateAccessHost ? (
          <details className="private-site-access">
            <summary>{t.audits.privateAccess.summary}</summary>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={privateAccessApproved}
                onChange={(event) =>
                  setPrivateAccessApproved(event.currentTarget.checked)
                }
              />
              <span>
                <strong>{t.audits.privateAccess.allowTitle}</strong>
                <small>
                  {fmt(t.audits.privateAccess.allowHelp, {
                    host: privateAccessHost,
                  })}
                </small>
              </span>
            </label>
          </details>
        ) : null}
        <details className="audit-scope-panel">
          <summary>{t.audits.scope.summary}</summary>
          <form onSubmit={startExactCohort}>
            <div>
              <h2>{t.audits.scope.title}</h2>
              <p>{t.audits.scope.body}</p>
            </div>
            <label htmlFor="audit-exact-urls">
              {t.audits.scope.urlListLabel}
              <textarea
                id="audit-exact-urls"
                value={urlList}
                onChange={(event) => setUrlList(event.currentTarget.value)}
                placeholder={
                  "https://example.com/pricing\nhttps://example.com/docs/getting-started"
                }
                rows={6}
              />
              <small>{t.audits.scope.urlListHelp}</small>
            </label>
            {scopeError ? (
              <InlineNotice tone="warning" title={t.audits.scope.errorTitle}>
                {scopeError}
              </InlineNotice>
            ) : null}
            <div className="form-actions">
              <Button
                type="submit"
                variant="secondary"
                disabled={!siteId || startAudit.isPending || !urlList.trim()}
              >
                {t.audits.scope.submit}
              </Button>
            </div>
          </form>
        </details>
        {startAudit.isError ? (
          <InlineNotice tone="danger" title={t.audits.startErrorTitle}>
            {startAudit.error.message}
          </InlineNotice>
        ) : null}
        {startAudit.isSuccess ? (
          <InlineNotice tone="success" title={t.audits.queuedTitle}>
            {t.audits.queuedBody}
          </InlineNotice>
        ) : null}
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          <AuditComparisonCard runs={auditRuns} />
          {auditRuns.length > 0 ? (
            <DataTable
              data={auditRuns}
              columns={columns}
              label={t.audits.tableLabel}
            />
          ) : (
            <EmptyState
              title={t.audits.emptyTitle}
              description={t.audits.emptyBody}
            />
          )}
        </QueryState>
      </CapabilityGate>
    </div>
  );
}

export function parseExactAuditUrls(value: string): string[] {
  const messages = getMessages();
  const raw = value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (raw.length === 0)
    throw new TypeError(messages.audits.scope.atLeastOneUrl);
  const urls = raw.map((entry) => {
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      throw new TypeError(
        fmt(messages.audits.scope.invalidUrl, { url: entry }),
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new TypeError(
        fmt(messages.audits.scope.unsupportedScheme, {
          scheme: parsed.protocol,
        }),
      );
    }
    parsed.hash = "";
    return parsed.toString();
  });
  return [...new Set(urls)];
}
