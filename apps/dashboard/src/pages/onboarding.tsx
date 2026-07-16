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
import { exactUrlHostname } from "../lib/url";
import { Icon } from "../components/icon";
import {
  Button,
  Card,
  InlineNotice,
  PageHeader,
  StatusBadge,
} from "../components/ui";

const goals = [
  {
    id: "technical_health",
    title: "Improve technical health",
    description:
      "Prioritize indexability, crawlability, performance, and regressions.",
    runGoal: "Improve technical health, indexability, and crawl performance",
  },
  {
    id: "qualified_traffic",
    title: "Grow qualified traffic",
    description: "Find pages and queries with the strongest realistic upside.",
    runGoal:
      "Grow qualified organic traffic from existing and new search demand",
  },
  {
    id: "organic_key_events",
    title: "Increase organic key events",
    description: "Weight recommendations by analytics and conversion exposure.",
    runGoal: "Increase organic key events from search traffic",
  },
  {
    id: "content_opportunities",
    title: "Plan content opportunities",
    description:
      "Surface topic gaps and turn demand into an evidence-backed plan.",
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
  return `golem-seo:onboarding:v1:${siteId}`;
}

function readPreferences(siteId: string): OnboardingPreferences {
  if (!siteId) return emptyPreferences;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(preferencesKey(siteId)) ?? "{}",
    ) as Partial<OnboardingPreferences>;
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
  const dataReady = connectedCount > 0 || preferences.crawlOnly;
  const baselineReady = completedRuns > 0;
  const actionsReviewed = preferences.actionsReviewed || monitoringActive;

  const progressSteps = [
    {
      label: "Add a site",
      description: "Set the property you want to improve.",
      complete: Boolean(siteId),
    },
    {
      label: "Connect data",
      description: "Connect a source or choose crawl-only analysis.",
      complete: dataReady,
    },
    {
      label: "Choose a goal",
      description: "Tell the audit what outcome matters now.",
      complete: Boolean(selectedGoal),
    },
    {
      label: "Run a baseline",
      description: "Create your first technical snapshot.",
      complete: baselineReady,
    },
    {
      label: "Review actions",
      description: "Choose the highest-value next move.",
      complete: actionsReviewed,
    },
    {
      label: "Activate monitoring",
      description: "Schedule repeat audits for regressions.",
      complete: monitoringActive,
    },
  ];
  const currentStep = progressSteps.findIndex((step) => !step.complete);
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
    createSite.mutate(
      {
        name: String(form.get("name") ?? "").trim(),
        url: String(form.get("url") ?? "").trim(),
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
        eyebrow="Guided setup"
        title="Reach your first useful insight"
        description="Add a property, choose the evidence and outcome, run a baseline, then activate repeat monitoring."
      />
      {sitesError ? (
        <InlineNotice tone="danger" title="The local API is unavailable">
          {sitesError.message}
        </InlineNotice>
      ) : null}
      <div className="onboarding-layout">
        <div>
          <p id="onboarding-progress-summary" className="sr-only">
            Step {currentStepIndex + 1} of {progressSteps.length}:{" "}
            {progressSteps[currentStepIndex]?.label}.
          </p>
          <ol
            className="step-list"
            aria-label="Onboarding progress"
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
                        ? "Completed."
                        : current
                          ? "Current step."
                          : "Not completed."}
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
              <span className="step-kicker">Checking local API</span>
              <h2>Loading your workspace…</h2>
              <p>
                The dashboard is confirming whether a site is already
                configured.
              </p>
            </Card>
          ) : null}
          {!siteId && !sitesLoading ? (
            <Card className="onboarding-card">
              <span className="step-kicker">Step 1 of 6</span>
              <h2>Add your first site</h2>
              <p>
                Use the canonical public URL. The API will store the workspace
                and prepare it for integrations.
              </p>
              {createSite.isError ? (
                <InlineNotice tone="danger" title="Site was not added">
                  {createSite.error.message}
                </InlineNotice>
              ) : null}
              {created ? (
                <InlineNotice tone="success" title="Site added">
                  Continue by connecting at least one source or choosing
                  crawl-only analysis.
                </InlineNotice>
              ) : null}
              <form className="onboarding-form" onSubmit={submitSite}>
                <label>
                  Workspace name
                  <input
                    name="name"
                    required
                    placeholder="Acme marketing site"
                  />
                </label>
                <label>
                  Canonical URL
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="https://example.com"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={createSite.isPending || Boolean(sitesError)}
                >
                  {createSite.isPending ? "Adding site…" : "Add site"}{" "}
                  <Icon name="arrow" />
                </Button>
              </form>
            </Card>
          ) : null}
          {siteId ? (
            <>
              <Card className="onboarding-card onboarding-summary">
                <div>
                  <span className="step-kicker">Active property</span>
                  <h2>{site?.name}</h2>
                  <p>{site?.url}</p>
                </div>
                <StatusBadge status={site?.status ?? "active"} />
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">Step 2 of 6</span>
                <h2>Choose your evidence</h2>
                <p>
                  Connect platforms your team trusts, or start with crawl data
                  and add integrations later. Missing sources reduce confidence;
                  they never become fake zeroes.
                </p>
                <div className="onboarding-stat">
                  <strong>
                    {integrationsQuery.isError ? "Unavailable" : connectedCount}
                  </strong>
                  <span>connected integrations</span>
                </div>
                {preferences.crawlOnly && connectedCount === 0 ? (
                  <InlineNotice
                    tone="info"
                    title="Crawl-only analysis selected"
                  >
                    The baseline can run now. Connect GSC or GA4 later to
                    improve confidence and exposure scoring.
                  </InlineNotice>
                ) : null}
                <div className="form-actions">
                  <Link to="/integrations" className="button button-secondary">
                    Manage integrations <Icon name="arrow" />
                  </Link>
                  {connectedCount === 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={preferences.crawlOnly}
                      onClick={() => updatePreferences({ crawlOnly: true })}
                    >
                      Continue with crawl data only
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">Step 3 of 6</span>
                <h2>Choose the outcome that matters now</h2>
                <p>
                  The selected goal is stored with the audit run so its purpose
                  is explicit in history and agent workflows.
                </p>
                <div
                  className="goal-choice-grid"
                  role="group"
                  aria-label="Primary SEO goal"
                >
                  {goals.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      className={`goal-choice ${preferences.goal === goal.id ? "goal-choice-selected" : ""}`}
                      aria-pressed={preferences.goal === goal.id}
                      onClick={() => updatePreferences({ goal: goal.id })}
                    >
                      <strong>{goal.title}</strong>
                      <span>{goal.description}</span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">Step 4 of 6</span>
                <h2>Build the baseline</h2>
                <p>
                  A full audit gives actions URL-level evidence and creates a
                  reference point for monitoring.
                </p>
                {!selectedGoal ? (
                  <InlineNotice tone="warning" title="Choose a goal first">
                    Select the outcome above before starting the baseline.
                  </InlineNotice>
                ) : null}
                {startAudit.isError ? (
                  <InlineNotice tone="danger" title="Audit could not start">
                    {startAudit.error.message}
                  </InlineNotice>
                ) : null}
                {startAudit.isSuccess ? (
                  <InlineNotice tone="success" title="Audit queued">
                    Track the run from audit history. Actions unlock only after
                    a completed or partial result is available.
                  </InlineNotice>
                ) : null}
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
                          Allow this exact hostname to access a private network
                          for this audit
                        </strong>
                        <small>
                          {privateAccessHost} only. Loopback and private
                          addresses remain blocked unless you approve this host;
                          cloud metadata always stays blocked.
                        </small>
                      </span>
                    </label>
                  </details>
                ) : null}
                <div className="form-actions">
                  <Button
                    type="button"
                    onClick={startBaseline}
                    disabled={startAudit.isPending || !selectedGoal}
                  >
                    {startAudit.isPending
                      ? "Starting audit…"
                      : "Run baseline audit"}
                  </Button>
                  <Link to="/audits" className="button button-ghost">
                    View audit history
                  </Link>
                </div>
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">Step 5 of 6</span>
                <h2>Choose the first move</h2>
                <p>
                  Compare impact, effort, confidence, and source evidence before
                  committing resources. This step unlocks only after the
                  baseline produces a completed or partial result.
                </p>
                {baselineReady ? (
                  <Link
                    to="/actions"
                    className="button button-primary"
                    onClick={() => updatePreferences({ actionsReviewed: true })}
                  >
                    Review prioritized actions <Icon name="arrow" />
                  </Link>
                ) : (
                  <Button
                    type="button"
                    disabled
                    aria-describedby="actions-locked-reason"
                  >
                    Review prioritized actions
                  </Button>
                )}
                {!baselineReady ? (
                  <p
                    id="actions-locked-reason"
                    className="onboarding-lock-reason"
                  >
                    Waiting for a completed baseline run.
                  </p>
                ) : null}
              </Card>

              <Card className="onboarding-card">
                <span className="step-kicker">Step 6 of 6</span>
                <h2>Activate local monitoring</h2>
                <p>
                  Create a durable weekly audit at 06:00 every Monday in your
                  local timezone. You can change the cadence from Monitoring.
                </p>
                {createMonitoring.isError ? (
                  <InlineNotice
                    tone="danger"
                    title="Monitoring was not activated"
                  >
                    {createMonitoring.error.message}
                  </InlineNotice>
                ) : null}
                {createMonitoring.isSuccess ? (
                  <InlineNotice tone="success" title="Monitoring activated">
                    The local background service will run the weekly schedule
                    while it is available.
                  </InlineNotice>
                ) : null}
                {monitoringActive ? (
                  <InlineNotice tone="success" title="Monitoring is active">
                    At least one enabled schedule protects this property.
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
                        ? "Activating monitoring…"
                        : "Activate weekly monitoring"}
                    </Button>
                  ) : null}
                  <Link to="/monitoring" className="button button-secondary">
                    Manage monitoring
                  </Link>
                </div>
                {!monitoringActive && (!baselineReady || !actionsReviewed) ? (
                  <p className="onboarding-lock-reason">
                    Complete the baseline and open prioritized actions before
                    activating monitoring.
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
