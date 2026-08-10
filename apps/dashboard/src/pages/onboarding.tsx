import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  useCreateSchedule,
  useCreateSite,
  useIntegrations,
  useMonitoring,
  useRuns,
  useStartAudit,
} from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
import { exactUrlHostname } from "../lib/url";
import { Icon } from "../components/icon";
import {
  Button,
  Card,
  InlineNotice,
  PageHeader,
  StatusBadge,
} from "../components/ui";

/**
 * Goal cards. Titles and descriptions live in the `onboarding.goals` messages;
 * the runGoal is API data stored with the audit run, so it stays in the
 * reference language rather than varying with the interface locale.
 */
const goals = [
  {
    id: "technical_health",
    key: "technicalHealth",
    runGoal: "Improve technical health, indexability, and crawl performance",
  },
  {
    id: "qualified_traffic",
    key: "qualifiedTraffic",
    runGoal:
      "Grow qualified organic traffic from existing and new search demand",
  },
  {
    id: "organic_key_events",
    key: "organicKeyEvents",
    runGoal: "Increase organic key events from search traffic",
  },
  {
    id: "content_opportunities",
    key: "contentOpportunities",
    runGoal: "Build an evidence-backed organic content opportunity plan",
  },
] as const;

type GoalId = (typeof goals)[number]["id"];

interface OnboardingPreferences {
  goal: GoalId | "";
  crawlOnly: boolean;
  actionsReviewed: boolean;
}

const emptyPreferences: OnboardingPreferences = {
  goal: "",
  crawlOnly: false,
  actionsReviewed: false,
};

function preferencesKey(siteId: string): string {
  return `marketingovo:onboarding:v1:${siteId}`;
}

function readPreferences(siteId: string): OnboardingPreferences {
  if (!siteId) return emptyPreferences;
  try {
    const raw = window.localStorage.getItem(preferencesKey(siteId));
    const parsed = JSON.parse(raw ?? "{}") as Partial<OnboardingPreferences>;
    const validGoal = goals.some((goal) => goal.id === parsed.goal)
      ? (parsed.goal as GoalId)
      : "";
    return {
      goal: validGoal,
      crawlOnly: parsed.crawlOnly === true,
      actionsReviewed: parsed.actionsReviewed === true,
    };
  } catch {
    return emptyPreferences;
  }
}

function savePreferences(siteId: string, preferences: OnboardingPreferences) {
  if (!siteId) return;
  try {
    window.localStorage.setItem(
      preferencesKey(siteId),
      JSON.stringify(preferences),
    );
  } catch {
    // The setup remains usable when storage is unavailable; the run still gets its goal.
  }
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function OnboardingPage() {
  const { t } = useI18n();
  const {
    siteId,
    site,
    error: sitesError,
    isLoading: sitesLoading,
  } = useSite();
  const createSite = useCreateSite();
  const integrationsQuery = useIntegrations(siteId);
  const runsQuery = useRuns(siteId);
  const monitoringQuery = useMonitoring(siteId);
  const startAudit = useStartAudit();
  const createMonitoring = useCreateSchedule(siteId);
  const [created, setCreated] = useState(false);
  const [privateAccessApproved, setPrivateAccessApproved] = useState(false);
  const [preferences, setPreferences] = useState<OnboardingPreferences>(() =>
    readPreferences(siteId),
  );

  const privateAccessHost = useMemo(() => {
    return exactUrlHostname(site?.url);
  }, [site?.url]);

  const connectedCount = (integrationsQuery.data?.data.items ?? []).filter(
    (item) => item.status === "connected",
  ).length;
  const completedRuns = (runsQuery.data?.data.items ?? []).filter(
    (run) => run.status === "completed" || run.status === "partial",
  ).length;
  const monitoringActive = (monitoringQuery.data?.data.schedules ?? []).some(
    (schedule) => schedule.enabled,
  );
  const selectedGoal = goals.find((goal) => goal.id === preferences.goal);
  const hasWebsite = Boolean(site?.url);
  const dataReady = connectedCount > 0 || preferences.crawlOnly;
  const baselineReady = completedRuns > 0;
  const actionsReviewed = preferences.actionsReviewed || monitoringActive;

  const progressSteps = [
    {
      label: t.onboarding.steps.createWorkspace.label,
      description: t.onboarding.steps.createWorkspace.description,
      complete: Boolean(siteId),
    },
    {
      // Deliberately separate from workspace creation, and skippable. A
      // workspace doing social, ads or research work may never need one.
      label: t.onboarding.steps.addWebsite.label,
      description: t.onboarding.steps.addWebsite.description,
      complete: hasWebsite,
      optional: true,
    },
    {
      label: t.onboarding.steps.connectData.label,
      description: t.onboarding.steps.connectData.description,
      complete: dataReady,
    },
    {
      label: t.onboarding.steps.chooseGoal.label,
      description: t.onboarding.steps.chooseGoal.description,
      complete: Boolean(selectedGoal),
    },
    {
      label: t.onboarding.steps.runBaseline.label,
      description: t.onboarding.steps.runBaseline.description,
      complete: baselineReady,
    },
    {
      label: t.onboarding.steps.reviewActions.label,
      description: t.onboarding.steps.reviewActions.description,
      complete: actionsReviewed,
    },
    {
      label: t.onboarding.steps.activateMonitoring.label,
      description: t.onboarding.steps.activateMonitoring.description,
      complete: monitoringActive,
    },
  ];
  // An optional step never becomes "the current step". Pointing someone at a
  // skippable task as their next action is how an optional thing quietly
  // becomes mandatory again.
  const currentStep = progressSteps.findIndex(
    (step) => !step.complete && !step.optional,
  );
  const currentStepIndex =
    currentStep === -1 ? progressSteps.length - 1 : currentStep;

  useEffect(() => {
    setPrivateAccessApproved(false);
  }, [privateAccessHost]);

  useEffect(() => {
    setPreferences(readPreferences(siteId));
  }, [siteId]);

  function updatePreferences(update: Partial<OnboardingPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...update };
      savePreferences(siteId, next);
      return next;
    });
  }

  function submitSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    createSite.mutate(
      {
        name: String(form.get("name") ?? "").trim(),
        ...(url ? { url } : {}),
      },
      { onSuccess: () => setCreated(true) },
    );
  }

  function startBaseline() {
    if (!selectedGoal) return;
    startAudit.mutate({
      siteId,
      mode: "full",
      goal: selectedGoal.runGoal,
      ...(privateAccessApproved && privateAccessHost
        ? { privateHostAllowlist: [privateAccessHost] }
        : {}),
    });
  }

  function activateMonitoring() {
    createMonitoring.mutate({
      cron: "0 6 * * 1",
      timezone: localTimezone(),
      enabled: true,
    });
  }

  return (
    <div className="page-stack onboarding-page">
      <PageHeader
        eyebrow={t.onboarding.eyebrow}
        title={t.onboarding.title}
        description={t.onboarding.description}
      />
      {sitesError ? (
        <InlineNotice tone="danger" title={t.onboarding.apiUnavailableTitle}>
          {sitesError.message}
        </InlineNotice>
      ) : null}
      <div className="onboarding-layout">
        <div>
          <p id="onboarding-progress-summary" className="sr-only">
            {fmt(t.onboarding.progressSummary, {
              current: currentStepIndex + 1,
              total: progressSteps.length,
              label: progressSteps[currentStepIndex]?.label ?? "",
            })}
          </p>
          <ol
            className="step-list"
            aria-label={t.onboarding.progressLabel}
            aria-describedby="onboarding-progress-summary"
          >
            {progressSteps.map((step, index) => {
              const current = index === currentStepIndex && !monitoringActive;
              return (
                <li
                  key={step.label}
                  className={
                    step.complete
                      ? "step-complete"
                      : current
                        ? "step-current"
                        : ""
                  }
                  aria-current={current ? "step" : undefined}
                >
                  <span aria-hidden="true">
                    {step.complete ? <Icon name="check" /> : index + 1}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.description}</small>
                    <span className="sr-only">
                      {step.complete
                        ? t.onboarding.stepCompleted
                        : step.optional
                          ? t.onboarding.stepOptionalIncomplete
                          : current
                            ? t.onboarding.stepCurrent
                            : t.onboarding.stepIncomplete}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="onboarding-main">
          {sitesLoading ? (
            <Card className="onboarding-card" aria-busy="true">
              <span className="step-kicker">{t.onboarding.loading.kicker}</span>
              <h2>{t.onboarding.loading.title}</h2>
              <p>{t.onboarding.loading.body}</p>
            </Card>
          ) : null}
          {!siteId && !sitesLoading ? (
            <Card className="onboarding-card">
              <span className="step-kicker">{t.onboarding.create.kicker}</span>
              <h2>{t.onboarding.create.title}</h2>
              <p>{t.onboarding.create.body}</p>
              {createSite.isError ? (
                <InlineNotice
                  tone="danger"
                  title={t.onboarding.create.notAddedTitle}
                >
                  {createSite.error.message}
                </InlineNotice>
              ) : null}
              {created ? (
                <InlineNotice
                  tone="success"
                  title={t.onboarding.create.addedTitle}
                >
                  {t.onboarding.create.addedBody}
                </InlineNotice>
              ) : null}
              <form className="onboarding-form" onSubmit={submitSite}>
                <label>
                  {t.onboarding.create.nameLabel}
                  <input
                    name="name"
                    required
                    placeholder="Acme marketing site"
                  />
                </label>
                <label>
                  {t.onboarding.create.urlLabel}{" "}
                  <span className="optional">
                    {t.onboarding.create.optional}
                  </span>
                  <input
                    name="url"
                    type="url"
                    placeholder="https://example.com"
                  />
                  <small>{t.onboarding.create.urlHelp}</small>
                </label>
                <Button
                  type="submit"
                  disabled={createSite.isPending || Boolean(sitesError)}
                >
                  {createSite.isPending
                    ? t.onboarding.create.creating
                    : t.onboarding.create.submit}{" "}
                  <Icon name="arrow" />
                </Button>
              </form>
            </Card>
          ) : null}
          {siteId ? (
            <>
              <Card className="onboarding-card onboarding-summary">
                <div>
                  <span className="step-kicker">
                    {t.onboarding.workspace.kicker}
                  </span>
                  <h2>{site?.name}</h2>
                  <p>{site?.url ?? t.onboarding.workspace.noWebsite}</p>
                </div>
                <StatusBadge status={site?.status ?? "active"} />
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">
                  {t.onboarding.evidence.kicker}
                </span>
                <h2>{t.onboarding.evidence.title}</h2>
                <p>{t.onboarding.evidence.body}</p>
                <div className="onboarding-stat">
                  <strong>
                    {integrationsQuery.isError
                      ? t.common.unavailable
                      : connectedCount}
                  </strong>
                  <span>{t.onboarding.evidence.connectedIntegrations}</span>
                </div>
                {preferences.crawlOnly && connectedCount === 0 ? (
                  <InlineNotice
                    tone="info"
                    title={t.onboarding.evidence.crawlOnlyTitle}
                  >
                    {t.onboarding.evidence.crawlOnlyBody}
                  </InlineNotice>
                ) : null}
                <div className="form-actions">
                  <Link to="/integrations" className="button button-secondary">
                    {t.onboarding.evidence.manageIntegrations}{" "}
                    <Icon name="arrow" />
                  </Link>
                  {connectedCount === 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={preferences.crawlOnly}
                      onClick={() => updatePreferences({ crawlOnly: true })}
                    >
                      {t.onboarding.evidence.crawlOnlyButton}
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">{t.onboarding.goal.kicker}</span>
                <h2>{t.onboarding.goal.title}</h2>
                <p>{t.onboarding.goal.body}</p>
                <div
                  className="goal-choice-grid"
                  role="group"
                  aria-label={t.onboarding.goal.groupLabel}
                >
                  {goals.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      className={`goal-choice ${preferences.goal === goal.id ? "goal-choice-selected" : ""}`}
                      aria-pressed={preferences.goal === goal.id}
                      onClick={() => updatePreferences({ goal: goal.id })}
                    >
                      <strong>{t.onboarding.goals[goal.key].title}</strong>
                      <span>{t.onboarding.goals[goal.key].description}</span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">
                  {t.onboarding.baseline.kicker}
                </span>
                <h2>{t.onboarding.baseline.title}</h2>
                <p>{t.onboarding.baseline.body}</p>
                {!hasWebsite ? (
                  <InlineNotice
                    tone="info"
                    title={t.onboarding.baseline.needsWebsiteTitle}
                  >
                    {t.onboarding.baseline.needsWebsiteBefore}{" "}
                    <Link to="/settings">
                      {t.onboarding.baseline.needsWebsiteLink}
                    </Link>{" "}
                    {t.onboarding.baseline.needsWebsiteAfter}
                  </InlineNotice>
                ) : null}
                {hasWebsite && !selectedGoal ? (
                  <InlineNotice
                    tone="warning"
                    title={t.onboarding.baseline.chooseGoalTitle}
                  >
                    {t.onboarding.baseline.chooseGoalBody}
                  </InlineNotice>
                ) : null}
                {startAudit.isError ? (
                  <InlineNotice
                    tone="danger"
                    title={t.onboarding.baseline.notStartedTitle}
                  >
                    {startAudit.error.message}
                  </InlineNotice>
                ) : null}
                {startAudit.isSuccess ? (
                  <InlineNotice
                    tone="success"
                    title={t.onboarding.baseline.queuedTitle}
                  >
                    {t.onboarding.baseline.queuedBody}
                  </InlineNotice>
                ) : null}
                {privateAccessHost ? (
                  <details className="private-site-access">
                    <summary>
                      {t.onboarding.baseline.privateAccessSummary}
                    </summary>
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
                          {t.onboarding.baseline.privateAccessLabel}
                        </strong>
                        <small>
                          {fmt(t.onboarding.baseline.privateAccessHelp, {
                            host: privateAccessHost,
                          })}
                        </small>
                      </span>
                    </label>
                  </details>
                ) : null}
                <div className="form-actions">
                  <Button
                    type="button"
                    onClick={startBaseline}
                    disabled={
                      startAudit.isPending || !selectedGoal || !hasWebsite
                    }
                  >
                    {startAudit.isPending
                      ? t.onboarding.baseline.starting
                      : t.onboarding.baseline.run}
                  </Button>
                  <Link to="/audits" className="button button-ghost">
                    {t.onboarding.baseline.viewHistory}
                  </Link>
                </div>
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">
                  {t.onboarding.firstMove.kicker}
                </span>
                <h2>{t.onboarding.firstMove.title}</h2>
                <p>{t.onboarding.firstMove.body}</p>
                {baselineReady ? (
                  <Link
                    to="/actions"
                    className="button button-primary"
                    onClick={() => updatePreferences({ actionsReviewed: true })}
                  >
                    {t.onboarding.firstMove.reviewActions} <Icon name="arrow" />
                  </Link>
                ) : (
                  <Button
                    type="button"
                    disabled
                    aria-describedby="actions-locked-reason"
                  >
                    {t.onboarding.firstMove.reviewActions}
                  </Button>
                )}
                {!baselineReady ? (
                  <p
                    id="actions-locked-reason"
                    className="onboarding-lock-reason"
                  >
                    {t.onboarding.firstMove.lockedReason}
                  </p>
                ) : null}
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">
                  {t.onboarding.monitoring.kicker}
                </span>
                <h2>{t.onboarding.monitoring.title}</h2>
                <p>{t.onboarding.monitoring.body}</p>
                {createMonitoring.isError ? (
                  <InlineNotice
                    tone="danger"
                    title={t.onboarding.monitoring.notActivatedTitle}
                  >
                    {createMonitoring.error.message}
                  </InlineNotice>
                ) : null}
                {createMonitoring.isSuccess ? (
                  <InlineNotice
                    tone="success"
                    title={t.onboarding.monitoring.activatedTitle}
                  >
                    {t.onboarding.monitoring.activatedBody}
                  </InlineNotice>
                ) : null}
                {monitoringActive ? (
                  <InlineNotice
                    tone="success"
                    title={t.onboarding.monitoring.activeTitle}
                  >
                    {t.onboarding.monitoring.activeBody}
                  </InlineNotice>
                ) : null}
                <div className="form-actions">
                  {!monitoringActive ? (
                    <Button
                      type="button"
                      onClick={activateMonitoring}
                      disabled={
                        createMonitoring.isPending ||
                        !baselineReady ||
                        !actionsReviewed
                      }
                    >
                      {createMonitoring.isPending
                        ? t.onboarding.monitoring.activating
                        : t.onboarding.monitoring.activate}
                    </Button>
                  ) : null}
                  <Link to="/monitoring" className="button button-secondary">
                    {t.onboarding.monitoring.manage}
                  </Link>
                </div>
                {!monitoringActive && (!baselineReady || !actionsReviewed) ? (
                  <p className="onboarding-lock-reason">
                    {t.onboarding.monitoring.lockedReason}
                  </p>
                ) : null}
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
