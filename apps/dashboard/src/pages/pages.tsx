import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { PageRecord } from "../api/contracts";
import { usePages } from "../api/queries";
import { useSite } from "../context/site-context";
import { DataTable } from "../components/data-table";
import { FreshnessNotice, QueryState } from "../components/data-state";
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
  const { siteId } = useSite();
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
        header: "Page",
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
        header: "HTTP",
        cell: ({ row }) => formatNumber(row.original.statusCode),
      },
      {
        id: "indexability",
        header: "Indexability",
        cell: ({ row }) => (
          <div className="indexability-cell">
            <StatusBadge status={row.original.indexability ?? "unknown"} />
            <small>{indexabilityReasonLabel(row.original)}</small>
          </div>
        ),
      },
      {
        id: "clicks",
        header: "Clicks",
        cell: ({ row }) => formatNumber(row.original.organicClicks),
      },
      {
        id: "links",
        header: "Internal links",
        cell: ({ row }) => (
          <div className="page-link-cell">
            {row.original.linkGraphState === "available" ? (
              <>
                <strong>
                  {formatNumber(row.original.inlinkSources)} in ·{" "}
                  {formatNumber(row.original.outlinkTargets)} out
                </strong>
                <small>
                  Depth {formatNumber(row.original.crawlDepth)} · distinct pages
                </small>
              </>
            ) : (
              <StatusBadge status="unavailable" />
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedPageUrl(row.original.url)}
              aria-label={`Explore internal links for ${row.original.title ?? row.original.url}`}
            >
              Explore
            </Button>
          </div>
        ),
      },
      {
        id: "organicKeyEvents",
        header: "Organic key events",
        cell: ({ row }) => formatNumber(row.original.organicKeyEvents),
      },
      {
        id: "issues",
        header: "Issues",
        cell: ({ row }) => formatNumber(row.original.issues),
      },
      {
        id: "cwv",
        header: "Core Web Vitals",
        cell: ({ row }) => (
          <StatusBadge status={row.original.coreWebVitals ?? "unavailable"} />
        ),
      },
      {
        id: "crawled",
        header: "Last crawled",
        cell: ({ row }) => formatDate(row.original.lastCrawledAt, true),
      },
    ],
    [],
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="URL inventory"
        title="Pages"
        description="Connect technical crawl evidence with organic traffic and conversion context at URL level."
      />
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
                Search pages
              </label>
              <input
                id="page-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title or URL"
              />
            </div>
            {filtered.length > 0 ? (
              <DataTable
                data={filtered}
                columns={columns}
                label="Crawled pages"
              />
            ) : (
              <EmptyState
                title="No pages match"
                description="Try a broader title or URL search."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="No crawled pages"
            description="The API returned an empty page inventory. Run an audit to collect URL-level evidence."
          />
        )}
      </QueryState>
    </div>
  );
}
