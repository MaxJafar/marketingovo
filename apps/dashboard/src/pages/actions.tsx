import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type {
  ActionEffort,
  ActionStatus,
  ActionVerification,
  PriorityLevel,
  SeoAction,
} from "../api/contracts";
import { useActions, useUpdateAction } from "../api/queries";
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
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
} from "../components/ui";

type PriorityFilter = "all" | PriorityLevel;
type StatusFilter = "all" | ActionStatus;
type VerificationFilter = "all" | ActionVerification;
type EffortFilter = "all" | "low" | "medium" | "high";
type ActionSort = "priority" | "updated" | "affected" | "confidence";

const actionStatuses: readonly ActionStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
];

const verificationStates: readonly ActionVerification[] = [
  "pending",
  "verified",
  "regressed",
];

function displayLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function normalizedEffort(
  effort: ActionEffort | null | undefined,
): Exclude<EffortFilter, "all"> | null {
  if (effort === "small" || effort === "low") return "low";
  if (effort === "large" || effort === "high") return "high";
  return effort === "medium" ? "medium" : null;
}

function affectedCount(action: SeoAction): number | null {
  if (action.affectedUrlList) return action.affectedUrlList.length;
  return action.affectedUrls ?? null;
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareNumberDescending(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  return right - left;
}

export function ActionsPage() {
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const query = useActions(siteId);
  const updateAction = useUpdateAction(siteId);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [verification, setVerification] = useState<VerificationFilter>("all");
  const [effort, setEffort] = useState<EffortFilter>("all");
  const [sort, setSort] = useState<ActionSort>("priority");
  const actions = query.data?.data.items ?? [];

  const visibleActions = useMemo(() => {
    const filtered = actions.filter((action) => {
      const searchable = [
        action.title,
        action.summary,
        action.whyNow,
        action.moduleId,
        action.ruleId,
        action.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!deferredSearch || searchable.includes(deferredSearch)) &&
        (priority === "all" || action.priority === priority) &&
        (status === "all" || action.status === status) &&
        (verification === "all" || action.verification === verification) &&
        (effort === "all" || normalizedEffort(action.effort) === effort)
      );
    });

    return filtered.sort((left, right) => {
      if (sort === "updated")
        return timestamp(right.updatedAt) - timestamp(left.updatedAt);
      if (sort === "affected")
        return compareNumberDescending(
          affectedCount(left),
          affectedCount(right),
        );
      if (sort === "confidence")
        return compareNumberDescending(left.confidence, right.confidence);
      return compareNumberDescending(left.priorityScore, right.priorityScore);
    });
  }, [actions, deferredSearch, effort, priority, sort, status, verification]);

  const filtersActive =
    Boolean(search) ||
    priority !== "all" ||
    status !== "all" ||
    verification !== "all" ||
    effort !== "all" ||
    sort !== "priority";

  function resetFilters() {
    setSearch("");
    setPriority("all");
    setStatus("all");
    setVerification("all");
    setEffort("all");
    setSort("priority");
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Evidence-to-outcome workbench"
        title="Actions"
        description="Prioritize, investigate, assign, and verify SEO work without separating technical evidence from business exposure."
      />
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          {updateAction.isError ? (
            <InlineNotice tone="danger" title="Action status was not saved">
              {updateAction.error.message}
            </InlineNotice>
          ) : null}
          <section
            className="workbench-controls"
            aria-labelledby="action-filter-title"
          >
            <div className="workbench-control-heading">
              <div>
                <h2 id="action-filter-title">Find the work that matters now</h2>
                <p>
                  Search by recommendation, rule, module, or owner. Missing
                  evidence stays unavailable and never becomes zero.
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
            <div className="workbench-filter-grid">
              <label className="workbench-search">
                <span>Search actions</span>
                <span className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    placeholder="Canonical, broken links, owner…"
                  />
                </span>
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as StatusFilter)
                  }
                >
                  <option value="all">All statuses</option>
                  {actionStatuses.map((value) => (
                    <option key={value} value={value}>
                      {displayLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Verification
                <select
                  value={verification}
                  onChange={(event) =>
                    setVerification(
                      event.currentTarget.value as VerificationFilter,
                    )
                  }
                >
                  <option value="all">All verification</option>
                  {verificationStates.map((value) => (
                    <option key={value} value={value}>
                      {displayLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Effort
                <select
                  value={effort}
                  onChange={(event) =>
                    setEffort(event.currentTarget.value as EffortFilter)
                  }
                >
                  <option value="all">All effort</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                Sort by
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.currentTarget.value as ActionSort)
                  }
                >
                  <option value="priority">Priority score</option>
                  <option value="updated">Most recently updated</option>
                  <option value="affected">Affected URLs</option>
                  <option value="confidence">Confidence</option>
                </select>
              </label>
            </div>
            <fieldset className="priority-filter-fieldset">
              <legend>Priority</legend>
              <div
                className="filter-bar"
                role="group"
                aria-label="Filter actions by priority"
              >
                {(["all", "critical", "high", "medium", "low"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      className={priority === value ? "filter-active" : ""}
                      aria-pressed={priority === value}
                      onClick={() => setPriority(value)}
                    >
                      {value[0].toUpperCase() + value.slice(1)}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
          </section>

          <p
            className="workbench-result-count"
            role="status"
            aria-live="polite"
          >
            Showing {formatNumber(visibleActions.length)} of{" "}
            {formatNumber(actions.length)} actions
          </p>

          {visibleActions.length > 0 ? (
            <div className="table-shell action-workbench-table">
              <table aria-label="Prioritized SEO actions">
                <thead>
                  <tr>
                    <th scope="col">Priority</th>
                    <th scope="col">Action and evidence group</th>
                    <th scope="col">Scope</th>
                    <th scope="col">Effort</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Workflow</th>
                    <th scope="col">Verification</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleActions.map((action) => {
                    const isUpdating =
                      updateAction.isPending &&
                      updateAction.variables?.actionId === action.id;
                    const count = affectedCount(action);
                    return (
                      <tr key={action.id}>
                        <td>
                          <div className="priority-cell">
                            <strong>
                              {formatNumber(action.priorityScore)}
                            </strong>
                            <StatusBadge
                              status={action.priority ?? "unknown"}
                              label={action.priority ?? "Unavailable"}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="action-title-cell">
                            <Link
                              to="/actions/$actionId"
                              params={{ actionId: action.id }}
                              className="table-link"
                            >
                              {action.title}
                            </Link>
                            <p>{action.summary}</p>
                            <small>
                              {action.moduleId ?? "Module unavailable"} ·{" "}
                              {action.ruleId ?? "Rule unavailable"}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div className="scope-cell">
                            <strong>{formatNumber(count)}</strong>
                            <span>affected URLs</span>
                            {action.trafficAtRisk !== null &&
                            action.trafficAtRisk !== undefined ? (
                              <small>
                                {formatNumber(action.trafficAtRisk)} organic
                                visits exposed
                              </small>
                            ) : (
                              <small>Business exposure unavailable</small>
                            )}
                          </div>
                        </td>
                        <td>
                          {normalizedEffort(action.effort) ? (
                            <StatusBadge
                              status={normalizedEffort(action.effort)!}
                            />
                          ) : (
                            "Unavailable"
                          )}
                        </td>
                        <td>
                          {action.confidence === null ||
                          action.confidence === undefined
                            ? "Unavailable"
                            : `${formatNumber(action.confidence * 100)}%`}
                        </td>
                        <td>
                          <label className="table-status-control">
                            <span className="sr-only">
                              Workflow status for {action.title}
                            </span>
                            <select
                              aria-label={`Workflow status for ${action.title}`}
                              value={action.status ?? "open"}
                              disabled={isUpdating}
                              onChange={(event) =>
                                updateAction.mutate({
                                  actionId: action.id,
                                  status: event.currentTarget
                                    .value as ActionStatus,
                                })
                              }
                            >
                              {actionStatuses.map((value) => (
                                <option key={value} value={value}>
                                  {displayLabel(value)}
                                </option>
                              ))}
                            </select>
                            {isUpdating ? (
                              <small role="status">Saving…</small>
                            ) : null}
                          </label>
                        </td>
                        <td>
                          <StatusBadge
                            status={action.verification ?? "unknown"}
                            label={
                              action.verification
                                ? displayLabel(action.verification)
                                : "Unavailable"
                            }
                          />
                        </td>
                        <td>{formatDate(action.updatedAt, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                actions.length > 0
                  ? "No actions match these filters"
                  : "No prioritized actions yet"
              }
              description={
                actions.length > 0
                  ? "Reset one or more filters to return to the complete evidence-backed queue."
                  : "Run an audit to generate the first action queue. A valid empty result is never presented as a perfect score."
              }
              action={
                actions.length > 0 ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </QueryState>
      </CapabilityGate>
    </div>
  );
}
