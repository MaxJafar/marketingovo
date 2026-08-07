import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { IssueReviewItem, IssueStatus, Severity } from "../api/contracts";
import {
  useIssues,
  useUpdateIssueAdjudication,
  type IssueReviewFilters,
} from "../api/queries";
import { useSite } from "../context/site-context";
import {
  CapabilityGate,
  FreshnessNotice,
  QueryState,
} from "../components/data-state";
import { NEEDS_WEBSITE, useWorkspaceCapabilities } from "../lib/capabilities";
import { Icon } from "../components/icon";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";

const PAGE_SIZE = 50;

function displayLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function evidenceValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 500
      ? `${serialized.slice(0, 497)}…`
      : serialized;
  } catch {
    return "Structured evidence";
  }
}

function IssueReviewEditor({
  item,
  siteId,
  onClose,
}: {
  item: IssueReviewItem;
  siteId: string;
  onClose: () => void;
}) {
  const mutation = useUpdateIssueAdjudication(siteId);
  const originalStatus = item.adjudication?.status ?? "open";
  const originalNote = item.adjudication?.note ?? "";
  const [status, setStatus] = useState<"open" | "ignored" | "false_positive">(
    originalStatus,
  );
  const [note, setNote] = useState(originalNote);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setStatus(item.adjudication?.status ?? "open");
    setNote(item.adjudication?.note ?? "");
    setConfirmed(false);
  }, [item.adjudication, item.issue.fingerprint]);

  const noteRequired = status !== "open";
  const changed = status !== originalStatus || note.trim() !== originalNote;
  const canSave =
    changed &&
    !mutation.isPending &&
    (!noteRequired || (note.trim().length >= 3 && confirmed));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    mutation.mutate({
      fingerprint: item.issue.fingerprint,
      status,
      note: noteRequired ? note.trim() : null,
    });
  }

  return (
    <Card className="issue-review-editor" aria-labelledby="issue-review-title">
      <div className="issue-review-editor-heading">
        <div>
          <p className="eyebrow">Evidence review</p>
          <h2 id="issue-review-title">{item.issue.title}</h2>
          <p>{item.issue.description}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close review
        </Button>
      </div>

      <dl className="issue-review-facts">
        <div>
          <dt>Rule</dt>
          <dd>{item.issue.ruleId}</dd>
        </div>
        <div>
          <dt>Module</dt>
          <dd>{item.issue.moduleId}</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{formatDate(item.issue.firstSeenAt, true)}</dd>
        </div>
        <div>
          <dt>Occurrences</dt>
          <dd>{formatNumber(item.occurrenceCount)}</dd>
        </div>
      </dl>

      {item.issue.evidence.length > 0 ? (
        <section aria-labelledby="issue-evidence-title">
          <h3 id="issue-evidence-title">Captured evidence</h3>
          <ul className="issue-evidence-list">
            {item.issue.evidence.map((evidence, index) => {
              const value = evidenceValue(evidence.value);
              return (
                <li key={`${evidence.kind}-${evidence.label}-${index}`}>
                  <div>
                    <strong>{evidence.label}</strong>
                    <small>
                      {evidence.source ?? evidence.kind}
                      {evidence.observedAt
                        ? ` · ${formatDate(evidence.observedAt, true)}`
                        : ""}
                    </small>
                  </div>
                  {value ? <code>{value}</code> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="muted-copy">
          This finding has no structured evidence payload. Review the rule, URL,
          and audit history before classifying it.
        </p>
      )}

      <form className="issue-adjudication-form" onSubmit={submit}>
        <fieldset>
          <legend>Review decision</legend>
          <label>
            <input
              type="radio"
              name={`issue-status-${item.issue.fingerprint}`}
              value="open"
              checked={status === "open"}
              onChange={() => {
                setStatus("open");
                setConfirmed(false);
              }}
            />
            <span>
              <strong>Keep actionable</strong>
              <small>
                Remove any manual override and evaluate future runs normally.
              </small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name={`issue-status-${item.issue.fingerprint}`}
              value="ignored"
              checked={status === "ignored"}
              onChange={() => {
                setStatus("ignored");
                setConfirmed(false);
              }}
            />
            <span>
              <strong>Ignore intentionally</strong>
              <small>
                The behavior is real, understood, and accepted for this site.
              </small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name={`issue-status-${item.issue.fingerprint}`}
              value="false_positive"
              checked={status === "false_positive"}
              onChange={() => {
                setStatus("false_positive");
                setConfirmed(false);
              }}
            />
            <span>
              <strong>Mark false positive</strong>
              <small>
                The rule does not correctly describe this page or
                implementation.
              </small>
            </span>
          </label>
        </fieldset>

        <label htmlFor={`issue-note-${item.issue.fingerprint}`}>
          Review reason {noteRequired ? "(required)" : "(optional)"}
          <textarea
            id={`issue-note-${item.issue.fingerprint}`}
            value={note}
            minLength={noteRequired ? 3 : undefined}
            maxLength={2_000}
            required={noteRequired}
            rows={4}
            placeholder="Explain the site context so another marketer can verify this decision later."
            onChange={(event) => {
              setNote(event.currentTarget.value);
              setConfirmed(false);
            }}
          />
          <small>{formatNumber(note.length)} / 2,000 characters</small>
        </label>

        {noteRequired ? (
          <label className="issue-review-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            <span>
              I reviewed the evidence. Keep this classification on future audits
              until someone reopens it.
            </span>
          </label>
        ) : null}

        {mutation.isError ? (
          <p className="form-error" role="alert">
            {mutation.error.message}
          </p>
        ) : null}
        {mutation.isSuccess ? (
          <p className="form-success" role="status">
            Review saved. Actions and overview priorities were refreshed.
          </p>
        ) : null}

        <div className="form-actions">
          <Button type="submit" disabled={!canSave}>
            {mutation.isPending ? "Saving…" : "Save review"}
          </Button>
          <span className="muted-copy">
            Raw audit evidence and history are never deleted.
          </span>
        </div>
      </form>
    </Card>
  );
}

export function IssuesPage() {
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState<IssueStatus | "all">("open");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [offset, setOffset] = useState(0);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(
    null,
  );

  useEffect(() => setOffset(0), [deferredSearch, severity, status, siteId]);

  const filters = useMemo<IssueReviewFilters>(
    () => ({
      limit: PAGE_SIZE,
      offset,
      ...(status === "all" ? {} : { status }),
      ...(severity === "all" ? {} : { severity }),
      ...(deferredSearch ? { search: deferredSearch } : {}),
    }),
    [deferredSearch, offset, severity, status],
  );
  const query = useIssues(siteId, filters);
  const page = query.data?.data;
  const items = page?.items ?? [];
  const selected =
    items.find((item) => item.issue.fingerprint === selectedFingerprint) ??
    null;
  const end = page ? Math.min(page.offset + page.items.length, page.total) : 0;
  const filtersActive =
    search.length > 0 || status !== "open" || severity !== "all";

  function resetFilters() {
    setSearch("");
    setStatus("open");
    setSeverity("all");
    setOffset(0);
    setSelectedFingerprint(null);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Quality control"
        title="Issue review"
        description="Inspect crawl evidence, document intentional exceptions, and keep false positives out of future priorities without erasing audit history."
      />
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          <section
            className="workbench-controls"
            aria-labelledby="issue-filter-title"
          >
            <div className="workbench-control-heading">
              <div>
                <h2 id="issue-filter-title">
                  Separate signal from accepted behavior
                </h2>
                <p>
                  Search titles, rules, modules, fingerprints, and canonical
                  URLs. Decisions are scoped to the selected site.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFilters}
                disabled={!filtersActive}
              >
                Reset filters
              </Button>
            </div>
            <div className="workbench-filter-grid issue-filter-grid">
              <label className="workbench-search">
                <span>Search issues</span>
                <span className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={search}
                    maxLength={160}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    placeholder="Rule, URL, title, fingerprint…"
                  />
                </span>
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as IssueStatus | "all")
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved by audit</option>
                  <option value="ignored">Ignored intentionally</option>
                  <option value="false_positive">False positives</option>
                </select>
              </label>
              <label>
                Severity
                <select
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.currentTarget.value as Severity | "all")
                  }
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </label>
            </div>
          </section>

          {page && page.total > 0 ? (
            <>
              <p
                className="workbench-result-count"
                role="status"
                aria-live="polite"
              >
                Showing {formatNumber(page.offset + 1)}–{formatNumber(end)} of{" "}
                {formatNumber(page.total)} issues
              </p>
              <div className="table-shell issue-review-table">
                <table aria-label="SEO issues awaiting or carrying review decisions">
                  <thead>
                    <tr>
                      <th scope="col">Severity</th>
                      <th scope="col">Issue</th>
                      <th scope="col">URL</th>
                      <th scope="col">Status</th>
                      <th scope="col">Occurrences</th>
                      <th scope="col">Last seen</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const url = safeExternalUrl(item.issue.canonicalUrl);
                      const active =
                        selectedFingerprint === item.issue.fingerprint;
                      return (
                        <tr key={item.issue.fingerprint}>
                          <td>
                            <StatusBadge status={item.issue.severity} />
                          </td>
                          <td>
                            <div className="issue-title-cell">
                              <strong>{item.issue.title}</strong>
                              <small>
                                {item.issue.ruleId} · {item.issue.moduleId}
                              </small>
                            </div>
                          </td>
                          <td>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="issue-url"
                              >
                                {item.issue.canonicalUrl}
                              </a>
                            ) : (
                              <span className="muted-copy">Site-wide</span>
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              status={item.issue.status}
                              label={displayLabel(item.issue.status)}
                            />
                          </td>
                          <td>{formatNumber(item.occurrenceCount)}</td>
                          <td>{formatDate(item.issue.lastSeenAt, true)}</td>
                          <td>
                            <Button
                              type="button"
                              variant={active ? "secondary" : "ghost"}
                              aria-expanded={active}
                              aria-controls="issue-review-panel"
                              onClick={() =>
                                setSelectedFingerprint(
                                  active ? null : item.issue.fingerprint,
                                )
                              }
                            >
                              {active ? "Hide" : "Review"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <nav className="pagination-controls" aria-label="Issue pages">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page.offset === 0}
                  onClick={() => {
                    setOffset(Math.max(0, page.offset - page.limit));
                    setSelectedFingerprint(null);
                  }}
                >
                  Previous
                </Button>
                <span>
                  Page {formatNumber(Math.floor(page.offset / page.limit) + 1)}{" "}
                  of{" "}
                  {formatNumber(
                    Math.max(1, Math.ceil(page.total / page.limit)),
                  )}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page.offset + page.limit >= page.total}
                  onClick={() => {
                    setOffset(page.offset + page.limit);
                    setSelectedFingerprint(null);
                  }}
                >
                  Next
                </Button>
              </nav>
            </>
          ) : (
            <EmptyState
              title={filtersActive ? "No issues match" : "No open issues"}
              description={
                filtersActive
                  ? "Broaden the filters or search another rule, module, title, or URL."
                  : "Run an audit to collect issue evidence, or switch the status filter to review resolved findings."
              }
            />
          )}

          {selected ? (
            <div id="issue-review-panel">
              <IssueReviewEditor
                key={selected.issue.fingerprint}
                item={selected}
                siteId={siteId}
                onClose={() => setSelectedFingerprint(null)}
              />
            </div>
          ) : null}
        </QueryState>
      </CapabilityGate>
    </div>
  );
}
