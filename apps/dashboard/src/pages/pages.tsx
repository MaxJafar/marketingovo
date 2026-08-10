import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { PageRecord } from "../api/contracts";
import { usePages } from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
import { DataTable } from "../components/data-table";
import {
  CapabilityGate,
  FreshnessNotice,
  QueryState,
} from "../components/data-state";
import { NEEDS_WEBSITE, useWorkspaceCapabilities } from "../lib/capabilities";
import { Icon } from "../components/icon";
import { InternalLinkExplorer } from "../components/internal-link-explorer";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";
import { indexabilityReasonLabel } from "./page-indexability";

export function PagesPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const query = usePages(siteId);
  const [search, setSearch] = useState("");
  const [selectedPageUrl, setSelectedPageUrl] = useState("");
  const pages = query.data?.data.items ?? [];
  const selectedPage = pages.find((page) => page.url === selectedPageUrl);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? pages.filter(
          (page) =>
            page.url.toLowerCase().includes(term) ||
            page.title?.toLowerCase().includes(term),
        )
      : pages;
  }, [pages, search]);
  const columns = useMemo<ColumnDef<PageRecord, unknown>[]>(
    () => [
      {
        id: "page",
        header: t.pages.columns.page,
        cell: ({ row }) => {
          const url = safeExternalUrl(row.original.url);
          return (
            <div className="url-cell">
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {row.original.title ?? row.original.url}
                </a>
              ) : (
                <strong>{row.original.title ?? row.original.url}</strong>
              )}
              <small>{row.original.url}</small>
            </div>
          );
        },
      },
      {
        id: "statusCode",
        header: t.pages.columns.http,
        cell: ({ row }) => formatNumber(row.original.statusCode),
      },
      {
        id: "indexability",
        header: t.pages.columns.indexability,
        cell: ({ row }) => (
          <div className="indexability-cell">
            <StatusBadge status={row.original.indexability ?? "unknown"} />
            <small>{indexabilityReasonLabel(row.original, t.pages)}</small>
          </div>
        ),
      },
      {
        id: "clicks",
        header: t.pages.columns.clicks,
        cell: ({ row }) => formatNumber(row.original.organicClicks),
      },
      {
        id: "links",
        header: t.pages.columns.internalLinks,
        cell: ({ row }) => (
          <div className="page-link-cell">
            {row.original.linkGraphState === "available" ? (
              <>
                <strong>
                  {fmt(t.pages.linkCounts, {
                    inCount: formatNumber(row.original.inlinkSources),
                    outCount: formatNumber(row.original.outlinkTargets),
                  })}
                </strong>
                <small>
                  {fmt(t.pages.linkDepth, {
                    depth: formatNumber(row.original.crawlDepth),
                  })}
                </small>
              </>
            ) : (
              <StatusBadge status="unavailable" />
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedPageUrl(row.original.url)}
              aria-label={fmt(t.pages.exploreLinksFor, {
                page: row.original.title ?? row.original.url,
              })}
            >
              {t.pages.explore}
            </Button>
          </div>
        ),
      },
      {
        id: "organicKeyEvents",
        header: t.pages.columns.organicKeyEvents,
        cell: ({ row }) => formatNumber(row.original.organicKeyEvents),
      },
      {
        id: "issues",
        header: t.pages.columns.issues,
        cell: ({ row }) => formatNumber(row.original.issues),
      },
      {
        id: "cwv",
        header: t.pages.columns.coreWebVitals,
        cell: ({ row }) => (
          <StatusBadge status={row.original.coreWebVitals ?? "unavailable"} />
        ),
      },
      {
        id: "crawled",
        header: t.pages.columns.lastCrawled,
        cell: ({ row }) => formatDate(row.original.lastCrawledAt, true),
      },
    ],
    [t],
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.pages.eyebrow}
        title={t.pages.title}
        description={t.pages.description}
      />
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          {selectedPage ? (
            <InternalLinkExplorer
              key={`${selectedPage.runId ?? "legacy"}:${selectedPage.url}`}
              page={selectedPage}
              onClose={() => setSelectedPageUrl("")}
            />
          ) : null}
          {pages.length > 0 ? (
            <>
              <div className="search-field">
                <Icon name="search" />
                <label className="sr-only" htmlFor="page-search">
                  {t.pages.searchLabel}
                </label>
                <input
                  id="page-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.pages.searchPlaceholder}
                />
              </div>
              {filtered.length > 0 ? (
                <DataTable
                  data={filtered}
                  columns={columns}
                  label={t.pages.tableLabel}
                />
              ) : (
                <EmptyState
                  title={t.pages.noMatchTitle}
                  description={t.pages.noMatchBody}
                />
              )}
            </>
          ) : (
            <EmptyState
              title={t.pages.emptyTitle}
              description={t.pages.emptyBody}
            />
          )}
        </QueryState>
      </CapabilityGate>
    </div>
  );
}
