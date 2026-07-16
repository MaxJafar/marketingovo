import { lazy, Suspense, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntelClient } from "../api/client-context.js";
import { useRunEventStream } from "../api/use-run-event-stream.js";
import { EvidencePanel } from "../components/EvidencePanel.js";
import { RunTimeline } from "../components/RunTimeline.js";

const LazyMetricChart = lazy(async () => {
  const module = await import("../components/MetricChart.js");
  return { default: module.MetricChart };
});

const terminalStatuses = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export function ResearchPage(): React.JSX.Element {
  const client = useIntelClient();
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string>();
  const [workflow, setWorkflow] = useState<"compare" | "research">("compare");
  const [question, setQuestion] = useState(
    "Which monitored brand gained the most public audience momentum, and what evidence contradicts that conclusion?",
  );
  const [sourceBudget, setSourceBudget] = useState("4");
  const [simulate, setSimulate] = useState<
    "none" | "source_failure" | "corrupt_artifact" | "slow"
  >("none");
  useRunEventStream(activeRunId);

  const start = useMutation({
    mutationFn: () => {
      const target_ids = ["northstar-labs", "orbit-coffee", "vertex-studio"];
      if (workflow === "research") {
        return client.research.start({
          project_id: "competitive-pulse-demo",
          target_ids,
          question: question.trim(),
          source_budget: Number(sourceBudget),
        });
      }
      return client.comparisons.start({
        project_id: "competitive-pulse-demo",
        target_ids,
        goal: "Compare public growth, engagement quality and content cadence.",
        connector_ids: ["fixture.competitive-pulse"],
        simulate,
      });
    },
    onSuccess: (run) => setActiveRunId(run.id),
  });

  const runQuery = useQuery({
    queryKey: ["run", activeRunId],
    queryFn: () => client.runs.get(activeRunId!),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminalStatuses.has(status) ? false : 5000;
    },
  });

  const reportQuery = useQuery({
    queryKey: ["report", activeRunId],
    queryFn: () => client.runs.report(activeRunId!),
    enabled: Boolean(activeRunId) && Boolean(runQuery.data?.report_available),
  });

  const cancel = useMutation({
    mutationFn: () =>
      client.runs.cancel(activeRunId!, "Cancelled from dashboard"),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["run", activeRunId] }),
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    start.mutate();
  }

  const run = runQuery.data;
  const report = reportQuery.data;

  return (
    <div className="research-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">COMPETITIVE PULSE / RESEARCH</p>
          <h1>Trace the claim. Challenge the conclusion.</h1>
          <p>
            One replayable investigation from collection policy to cited
            evidence.
          </p>
        </div>
        <div className="runtime-chip">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Local runtime
            <small>Go · Python · Arrow</small>
          </span>
        </div>
      </header>

      <section className="research-launch" aria-labelledby="launch-title">
        <form onSubmit={submit}>
          <div className="launch-copy">
            <span className="step-number">01</span>
            <div>
              <h2 id="launch-title">
                {workflow === "research"
                  ? "Bounded research dossier"
                  : "Competitive comparison"}
              </h2>
              <p>
                Three synthetic brands · YouTube-style public observations ·
                zero live spend
              </p>
            </div>
          </div>
          <div className="launch-controls">
            <label htmlFor="workflow">Workflow</label>
            <select
              id="workflow"
              value={workflow}
              onChange={(event) =>
                setWorkflow(event.target.value as typeof workflow)
              }
            >
              <option value="compare">Compare</option>
              <option value="research">Research</option>
            </select>
            {workflow === "research" ? (
              <>
                <label htmlFor="research-question">Question</label>
                <input
                  id="research-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  minLength={3}
                  maxLength={2000}
                  required
                />
                <label htmlFor="source-budget">Sources</label>
                <input
                  id="source-budget"
                  type="number"
                  min={1}
                  max={100}
                  value={sourceBudget}
                  onChange={(event) =>
                    setSourceBudget(event.currentTarget.value)
                  }
                  required
                />
              </>
            ) : (
              <>
                <label htmlFor="simulation">Failure mode</label>
                <select
                  id="simulation"
                  value={simulate}
                  onChange={(event) =>
                    setSimulate(event.target.value as typeof simulate)
                  }
                >
                  <option value="none">Normal run</option>
                  <option value="slow">Slow / cancellable</option>
                  <option value="source_failure">Source failure</option>
                  <option value="corrupt_artifact">Corrupt artifact</option>
                </select>
              </>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={start.isPending}
            >
              {start.isPending
                ? "Scheduling…"
                : workflow === "research"
                  ? "Start research"
                  : "Start comparison"}
            </button>
          </div>
        </form>
        {start.error && <p className="error-banner">{start.error.message}</p>}
      </section>

      {run ? (
        <div className="research-grid">
          <div className="research-column">
            <RunTimeline run={run} />
            {report && (
              <Suspense
                fallback={
                  <section className="panel chart-loading" aria-live="polite">
                    Loading analytical chart…
                  </section>
                }
              >
                <LazyMetricChart report={report} />
              </Suspense>
            )}
          </div>
          <div className="research-column wide">
            {report ? (
              <EvidencePanel report={report} />
            ) : (
              <section className="panel empty-evidence" aria-live="polite">
                <p className="eyebrow">EVIDENCE</p>
                <h2>
                  {run.status === "failed"
                    ? "Run rejected"
                    : "Building the ledger"}
                </h2>
                <p>
                  {run.error_message ??
                    "Artifacts appear only after containment, schema, hash and policy validation."}
                </p>
              </section>
            )}
          </div>
          {run.status === "running" && (
            <button
              className="danger-button floating-cancel"
              type="button"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              Cancel run
            </button>
          )}
        </div>
      ) : (
        <section className="empty-state">
          <div className="evidence-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>No active investigation</h2>
          <p>
            Start the golden comparison to exercise the complete local pipeline.
          </p>
        </section>
      )}
    </div>
  );
}
