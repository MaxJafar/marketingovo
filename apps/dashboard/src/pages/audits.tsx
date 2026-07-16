import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { AuditRun } from "../api/contracts";
import { useRuns, useStartAudit } from "../api/queries";
import { useSite } from "../context/site-context";
import { exactUrlHostname } from "../lib/url";
import { DataTable } from "../components/data-table";
import { AuditComparisonCard } from "../components/audit-comparison-card";
import { FreshnessNotice, QueryState } from "../components/data-state";
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
  const { siteId, site } = useSite();
  const query = useRuns(siteId);
  const startAudit = useStartAudit();
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
        header: "Started",
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
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "trigger",
        header: "Trigger",
        cell: ({ row }) => row.original.trigger ?? "Unavailable",
      },
      {
        id: "pages",
        header: "Pages crawled",
        cell: ({ row }) => formatNumber(row.original.pagesCrawled),
      },
      {
        id: "issues",
        header: "Issues",
        cell: ({ row }) => formatNumber(row.original.issuesFound),
      },
      {
        id: "score",
        header: "Health score",
        cell: ({ row }) => formatNumber(row.original.healthScore),
      },
    ],
    [],
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
        eyebrow="Crawl history"
        title="Audits"
        description="Start a baseline, follow active crawls, and compare completed technical snapshots."
        actions={
          <Button
            onClick={startFullAudit}
            disabled={!siteId || startAudit.isPending}
          >
            <Icon name="audits" />{" "}
            {startAudit.isPending ? "Starting…" : "Run full audit"}
          </Button>
        }
      />
      {privateAccessHost ? (
        <details className="private-site-access">
          <summary>Private-site access</summary>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={privateAccessApproved}
              onChange={(event) =>
                setPrivateAccessApproved(event.currentTarget.checked)
              }
            />
            <span>
              <strong>
                Allow this exact hostname to access a private network for this
                audit
              </strong>
              <small>
                {privateAccessHost} only. This approval applies to audits
                started from this page until you switch projects; cloud metadata
                always stays blocked.
              </small>
            </span>
          </label>
        </details>
      ) : null}
      <details className="audit-scope-panel">
        <summary>Expert audit scope</summary>
        <form onSubmit={startExactCohort}>
          <div>
            <h2>Audit an exact URL cohort</h2>
            <p>
              Paste one absolute URL per line. Golem crawls only this list and
              keeps each URL as a seed, which is useful for migrations,
              templates, QA samples, and verification runs.
            </p>
          </div>
          <label htmlFor="audit-exact-urls">
            URL list
            <textarea
              id="audit-exact-urls"
              value={urlList}
              onChange={(event) => setUrlList(event.currentTarget.value)}
              placeholder={
                "https://example.com/pricing\nhttps://example.com/docs/getting-started"
              }
              rows={6}
            />
            <small>
              URLs must use the project origin. Fragments and duplicates are
              removed before the run starts.
            </small>
          </label>
          {scopeError ? (
            <InlineNotice tone="warning" title="URL cohort needs attention">
              {scopeError}
            </InlineNotice>
          ) : null}
          <div className="form-actions">
            <Button
              type="submit"
              variant="secondary"
              disabled={!siteId || startAudit.isPending || !urlList.trim()}
            >
              Run URL list audit
            </Button>
          </div>
        </form>
      </details>
      {startAudit.isError ? (
        <InlineNotice tone="danger" title="Audit could not start">
          {startAudit.error.message}
        </InlineNotice>
      ) : null}
      {startAudit.isSuccess ? (
        <InlineNotice tone="success" title="Audit queued">
          The API accepted the run. Refresh or watch the status below.
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
          <DataTable data={auditRuns} columns={columns} label="Audit runs" />
        ) : (
          <EmptyState
            title="No audit runs yet"
            description="Start a full baseline audit to populate crawl history and prioritized actions."
          />
        )}
      </QueryState>
    </div>
  );
}

export function parseExactAuditUrls(value: string): string[] {
  const raw = value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (raw.length === 0) throw new TypeError("Add at least one absolute URL.");
  const urls = raw.map((entry) => {
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      throw new TypeError(`Invalid URL: ${entry}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new TypeError(`Unsupported URL scheme: ${parsed.protocol}`);
    }
    parsed.hash = "";
    return parsed.toString();
  });
  return [...new Set(urls)];
}
