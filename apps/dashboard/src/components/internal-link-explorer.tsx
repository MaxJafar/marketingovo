import { useState } from "react";
import type {
  InternalLinkDirection,
  InternalLinkEdge,
  PageRecord,
} from "../api/contracts";
import { useRunLinks } from "../api/queries";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  StatusBadge,
  formatNumber,
  safeExternalUrl,
} from "./ui";

function linkedPage(edge: InternalLinkEdge, direction: InternalLinkDirection) {
  return direction === "inlinks"
    ? { title: edge.sourceTitle, url: edge.sourceUrl }
    : { title: edge.targetTitle, url: edge.targetUrl };
}

export function InternalLinkExplorer({
  page,
  onClose,
}: {
  page: PageRecord;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<InternalLinkDirection>("inlinks");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const query = useRunLinks(page.runId ?? "", page.url, {
    direction,
    offset,
    limit: 25,
    search,
    enabled: page.linkGraphState === "available",
  });
  const explorer = query.data?.data;
  const title = page.title ?? page.url;

  const selectDirection = (next: InternalLinkDirection) => {
    setDirection(next);
    setOffset(0);
  };

  return (
    <Card
      className="internal-link-explorer"
      role="region"
      aria-label={`Internal links for ${title}`}
    >
      <header className="link-explorer-header">
        <div>
          <p className="eyebrow">Immutable crawl graph</p>
          <h2>{title}</h2>
          <p className="link-explorer-url">{page.url}</p>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          Close explorer
        </Button>
      </header>

      {page.linkGraphState !== "available" || !page.runId ? (
        <InlineNotice tone="warning" title="Link evidence unavailable">
          Replay this audit to capture versioned inlink and outlink evidence.
          Existing page and issue history remains unchanged.
        </InlineNotice>
      ) : (
        <>
          <div className="link-explorer-tabs" aria-label="Link direction">
            <button
              type="button"
              aria-pressed={direction === "inlinks"}
              className={direction === "inlinks" ? "is-active" : ""}
              onClick={() => selectDirection("inlinks")}
            >
              Inlinks · {formatNumber(page.inlinkSources)} sources
            </button>
            <button
              type="button"
              aria-pressed={direction === "outlinks"}
              className={direction === "outlinks" ? "is-active" : ""}
              onClick={() => selectDirection("outlinks")}
            >
              Outlinks · {formatNumber(page.outlinkTargets)} targets
            </button>
          </div>

          <form
            className="link-explorer-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draftSearch.trim());
              setOffset(0);
            }}
          >
            <label htmlFor="link-explorer-search">
              Search this direction
              <input
                id="link-explorer-search"
                type="search"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.currentTarget.value)}
                placeholder="URL, page title, or anchor text"
                maxLength={160}
              />
            </label>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {query.isLoading ? (
            <p className="link-explorer-loading" role="status">
              Reading the stored link graph…
            </p>
          ) : null}
          {query.isError ? (
            <InlineNotice tone="danger" title="Link graph unavailable">
              {query.error.message}
            </InlineNotice>
          ) : null}

          {explorer ? (
            <>
              <dl className="link-summary-grid">
                <div>
                  <dt>Inlink sources</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.inlinkSources)}
                    </strong>
                    <small>
                      {formatNumber(explorer.summary.inlinkOccurrences)} total
                      occurrences
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Outlink targets</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.outlinkTargets)}
                    </strong>
                    <small>
                      {formatNumber(explorer.summary.outlinkOccurrences)} total
                      occurrences
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Redirected targets</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.redirectedOutlinkTargets)}
                    </strong>
                    <small>
                      Internal links that should point to the final URL
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Broken targets</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.brokenOutlinkTargets)}
                    </strong>
                    <small>Destinations returning HTTP 4xx or 5xx</small>
                  </dd>
                </div>
              </dl>

              {explorer.warnings.length > 0 ? (
                <InlineNotice tone="warning" title="Coverage limitation">
                  <ul>
                    {explorer.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </InlineNotice>
              ) : null}

              {explorer.items.length > 0 ? (
                <div className="link-evidence-table-wrap">
                  <table aria-label={`${direction} for ${title}`}>
                    <caption>
                      {direction === "inlinks"
                        ? "Pages linking to the selected URL"
                        : "Internal destinations linked from the selected URL"}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          {direction === "inlinks"
                            ? "Source page"
                            : "Destination"}
                        </th>
                        <th scope="col">State</th>
                        <th scope="col">Anchor evidence</th>
                        <th scope="col">Follow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explorer.items.map((edge) => {
                        const linked = linkedPage(edge, direction);
                        const href = safeExternalUrl(linked.url);
                        return (
                          <tr key={`${edge.sourceUrl}:${edge.targetUrl}`}>
                            <td>
                              <div className="url-cell">
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {linked.title ?? linked.url}
                                  </a>
                                ) : (
                                  <strong>{linked.title ?? linked.url}</strong>
                                )}
                                <small>{linked.url}</small>
                                {direction === "outlinks" &&
                                edge.targetPageUrl &&
                                edge.targetPageUrl !== edge.targetUrl ? (
                                  <small>Final URL: {edge.targetPageUrl}</small>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <StatusBadge status={edge.targetState} />
                              <small className="link-http-state">
                                HTTP {formatNumber(edge.targetStatusCode)}
                              </small>
                            </td>
                            <td>
                              {edge.anchorTexts.length > 0 ? (
                                <ul className="anchor-text-list">
                                  {edge.anchorTexts.map((anchor) => (
                                    <li key={anchor}>{anchor}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="muted-value">
                                  No text captured
                                </span>
                              )}
                              <small>
                                {edge.placements.join(", ") ||
                                  "Placement unavailable"}
                              </small>
                            </td>
                            <td>
                              <strong>{formatNumber(edge.occurrences)}</strong>
                              <small>
                                {formatNumber(edge.followOccurrences)} follow ·{" "}
                                {formatNumber(edge.nofollowOccurrences)}{" "}
                                nofollow
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={search ? "No links match" : `No ${direction} captured`}
                  description={
                    search
                      ? "Try a broader URL, title, or anchor-text search."
                      : direction === "inlinks"
                        ? "No crawled page links to this URL in the selected snapshot."
                        : "This page has no captured internal destinations."
                  }
                />
              )}

              <nav
                className="link-explorer-pagination"
                aria-label="Link evidence pages"
              >
                <Button
                  type="button"
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() =>
                    setOffset(Math.max(0, offset - explorer.pageInfo.limit))
                  }
                >
                  Previous
                </Button>
                <span>
                  {explorer.pageInfo.total === 0
                    ? "0 results"
                    : `${formatNumber(explorer.pageInfo.offset + 1)}–${formatNumber(
                        explorer.pageInfo.offset + explorer.items.length,
                      )} of ${formatNumber(explorer.pageInfo.total)}`}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={explorer.pageInfo.nextOffset === null}
                  onClick={() =>
                    setOffset(
                      explorer.pageInfo.nextOffset ?? explorer.pageInfo.offset,
                    )
                  }
                >
                  Next
                </Button>
              </nav>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
