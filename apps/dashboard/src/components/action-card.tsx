import type { ActionStatus, SeoAction } from "../api/contracts";
import { Card, StatusBadge, formatNumber } from "./ui";

const ACTION_STATUSES: readonly ActionStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
];

function labelOrUnavailable(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Unavailable";
}

export function ActionCard({
  action,
  rank,
  onStatusChange,
  isUpdating = false,
  updateError,
}: {
  action: SeoAction;
  rank?: number;
  onStatusChange?: (actionId: string, status: ActionStatus) => void;
  isUpdating?: boolean;
  updateError?: string;
}) {
  const evidence = action.evidence ?? [];
  return (
    <Card className="action-card">
      <div className="action-card-topline">
        <div className="action-rank">
          {rank ? `#${rank}` : (action.category ?? "Action")}
        </div>
        <StatusBadge
          status={action.priority ?? "unknown"}
          label={`${labelOrUnavailable(action.priority)} priority`}
        />
      </div>
      <div>
        <h3>{action.title}</h3>
        <p>{action.summary}</p>
      </div>
      <dl className="action-factors" aria-label="Priority factors">
        <div>
          <dt>Impact</dt>
          <dd>{labelOrUnavailable(action.impact)}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>{labelOrUnavailable(action.effort)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            {action.confidence === null || action.confidence === undefined
              ? "Unavailable"
              : `${formatNumber(action.confidence * 100)}%`}
          </dd>
        </div>
        <div>
          <dt>Priority score</dt>
          <dd>{formatNumber(action.priorityScore)}</dd>
        </div>
      </dl>
      <div className="action-workflow">
        <span>Workflow status</span>
        {onStatusChange ? (
          <select
            aria-label={`Workflow status for ${action.title}`}
            value={action.status ?? "open"}
            disabled={isUpdating}
            onChange={(event) =>
              onStatusChange(
                action.id,
                event.currentTarget.value as ActionStatus,
              )
            }
          >
            {ACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelOrUnavailable(status)}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={action.status ?? "unknown"} />
        )}
        {isUpdating ? <small role="status">Saving status…</small> : null}
        {updateError ? (
          <small className="action-update-error" role="alert">
            {updateError}
          </small>
        ) : null}
      </div>
      <div className="priority-reason">
        <span>Why this is prioritized</span>
        <p>
          {action.priorityExplanation ??
            "The API did not provide a priority explanation."}
        </p>
      </div>
      <details className="action-evidence">
        <summary>Evidence and scope</summary>
        {evidence.length > 0 ? (
          <ul>
            {evidence.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                <span>{item.label}</span>
                <strong>
                  {item.value === null || item.value === undefined
                    ? "Unavailable"
                    : String(item.value)}
                </strong>
                {item.source ? <small>{item.source}</small> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No supporting evidence was returned for this action.</p>
        )}
      </details>
    </Card>
  );
}
