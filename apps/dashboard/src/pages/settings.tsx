import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  useDeleteProject,
  useExportProject,
  useImportProject,
  useSettings,
  useUpdateSettings,
} from "../api/queries";
import type { ProjectDeletionReceipt } from "../api/contracts";
import { useSite } from "../context/site-context";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Button, Card, InlineNotice, PageHeader } from "../components/ui";
import { ExtractionRulesCard } from "../components/extraction-rules-card";

export function SettingsPage() {
  const { siteId, setSiteId, site } = useSite();
  const query = useSettings(siteId);
  const update = useUpdateSettings(siteId);
  const exportProject = useExportProject(siteId);
  const importProject = useImportProject();
  const deleteProject = useDeleteProject(siteId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionReceipt, setDeletionReceipt] =
    useState<ProjectDeletionReceipt | null>(null);
  const settings = query.data?.data;
  const projectName = settings?.siteName ?? site?.name ?? "";

  function deleteLocalProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    deleteProject.mutate(deletionConfirmation, {
      onSuccess: (result) => {
        setDeletionReceipt(result.data);
        setDeleteOpen(false);
        setDeletionConfirmation("");
        setSiteId("");
      },
    });
  }

  function downloadBundle() {
    exportProject.mutate(undefined, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const name = (settings?.siteName ?? "agentseo-project")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase();
        anchor.href = url;
        anchor.download = `${name || "agentseo-project"}.agentseo`;
        anchor.hidden = true;
        document.body.append(anchor);
        anchor.click();
        window.setTimeout(() => {
          anchor.remove();
          URL.revokeObjectURL(url);
        }, 0);
      },
    });
  }

  function importBundle(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    importProject.mutate(file, {
      onSuccess: (result) => setSiteId(result.data.project.id),
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const retention = String(form.get("dataRetentionDays") ?? "").trim();
    update.mutate({
      siteName: String(form.get("siteName") ?? ""),
      siteUrl: String(form.get("siteUrl") ?? ""),
      timezone: String(form.get("timezone") ?? ""),
      reportingCurrency: String(form.get("reportingCurrency") ?? ""),
      alertEmail: String(form.get("alertEmail") ?? ""),
      weeklyDigest: form.get("weeklyDigest") === "on",
      dataRetentionDays: retention ? Number(retention) : null,
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace configuration"
        title="Settings"
        description="Update site identity and the reporting preferences stored with this local project."
      />
      {update.isSuccess ? (
        <InlineNotice tone="success" title="Settings saved">
          The local API accepted the updated workspace settings.
        </InlineNotice>
      ) : null}
      {update.isError ? (
        <InlineNotice tone="danger" title="Settings were not saved">
          {update.error.message}
        </InlineNotice>
      ) : null}
      {exportProject.isError ? (
        <InlineNotice tone="danger" title="Project was not exported">
          {exportProject.error.message}
        </InlineNotice>
      ) : null}
      {importProject.isError ? (
        <InlineNotice tone="danger" title="Project was not imported">
          {importProject.error.message}
        </InlineNotice>
      ) : null}
      {importProject.isSuccess ? (
        <InlineNotice tone="success" title="Project imported">
          Imported {importProject.data.data.counts.runs} runs,{" "}
          {importProject.data.data.counts.actions} actions,{" "}
          {importProject.data.data.counts.contextVersions} context revisions,{" "}
          {importProject.data.data.counts.contextEntries} journal entries,{" "}
          {importProject.data.data.counts.extractionRuleVersions}{" "}
          extraction-rule revisions, and{" "}
          {importProject.data.data.counts.artifacts} report artifacts. Schedules
          are disabled and{" "}
          {importProject.data.data.reconnectProviders.length
            ? `these integrations must be reconnected: ${importProject.data.data.reconnectProviders.join(", ")}`
            : "no integration reconnection is required"}
          .
        </InlineNotice>
      ) : null}
      {deleteProject.isError ? (
        <InlineNotice tone="danger" title="Project was not deleted">
          {deleteProject.error.message}
        </InlineNotice>
      ) : null}
      {deletionReceipt ? (
        <InlineNotice
          tone={
            deletionReceipt.artifactCleanup === "complete"
              ? "success"
              : "warning"
          }
          title="Local project deleted"
        >
          Removed {deletionReceipt.counts.runs} runs,{" "}
          {deletionReceipt.counts.issueInstances} issue observations,{" "}
          {deletionReceipt.counts.actions} actions,{" "}
          {deletionReceipt.counts.extractionRuleVersions} extraction-rule
          revisions, and {deletionReceipt.counts.artifacts} artifacts.{" "}
          {deletionReceipt.artifactCleanup === "complete"
            ? "Filesystem cleanup completed."
            : "Filesystem cleanup is scheduled for the next service start."}{" "}
          Global integration credentials were retained for other projects.
        </InlineNotice>
      ) : null}
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        siteId={siteId}
        onRetry={() => void query.refetch()}
      >
        <FreshnessNotice meta={query.data?.meta} />
        {settings ? (
          <Card className="settings-card">
            <form
              key={`${siteId}-${query.dataUpdatedAt}`}
              className="settings-form"
              onSubmit={submit}
            >
              <fieldset>
                <legend>Site identity</legend>
                <div className="form-grid">
                  <label>
                    Site name
                    <input
                      name="siteName"
                      defaultValue={settings.siteName ?? ""}
                      required
                    />
                  </label>
                  <label>
                    Canonical URL
                    <input
                      name="siteUrl"
                      type="url"
                      defaultValue={settings.siteUrl ?? ""}
                      required
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Reporting</legend>
                <div className="form-grid">
                  <label>
                    Timezone
                    <input
                      name="timezone"
                      defaultValue={settings.timezone ?? ""}
                      placeholder="Europe/London"
                    />
                  </label>
                  <label>
                    Reporting currency
                    <input
                      name="reportingCurrency"
                      defaultValue={settings.reportingCurrency ?? ""}
                      placeholder="USD"
                      minLength={3}
                      maxLength={3}
                    />
                  </label>
                  <label>
                    Local retention target (days)
                    <input
                      name="dataRetentionDays"
                      type="number"
                      min={1}
                      max={3650}
                      defaultValue={settings.dataRetentionDays ?? ""}
                      placeholder="365"
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Report preferences</legend>
                <div className="form-grid">
                  <label>
                    Report contact email
                    <input
                      name="alertEmail"
                      type="email"
                      defaultValue={settings.alertEmail ?? ""}
                    />
                    <small>
                      Stored locally as report metadata. Community Edition does
                      not send hosted email alerts.
                    </small>
                  </label>
                  <label className="checkbox-label">
                    <input
                      name="weeklyDigest"
                      type="checkbox"
                      defaultChecked={settings.weeklyDigest ?? false}
                    />
                    <span>
                      <strong>Weekly digest preference</strong>
                      <small>
                        Include weekly priorities, trends, and regressions when
                        generating digest reports.
                      </small>
                    </span>
                  </label>
                </div>
              </fieldset>
              <div className="form-actions">
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
        {settings ? (
          <ExtractionRulesCard
            siteId={siteId}
            siteUrl={settings.siteUrl ?? site?.url ?? ""}
          />
        ) : null}
        {settings ? (
          <Card className="settings-card project-transfer-card">
            <div>
              <h2>Project portability</h2>
              <p>
                Export a versioned <code>.agentseo</code> bundle with audit
                history, actions, metrics, Project Context revisions, the
                marketer journal, custom rules, connector settings, and bounded
                report artifacts. Credentials, tokens, cookies, headers, and
                local file paths are never included.
              </p>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={downloadBundle}
                disabled={!siteId || exportProject.isPending}
              >
                {exportProject.isPending ? "Exporting…" : "Export project"}
              </Button>
              <label
                htmlFor="project-import-file"
                className={`button button-secondary project-import-label ${importProject.isPending ? "is-disabled" : ""}`}
              >
                {importProject.isPending ? "Importing…" : "Import project"}
                <input
                  id="project-import-file"
                  className="sr-only"
                  type="file"
                  accept=".agentseo,.golemseo,application/vnd.agentseo.project+json"
                  aria-describedby="project-import-help"
                  onChange={importBundle}
                  disabled={importProject.isPending}
                />
              </label>
            </div>
            <small id="project-import-help">
              Imports always create a new local project, remap identifiers,
              preserve issue fingerprints, context, extraction rules, and the
              configuration snapshot behind every run, disable imported
              schedules, and require integrations to be reconnected.
            </small>
          </Card>
        ) : null}
        {settings ? (
          <Card className="settings-card project-transfer-card danger-zone-card">
            <div>
              <p className="eyebrow">Danger zone</p>
              <h2>Delete local project</h2>
              <p>
                Permanently remove this project, its runs, raw evidence, action
                history, Project Context, extraction-rule revisions, schedules,
                settings, and report artifacts from this device. Export the
                project first if you may need it again.
              </p>
              <p>
                Global BYOK credentials are intentionally retained because they
                may serve other projects. Revoke them separately from
                Integrations.
              </p>
            </div>
            {!deleteOpen ? (
              <div className="form-actions">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setDeletionReceipt(null);
                    setDeletionConfirmation("");
                    setDeleteOpen(true);
                  }}
                >
                  Delete project
                </Button>
              </div>
            ) : (
              <form
                className="deletion-confirmation"
                onSubmit={deleteLocalProject}
              >
                <div>
                  <label htmlFor="project-deletion-confirmation">
                    Type the project name to confirm
                  </label>
                  <p id="project-deletion-help">
                    Enter <strong>{projectName}</strong> exactly. This action
                    cannot be undone.
                  </p>
                  <input
                    id="project-deletion-confirmation"
                    value={deletionConfirmation}
                    onChange={(event) =>
                      setDeletionConfirmation(event.currentTarget.value)
                    }
                    aria-describedby="project-deletion-help"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeletionConfirmation("");
                    }}
                    disabled={deleteProject.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={
                      deleteProject.isPending ||
                      deletionConfirmation !== projectName
                    }
                  >
                    {deleteProject.isPending
                      ? "Deleting…"
                      : "Permanently delete project"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        ) : null}
      </QueryState>
    </div>
  );
}
