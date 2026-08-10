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
import { LOCALES, LOCALE_LABELS, fmt, useI18n, type Locale } from "../i18n";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Button, Card, InlineNotice, PageHeader } from "../components/ui";
import { ExtractionRulesCard } from "../components/extraction-rules-card";

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
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
        const name = (settings?.siteName ?? "marketingovo-project")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase();
        anchor.href = url;
        anchor.download = `${name || "marketingovo-project"}.marketingovo`;
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
        eyebrow={t.settings.eyebrow}
        title={t.settings.title}
        description={t.settings.description}
      />
      {/* The language card sits outside the workspace gate on purpose: locale
          is a device preference, and someone with zero workspaces still needs
          to be able to leave a language they cannot read. */}
      <Card className="settings-card project-transfer-card">
        <div>
          <h2>{t.settings.languageTitle}</h2>
          <p>{t.settings.languageDescription}</p>
        </div>
        <div className="form-grid">
          <label>
            {t.settings.languageLabel}
            <select
              name="interfaceLanguage"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              {LOCALES.map((code) => (
                <option value={code} key={code}>
                  {LOCALE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>
      {update.isSuccess ? (
        <InlineNotice tone="success" title={t.settings.savedTitle}>
          {t.settings.savedBody}
        </InlineNotice>
      ) : null}
      {update.isError ? (
        <InlineNotice tone="danger" title={t.settings.notSavedTitle}>
          {update.error.message}
        </InlineNotice>
      ) : null}
      {exportProject.isError ? (
        <InlineNotice tone="danger" title={t.settings.notExportedTitle}>
          {exportProject.error.message}
        </InlineNotice>
      ) : null}
      {importProject.isError ? (
        <InlineNotice tone="danger" title={t.settings.notImportedTitle}>
          {importProject.error.message}
        </InlineNotice>
      ) : null}
      {importProject.isSuccess ? (
        <InlineNotice tone="success" title={t.settings.importedTitle}>
          {fmt(t.settings.importedSummary, {
            runs: importProject.data.data.counts.runs,
            actions: importProject.data.data.counts.actions,
            contextVersions: importProject.data.data.counts.contextVersions,
            contextEntries: importProject.data.data.counts.contextEntries,
            extractionRuleVersions:
              importProject.data.data.counts.extractionRuleVersions,
            artifacts: importProject.data.data.counts.artifacts,
            reconnect: importProject.data.data.reconnectProviders.length
              ? fmt(t.settings.reconnectList, {
                  providers:
                    importProject.data.data.reconnectProviders.join(", "),
                })
              : t.settings.reconnectNone,
          })}
        </InlineNotice>
      ) : null}
      {deleteProject.isError ? (
        <InlineNotice tone="danger" title={t.settings.notDeletedTitle}>
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
          title={t.settings.deletedTitle}
        >
          {fmt(t.settings.deletedSummary, {
            runs: deletionReceipt.counts.runs,
            issueInstances: deletionReceipt.counts.issueInstances,
            actions: deletionReceipt.counts.actions,
            extractionRuleVersions:
              deletionReceipt.counts.extractionRuleVersions,
            artifacts: deletionReceipt.counts.artifacts,
            cleanup:
              deletionReceipt.artifactCleanup === "complete"
                ? t.settings.cleanupComplete
                : t.settings.cleanupScheduled,
          })}
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
                <legend>{t.settings.siteIdentity}</legend>
                <div className="form-grid">
                  <label>
                    {t.settings.siteName}
                    <input
                      name="siteName"
                      defaultValue={settings.siteName ?? ""}
                      required
                    />
                  </label>
                  <label>
                    {t.settings.canonicalUrl}
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
                <legend>{t.settings.reporting}</legend>
                <div className="form-grid">
                  <label>
                    {t.settings.timezone}
                    <input
                      name="timezone"
                      defaultValue={settings.timezone ?? ""}
                      placeholder="Europe/London"
                    />
                  </label>
                  <label>
                    {t.settings.reportingCurrency}
                    <input
                      name="reportingCurrency"
                      defaultValue={settings.reportingCurrency ?? ""}
                      placeholder="USD"
                      minLength={3}
                      maxLength={3}
                    />
                  </label>
                  <label>
                    {t.settings.retentionTarget}
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
                <legend>{t.settings.reportPreferences}</legend>
                <div className="form-grid">
                  <label>
                    {t.settings.alertEmail}
                    <input
                      name="alertEmail"
                      type="email"
                      defaultValue={settings.alertEmail ?? ""}
                    />
                    <small>{t.settings.alertEmailHelp}</small>
                  </label>
                  <label className="checkbox-label">
                    <input
                      name="weeklyDigest"
                      type="checkbox"
                      defaultChecked={settings.weeklyDigest ?? false}
                    />
                    <span>
                      <strong>{t.settings.weeklyDigest}</strong>
                      <small>{t.settings.weeklyDigestHelp}</small>
                    </span>
                  </label>
                </div>
              </fieldset>
              <div className="form-actions">
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? t.settings.saving : t.settings.save}
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
              <h2>{t.settings.portabilityTitle}</h2>
              <p>
                {t.settings.portabilityBodyBefore} <code>.marketingovo</code>{" "}
                {t.settings.portabilityBodyAfter}
              </p>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={downloadBundle}
                disabled={!siteId || exportProject.isPending}
              >
                {exportProject.isPending
                  ? t.settings.exporting
                  : t.settings.exportProject}
              </Button>
              <label
                htmlFor="project-import-file"
                className={`button button-secondary project-import-label ${importProject.isPending ? "is-disabled" : ""}`}
              >
                {importProject.isPending
                  ? t.settings.importing
                  : t.settings.importProject}
                <input
                  id="project-import-file"
                  className="sr-only"
                  type="file"
                  accept=".marketingovo,application/vnd.marketingovo.project+json"
                  aria-describedby="project-import-help"
                  onChange={importBundle}
                  disabled={importProject.isPending}
                />
              </label>
            </div>
            <small id="project-import-help">{t.settings.importHelp}</small>
          </Card>
        ) : null}
        {settings ? (
          <Card className="settings-card project-transfer-card danger-zone-card">
            <div>
              <p className="eyebrow">{t.settings.dangerZone}</p>
              <h2>{t.settings.deleteTitle}</h2>
              <p>{t.settings.deleteBody1}</p>
              <p>{t.settings.deleteBody2}</p>
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
                  {t.settings.deleteProject}
                </Button>
              </div>
            ) : (
              <form
                className="deletion-confirmation"
                onSubmit={deleteLocalProject}
              >
                <div>
                  <label htmlFor="project-deletion-confirmation">
                    {t.settings.confirmLabel}
                  </label>
                  <p id="project-deletion-help">
                    {t.settings.confirmHelpBefore}{" "}
                    <strong>{projectName}</strong> {t.settings.confirmHelpAfter}
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
                    {t.settings.cancel}
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
                      ? t.settings.deleting
                      : t.settings.permanentlyDelete}
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
