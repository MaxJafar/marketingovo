import { lazy, Suspense, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntelClient } from "../api/client-context.js";
import { useRunEventStream } from "../api/use-run-event-stream.js";
import { EvidencePanel } from "../components/EvidencePanel.js";
import { RunTimeline } from "../components/RunTimeline.js";
import type { ImportPreview } from "@golem-intel/sdk";

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
  const [activeRunId, setActiveRunId] = useState<string | undefined>(() => {
    return sessionStorage.getItem("activeRunId") ?? undefined;
  });
  const [workflow, setWorkflow] = useState<"demo" | "import">("import");
  const [simulate, setSimulate] = useState<
    "none" | "source_failure" | "corrupt_artifact" | "slow"
  >("none");
  const [preview, setPreview] = useState<ImportPreview>();
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [attested, setAttested] = useState(false);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);

  // Keep sessionStorage in sync
  if (activeRunId !== sessionStorage.getItem("activeRunId")) {
    if (activeRunId) {
      sessionStorage.setItem("activeRunId", activeRunId);
    } else {
      sessionStorage.removeItem("activeRunId");
    }
  }

  useRunEventStream(activeRunId);

  const previewMutation = useMutation({
    mutationFn: (file: File) => client.datasets.previewCompetitivePulse(file),
    onSuccess: (data) => {
      setPreview(data);
      setSelectedTargets(new Set());
      setPreviewConfirmed(false);
    },
  });

  const start = useMutation({
    mutationFn: () => {
      if (workflow === "demo") {
        return client.comparisons.start({
          project_id: "competitive-pulse-demo",
          target_ids: ["northstar-labs", "orbit-coffee", "vertex-studio"],
          goal: "Compare public growth, engagement quality and content cadence.",
          connector_ids: ["fixture.competitive-pulse"],
          simulate,
        });
      }
      return client.comparisons.start({
        project_id: "competitive-pulse-import",
        target_ids: Array.from(selectedTargets),
        goal: "Compare imported targets.",
        connector_ids: [],
        dataset_id: preview!.dataset_id,
        simulate: "none",
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

  const replay = useMutation({
    mutationFn: () => client.runs.replay(activeRunId!),
    onSuccess: (run) => setActiveRunId(run.id),
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    start.mutate();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPreview(undefined);
      setPreviewConfirmed(false);
      previewMutation.mutate(file);
    }
  }

  function toggleTarget(id: string) {
    const next = new Set(selectedTargets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTargets(next);
    setPreviewConfirmed(false);
  }

  function copyDatasetId() {
    if (preview?.dataset_id) {
      void navigator.clipboard.writeText(preview.dataset_id);
    }
  }

  const run = runQuery.data;
  const report = reportQuery.data;

  const isStartDisabled =
    start.isPending ||
    (workflow === "import" &&
      (!attested || !preview?.valid || selectedTargets.size < 2 || selectedTargets.size > 5 || !previewConfirmed));

  return (
    <div className="research-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">COMPETITIVE PULSE / IMPORT</p>
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
                {workflow === "import"
                  ? "Import dataset"
                  : "Synthetic Demo"}
              </h2>
              <p>
                {workflow === "import"
                  ? "Upload a CSV to preview discovered targets and validate schema."
                  : "Three synthetic brands · YouTube-style public observations"}
              </p>
            </div>
          </div>
          <div className="launch-controls">
            <label htmlFor="workflow">Source</label>
            <select
              id="workflow"
              value={workflow}
              onChange={(event) => {
                setWorkflow(event.target.value as typeof workflow);
                setPreview(undefined);
                setSelectedTargets(new Set());
                setActiveRunId(undefined);
                setPreviewConfirmed(false);
              }}
            >
              <option value="import">Custom CSV Import</option>
              <option value="demo">Synthetic Demo</option>
            </select>

            {workflow === "demo" ? (
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
            ) : (
              <>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => {
                      setAttested(e.target.checked);
                      if (!e.target.checked) setPreviewConfirmed(false);
                    }}
                  />
                  <span>I attest I have the right to process this data for competitive research</span>
                </label>
                <label htmlFor="csv-upload">Select CSV</label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={!attested || previewMutation.isPending}
                  required
                />
              </>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={isStartDisabled}
            >
              {start.isPending
                ? "Scheduling…"
                : "Start comparison"}
            </button>
          </div>
        </form>

        {previewMutation.error && (
          <p className="error-banner">{previewMutation.error.message}</p>
        )}
        {start.error && <p className="error-banner">{start.error.message}</p>}

        {workflow === "import" && preview && (
          <div className="preview-results" style={{ marginTop: "2rem", padding: "1.5rem", background: "var(--panel-raised)", borderRadius: "1rem" }}>
            {preview.diagnostics.length > 0 && (
              <div className="diagnostics" style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem", color: "var(--danger)" }}>Validation Issues</h3>
                <ul style={{ paddingLeft: "1.5rem", margin: 0, color: "var(--faint)" }}>
                  {preview.diagnostics.map((diag, i) => (
                    <li key={i} className={`diagnostic-${diag.severity}`}>
                      {diag.message} {diag.record_number && `(Row ${diag.record_number})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.valid && preview.dataset_id && (
              <div className="dataset-reference" style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ margin: "0 0 0.5rem" }}>Dataset Reference</h3>
                <p style={{ margin: "0 0 0.5rem", color: "var(--muted)" }}>Provide this opaque reference to your agent:</p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <code className="mono" style={{ background: "var(--canvas)", padding: "0.5rem", borderRadius: "0.25rem", userSelect: "all" }}>
                    {preview.dataset_id}
                  </code>
                  <button type="button" onClick={copyDatasetId} style={{ padding: "0.5rem 1rem", borderRadius: "0.25rem", border: "1px solid var(--line)", background: "transparent", color: "var(--faint)", cursor: "pointer" }}>Copy</button>
                </div>
              </div>
            )}

            {preview.valid && preview.targets.length > 0 && (
              <div className="target-selection">
                <h3 style={{ margin: "0 0 1rem" }}>Select Targets (2-5)</h3>
                <div className="target-list" style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {preview.targets.map(target => (
                    <label key={target.target_id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem", border: "1px solid var(--line)", borderRadius: "0.5rem", cursor: "pointer", background: selectedTargets.has(target.target_id) ? "var(--mint-soft)" : "var(--canvas)" }}>
                      <input
                        type="checkbox"
                        checked={selectedTargets.has(target.target_id)}
                        onChange={() => toggleTarget(target.target_id)}
                      />
                      <span>{target.target_name} ({target.row_count} rows)</span>
                    </label>
                  ))}
                </div>
                {preview.valid && preview.targets.length >= 2 && preview.targets.length <= 5 && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem", padding: "1rem", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={previewConfirmed}
                      onChange={(e) => setPreviewConfirmed(e.target.checked)}
                    />
                    <strong>I confirm the validation results and selected targets for processing</strong>
                  </label>
                )}
              </div>
            )}
          </div>
        )}
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
          {terminalStatuses.has(run.status) && (
            <button
              className="primary-button floating-cancel"
              type="button"
              onClick={() => replay.mutate()}
              disabled={replay.isPending}
            >
              Replay run
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
