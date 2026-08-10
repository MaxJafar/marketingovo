import { useState, type FormEvent } from "react";
import type { MonitoringSchedule } from "../api/contracts";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMonitoring,
  useUpdateSchedule,
} from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n, type Messages } from "../i18n";
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

const WEEKDAYS: ReadonlyArray<{
  value: string;
  key: keyof Messages["monitoring"]["weekdays"];
}> = [
  { value: "1", key: "monday" },
  { value: "2", key: "tuesday" },
  { value: "3", key: "wednesday" },
  { value: "4", key: "thursday" },
  { value: "5", key: "friday" },
  { value: "6", key: "saturday" },
  { value: "0", key: "sunday" },
];

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

function cadenceLabel(schedule: MonitoringSchedule, t: Messages): string {
  const cron = schedule.cron ?? schedule.cadence;
  const monthly = /^(\d{1,2})\s+(\d{1,2})\s+1\s+\*\s+\*$/u.exec(cron.trim());
  if (monthly) {
    return fmt(t.monitoring.cadenceMonthly, {
      time: `${monthly[2]!.padStart(2, "0")}:${monthly[1]!.padStart(2, "0")}`,
    });
  }
  const match = /^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\*|[0-7])$/u.exec(
    cron.trim(),
  );
  if (!match) return cron;
  const time = `${match[2]!.padStart(2, "0")}:${match[1]!.padStart(2, "0")}`;
  if (match[3] === "*") return fmt(t.monitoring.cadenceDaily, { time });
  const normalizedWeekday = match[3] === "7" ? "0" : match[3]!;
  const weekdayKey = WEEKDAYS.find(
    (item) => item.value === normalizedWeekday,
  )?.key;
  const weekday = weekdayKey
    ? t.monitoring.weekdays[weekdayKey]
    : fmt(t.monitoring.cadenceDayFallback, { day: match[3]! });
  return fmt(t.monitoring.cadenceWeekly, { weekday, time });
}

export function MonitoringPage() {
  const { t } = useI18n();
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
        eyebrow={t.monitoring.eyebrow}
        title={t.monitoring.title}
        description={t.monitoring.description}
      />
      {mutationError ? (
        <InlineNotice tone="danger" title={t.monitoring.mutationErrorTitle}>
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
                  <h2>
                    {editor.id
                      ? t.monitoring.editor.editTitle
                      : t.monitoring.editor.createTitle}
                  </h2>
                  <p>{t.monitoring.editor.intro}</p>
                </div>
                {editor.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditor(blankEditor())}
                  >
                    {t.monitoring.editor.cancelEdit}
                  </Button>
                ) : null}
              </div>
              <div className="schedule-form-grid">
                <label>
                  {t.monitoring.editor.workflowLabel}
                  <select
                    name="workflow"
                    value={editor.workflow}
                    onChange={(event) => {
                      const workflow = event.currentTarget.value;
                      setEditor((current) => ({ ...current, workflow }));
                    }}
                  >
                    <option value="audit">
                      {t.monitoring.editor.workflowAudit}
                    </option>
                    <option value="marketing-report">
                      {t.monitoring.editor.workflowReport}
                    </option>
                    {editor.workflow !== "audit" &&
                    editor.workflow !== "marketing-report" ? (
                      <option value={editor.workflow}>
                        {fmt(t.monitoring.editor.workflowAsCreated, {
                          workflow: editor.workflow,
                        })}
                      </option>
                    ) : null}
                  </select>
                </label>
                <label>
                  {t.monitoring.editor.frequencyLabel}
                  <select
                    name="frequency"
                    value={editor.frequency}
                    onChange={(event) => {
                      const frequency = event.currentTarget
                        .value as ScheduleFrequency;
                      setEditor((current) => ({ ...current, frequency }));
                    }}
                  >
                    <option value="daily">
                      {t.monitoring.editor.frequencyDaily}
                    </option>
                    <option value="weekly">
                      {t.monitoring.editor.frequencyWeekly}
                    </option>
                    <option value="monthly">
                      {t.monitoring.editor.frequencyMonthly}
                    </option>
                    <option value="custom">
                      {t.monitoring.editor.frequencyCustom}
                    </option>
                  </select>
                </label>
                {editor.frequency === "custom" ? (
                  <label>
                    {t.monitoring.editor.cronLabel}
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
                    {t.monitoring.editor.timeLabel}
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
                    {t.monitoring.editor.dayLabel}
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
                          {t.monitoring.weekdays[weekday.key]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  {t.monitoring.editor.timezoneLabel}
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
                <InlineNotice
                  tone="info"
                  title={t.monitoring.editor.reportNoticeTitle}
                >
                  {t.monitoring.editor.reportNoticeBody}
                </InlineNotice>
              ) : null}
              <div className="form-actions">
                <Button type="submit" disabled={editorPending || !siteId}>
                  {editorPending
                    ? t.monitoring.editor.saving
                    : editor.id
                      ? t.monitoring.editor.save
                      : t.monitoring.editor.create}
                </Button>
              </div>
            </form>
          </Card>
          <div className="two-column-grid monitoring-grid">
            <section>
              <SectionHeading
                title={t.monitoring.schedules.title}
                description={t.monitoring.schedules.description}
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
                            aria-label={fmt(
                              schedule.enabled
                                ? t.monitoring.schedules.pauseAria
                                : t.monitoring.schedules.enableAria,
                              { name: schedule.name },
                            )}
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
                              {cadenceLabel(schedule, t)} ·{" "}
                              {schedule.timezone ??
                                t.monitoring.schedules.timezoneUnavailable}
                            </p>
                          </div>
                        </div>
                        <div className="schedule-details">
                          <StatusBadge status={schedule.status ?? "unknown"} />
                          <small>
                            {fmt(t.monitoring.schedules.nextRun, {
                              date: formatDate(schedule.nextRunAt, true),
                            })}
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
                              {t.monitoring.schedules.edit}
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              disabled={rowPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    fmt(t.monitoring.schedules.deleteConfirm, {
                                      name: schedule.name,
                                    }),
                                  )
                                )
                                  deleteSchedule.mutate(schedule.id);
                              }}
                            >
                              {t.monitoring.schedules.delete}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title={t.monitoring.schedules.emptyTitle}
                  description={t.monitoring.schedules.emptyDescription}
                />
              )}
            </section>
            <section>
              <SectionHeading
                title={t.monitoring.alerts.title}
                description={t.monitoring.alerts.description}
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
                      <p>{alert.detail ?? t.monitoring.alerts.noDetail}</p>
                      <small>
                        {fmt(t.monitoring.alerts.status, {
                          status:
                            alert.status?.replaceAll("_", " ") ??
                            t.common.unavailable,
                        })}
                      </small>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t.monitoring.alerts.emptyTitle}
                  description={t.monitoring.alerts.emptyDescription}
                />
              )}
            </section>
          </div>
        </QueryState>
      </CapabilityGate>
    </div>
  );
}
