import { useState, type FormEvent } from "react";
import type { MonitoringSchedule } from "../api/contracts";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMonitoring,
  useUpdateSchedule,
} from "../api/queries";
import { useSite } from "../context/site-context";
import {
  CapabilityGate,
  FreshnessNotice,
  QueryState,
} from "../components/data-state";
import { NEEDS_WEBSITE, useWorkspaceCapabilities } from "../lib/capabilities";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  formatDate,
} from "../components/ui";

type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";

/**
 * The editor offers the two workflows it has affordances for, but a schedule
 * created over the API can name any registered workflow — editing one must
 * never silently retarget it, so the raw id is carried through as-is.
 */
type ScheduleWorkflow = string;

interface ScheduleEditor {
  id: string | null;
  workflow: ScheduleWorkflow;
  frequency: ScheduleFrequency;
  time: string;
  weekday: string;
  cron: string;
  timezone: string;
  enabled: boolean;
}

const WEEKDAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
] as const;

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function blankEditor(): ScheduleEditor {
  return {
    id: null,
    workflow: "audit",
    frequency: "daily",
    time: "06:00",
    weekday: "1",
    cron: "0 6 * * *",
    timezone: localTimezone(),
    enabled: true,
  };
}

function scheduleWorkflow(schedule: MonitoringSchedule): ScheduleWorkflow {
  return schedule.workflowId ?? "audit";
}

function editorForSchedule(schedule: MonitoringSchedule): ScheduleEditor {
  const cron = schedule.cron ?? schedule.cadence;
  const monthly = /^(\d{1,2})\s+(\d{1,2})\s+1\s+\*\s+\*$/u.exec(cron.trim());
  if (monthly) {
    return {
      id: schedule.id,
      workflow: scheduleWorkflow(schedule),
      frequency: "monthly",
      time: `${monthly[2]!.padStart(2, "0")}:${monthly[1]!.padStart(2, "0")}`,
      weekday: "1",
      cron,
      timezone: schedule.timezone ?? localTimezone(),
      enabled: schedule.enabled,
    };
  }
  const match = /^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\*|[0-7])$/u.exec(
    cron.trim(),
  );
  if (!match) {
    return {
      id: schedule.id,
      workflow: scheduleWorkflow(schedule),
      frequency: "custom",
      time: "06:00",
      weekday: "1",
      cron,
      timezone: schedule.timezone ?? localTimezone(),
      enabled: schedule.enabled,
    };
  }
  const minute = match[1]!.padStart(2, "0");
  const hour = match[2]!.padStart(2, "0");
  const weekday = match[3] === "7" ? "0" : match[3]!;
  return {
    id: schedule.id,
    workflow: scheduleWorkflow(schedule),
    frequency: weekday === "*" ? "daily" : "weekly",
    time: `${hour}:${minute}`,
    weekday: weekday === "*" ? "1" : weekday,
    cron,
    timezone: schedule.timezone ?? localTimezone(),
    enabled: schedule.enabled,
  };
}

function cronForEditor(editor: ScheduleEditor): string {
  if (editor.frequency === "custom") return editor.cron.trim();
  const [hour = "6", minute = "0"] = editor.time.split(":");
  if (editor.frequency === "monthly")
    return `${Number(minute)} ${Number(hour)} 1 * *`;
  return `${Number(minute)} ${Number(hour)} * * ${editor.frequency === "weekly" ? editor.weekday : "*"}`;
}

function cadenceLabel(schedule: MonitoringSchedule): string {
  const cron = schedule.cron ?? schedule.cadence;
  const monthly = /^(\d{1,2})\s+(\d{1,2})\s+1\s+\*\s+\*$/u.exec(cron.trim());
  if (monthly) {
    return `Monthly on the 1st at ${monthly[2]!.padStart(2, "0")}:${monthly[1]!.padStart(2, "0")}`;
  }
  const match = /^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\*|[0-7])$/u.exec(
    cron.trim(),
  );
  if (!match) return cron;
  const time = `${match[2]!.padStart(2, "0")}:${match[1]!.padStart(2, "0")}`;
  if (match[3] === "*") return `Daily at ${time}`;
  const normalizedWeekday = match[3] === "7" ? "0" : match[3]!;
  const weekday =
    WEEKDAYS.find((item) => item.value === normalizedWeekday)?.label ??
    `day ${match[3]}`;
  return `Every ${weekday} at ${time}`;
}

export function MonitoringPage() {
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const query = useMonitoring(siteId);
  const createSchedule = useCreateSchedule(siteId);
  const updateSchedule = useUpdateSchedule(siteId);
  const deleteSchedule = useDeleteSchedule(siteId);
  const [editor, setEditor] = useState<ScheduleEditor>(blankEditor);
  const schedules = query.data?.data.schedules ?? [];
  const alerts = query.data?.data.alerts ?? [];
  const mutationError =
    createSchedule.error ?? updateSchedule.error ?? deleteSchedule.error;
  const editorPending =
    createSchedule.isPending ||
    (updateSchedule.isPending &&
      updateSchedule.variables?.scheduleId === editor.id);

  function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      cron: cronForEditor(editor),
      timezone: editor.timezone.trim(),
      enabled: editor.enabled,
      workflowId: editor.workflow,
    };
    if (editor.id) {
      updateSchedule.mutate(
        { scheduleId: editor.id, input },
        { onSuccess: () => setEditor(blankEditor()) },
      );
      return;
    }
    createSchedule.mutate(input, { onSuccess: () => setEditor(blankEditor()) });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Always-on assurance"
        title="Monitoring"
        description="Schedule local audits and surface regressions before they become reporting surprises. Schedules run while the Marketingovo background service is active."
      />
      {mutationError ? (
        <InlineNotice tone="danger" title="Schedule change failed">
          {mutationError.message}
        </InlineNotice>
      ) : null}
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          <Card className="schedule-editor">
            <form onSubmit={submitSchedule}>
              <div className="schedule-editor-heading">
                <div>
                  <h2>{editor.id ? "Edit schedule" : "Create a schedule"}</h2>
                  <p>
                    Run a site audit or generate the cross-channel report on a
                    marketer-friendly cadence, or use a standard five-field cron
                    expression.
                  </p>
                </div>
                {editor.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditor(blankEditor())}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
              <div className="schedule-form-grid">
                <label>
                  What to run
                  <select
                    name="workflow"
                    value={editor.workflow}
                    onChange={(event) => {
                      const workflow = event.currentTarget.value;
                      setEditor((current) => ({ ...current, workflow }));
                    }}
                  >
                    <option value="audit">Site audit</option>
                    <option value="marketing-report">
                      Cross-channel report
                    </option>
                    {editor.workflow !== "audit" &&
                    editor.workflow !== "marketing-report" ? (
                      <option value={editor.workflow}>
                        {editor.workflow} (as created)
                      </option>
                    ) : null}
                  </select>
                </label>
                <label>
                  Frequency
                  <select
                    name="frequency"
                    value={editor.frequency}
                    onChange={(event) => {
                      const frequency = event.currentTarget
                        .value as ScheduleFrequency;
                      setEditor((current) => ({ ...current, frequency }));
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly (1st)</option>
                    <option value="custom">Custom cron</option>
                  </select>
                </label>
                {editor.frequency === "custom" ? (
                  <label>
                    Cron expression
                    <input
                      name="cron"
                      value={editor.cron}
                      onChange={(event) => {
                        const cron = event.currentTarget.value;
                        setEditor((current) => ({ ...current, cron }));
                      }}
                      placeholder="0 6 * * 1"
                      required
                    />
                  </label>
                ) : (
                  <label>
                    Local time
                    <input
                      name="time"
                      type="time"
                      value={editor.time}
                      onChange={(event) => {
                        const time = event.currentTarget.value;
                        setEditor((current) => ({ ...current, time }));
                      }}
                      required
                    />
                  </label>
                )}
                {editor.frequency === "weekly" ? (
                  <label>
                    Day
                    <select
                      name="weekday"
                      value={editor.weekday}
                      onChange={(event) => {
                        const weekday = event.currentTarget.value;
                        setEditor((current) => ({ ...current, weekday }));
                      }}
                    >
                      {WEEKDAYS.map((weekday) => (
                        <option key={weekday.value} value={weekday.value}>
                          {weekday.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Timezone
                  <input
                    name="timezone"
                    value={editor.timezone}
                    onChange={(event) => {
                      const timezone = event.currentTarget.value;
                      setEditor((current) => ({ ...current, timezone }));
                    }}
                    placeholder="Europe/London"
                    required
                  />
                </label>
              </div>
              {editor.workflow === "marketing-report" ? (
                <InlineNotice tone="info" title="Reports quote audits">
                  A report only cites an audit that ran inside its own period.
                  Pair a report schedule with an audit schedule, or its organic
                  section will say it was not measured.
                </InlineNotice>
              ) : null}
              <div className="form-actions">
                <Button type="submit" disabled={editorPending || !siteId}>
                  {editorPending
                    ? "Saving…"
                    : editor.id
                      ? "Save schedule"
                      : "Create schedule"}
                </Button>
              </div>
            </form>
          </Card>
          <div className="two-column-grid monitoring-grid">
            <section>
              <SectionHeading
                title="Schedules"
                description="Durable audit schedules for this project."
              />
              {schedules.length > 0 ? (
                <div className="stack-list">
                  {schedules.map((schedule) => {
                    const rowPending =
                      (updateSchedule.isPending &&
                        updateSchedule.variables?.scheduleId === schedule.id) ||
                      (deleteSchedule.isPending &&
                        deleteSchedule.variables === schedule.id);
                    return (
                      <Card key={schedule.id} className="schedule-row">
                        <div className="schedule-main">
                          <button
                            type="button"
                            className={`schedule-toggle ${schedule.enabled ? "toggle-on" : ""}`}
                            aria-label={`${schedule.enabled ? "Pause" : "Enable"} ${schedule.name} schedule`}
                            aria-pressed={schedule.enabled}
                            disabled={rowPending}
                            onClick={() =>
                              updateSchedule.mutate({
                                scheduleId: schedule.id,
                                input: { enabled: !schedule.enabled },
                              })
                            }
                          />
                          <div>
                            <h3>{schedule.name}</h3>
                            <p>
                              {cadenceLabel(schedule)} ·{" "}
                              {schedule.timezone ?? "Timezone unavailable"}
                            </p>
                          </div>
                        </div>
                        <div className="schedule-details">
                          <StatusBadge status={schedule.status ?? "unknown"} />
                          <small>
                            Next: {formatDate(schedule.nextRunAt, true)}
                          </small>
                          <div className="schedule-actions">
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={rowPending}
                              onClick={() =>
                                setEditor(editorForSchedule(schedule))
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              disabled={rowPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete the ${schedule.name} schedule?`,
                                  )
                                )
                                  deleteSchedule.mutate(schedule.id);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No schedules"
                  description="Create a schedule above to run repeat audits while the background service is active."
                />
              )}
            </section>
            <section>
              <SectionHeading
                title="Recent alerts"
                description="Open and acknowledged changes that need review."
              />
              {alerts.length > 0 ? (
                <div className="stack-list">
                  {alerts.map((alert) => (
                    <Card key={alert.id} className="alert-row">
                      <div className="alert-topline">
                        <StatusBadge status={alert.severity} />
                        <time>{formatDate(alert.createdAt, true)}</time>
                      </div>
                      <h3>{alert.title}</h3>
                      <p>
                        {alert.detail ?? "No additional detail was returned."}
                      </p>
                      <small>
                        Status:{" "}
                        {alert.status?.replaceAll("_", " ") ?? "Unavailable"}
                      </small>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No monitoring alerts"
                  description="A valid empty alert stream means no alerts were returned—not that every source is healthy."
                />
              )}
            </section>
          </div>
        </QueryState>
      </CapabilityGate>
    </div>
  );
}
