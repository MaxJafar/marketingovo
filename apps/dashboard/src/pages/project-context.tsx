import type { FormEvent } from "react";
import type {
  ProjectContextJournalEntry,
  ProjectContextProfile,
} from "../api/contracts";
import {
  useAppendProjectContextJournal,
  useProjectContext,
  useRuns,
  useUpdateProjectContext,
} from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n, type Messages } from "../i18n";
import { FreshnessNotice, QueryState } from "../components/data-state";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  formatDate,
} from "../components/ui";

const emptyProfile: ProjectContextProfile = {
  summary: null,
  audiences: [],
  markets: [],
  languages: [],
  conversionGoals: [],
  priorityTopics: [],
  brandProfiles: [],
  competitors: [],
  constraints: [],
};

const profileListKeys: ReadonlyArray<
  Exclude<keyof ProjectContextProfile, "summary" | "brandProfiles">
> = [
  "audiences",
  "markets",
  "languages",
  "conversionGoals",
  "priorityTopics",
  "competitors",
  "constraints",
];

function lines(value: FormDataEntryValue | null): string[] {
  const unique = new Map<string, string>();
  for (const line of String(value ?? "").split(/\r?\n/u)) {
    const normalized = line.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("en-US");
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return [...unique.values()];
}

function journalLabel(
  kind: ProjectContextJournalEntry["kind"],
  t: Messages,
): string {
  const label: string | undefined = t.projectContext.journalKinds[kind];
  return label ?? kind[0]!.toUpperCase() + kind.slice(1);
}

export function ProjectContextPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const query = useProjectContext(siteId);
  const runs = useRuns(siteId);
  const update = useUpdateProjectContext(siteId);
  const append = useAppendProjectContextJournal(siteId);
  const workspace = query.data?.data;
  const profile = workspace?.current?.profile ?? emptyProfile;

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const summary = String(form.get("summary") ?? "").trim();
    update.mutate({
      profile: {
        // This form does not edit brand profiles, so the current ones are
        // carried through. Rebuilding the profile from form fields alone would
        // silently delete whatever setup recorded.
        brandProfiles: profile.brandProfiles,
        summary: summary || null,
        audiences: lines(form.get("audiences")),
        markets: lines(form.get("markets")),
        languages: lines(form.get("languages")),
        conversionGoals: lines(form.get("conversionGoals")),
        priorityTopics: lines(form.get("priorityTopics")),
        competitors: lines(form.get("competitors")),
        constraints: lines(form.get("constraints")),
      },
      changeSummary: String(form.get("changeSummary") ?? "").trim(),
    });
  }

  function appendJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    append.mutate(
      {
        kind: String(form.get("kind")) as ProjectContextJournalEntry["kind"],
        title: String(form.get("title") ?? "").trim(),
        detail: String(form.get("detail") ?? "").trim(),
        sourceRunId: String(form.get("sourceRunId") ?? "").trim() || null,
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.projectContext.eyebrow}
        title={t.projectContext.title}
        description={t.projectContext.description}
      />
      {update.isSuccess ? (
        <InlineNotice
          tone="success"
          title={t.projectContext.revisionSavedTitle}
        >
          {t.projectContext.revisionSavedBody}
        </InlineNotice>
      ) : null}
      {update.isError ? (
        <InlineNotice
          tone="danger"
          title={t.projectContext.revisionNotSavedTitle}
        >
          {update.error.message}
        </InlineNotice>
      ) : null}
      {append.isSuccess ? (
        <InlineNotice
          tone="success"
          title={t.projectContext.journalAppendedTitle}
        >
          {t.projectContext.journalAppendedBody}
        </InlineNotice>
      ) : null}
      {append.isError ? (
        <InlineNotice
          tone="danger"
          title={t.projectContext.journalNotAppendedTitle}
        >
          {append.error.message}
        </InlineNotice>
      ) : null}

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        siteId={siteId}
        onRetry={() => void query.refetch()}
      >
        <FreshnessNotice meta={query.data?.meta} />
        {workspace ? (
          <div className="context-layout">
            <Card className="context-profile-card">
              <div className="context-card-heading">
                <div>
                  <p className="eyebrow">{t.projectContext.profile.eyebrow}</p>
                  <h2>
                    {workspace.current
                      ? fmt(t.projectContext.revisionLabel, {
                          revision: workspace.current.revision,
                        })
                      : t.projectContext.profile.createFirstRevision}
                  </h2>
                </div>
                {workspace.current ? (
                  <span className="muted-copy">
                    {fmt(t.projectContext.profile.savedAt, {
                      date: formatDate(workspace.current.createdAt, true),
                    })}
                  </span>
                ) : null}
              </div>
              <form
                key={`${siteId}-${workspace.current?.revision ?? 0}`}
                className="context-profile-form"
                onSubmit={saveProfile}
              >
                <div className="context-field">
                  <label htmlFor="context-summary">
                    {t.projectContext.profile.summaryLabel}
                  </label>
                  <textarea
                    id="context-summary"
                    name="summary"
                    rows={5}
                    maxLength={4_000}
                    defaultValue={profile.summary ?? ""}
                    placeholder={t.projectContext.profile.summaryPlaceholder}
                  />
                </div>
                <div className="context-list-grid">
                  {profileListKeys.map((key) => {
                    const field = t.projectContext.profileLists[key];
                    const inputId = `context-${key}`;
                    const helpId = `${inputId}-help`;
                    return (
                      <div className="context-field" key={key}>
                        <label htmlFor={inputId}>{field.label}</label>
                        <textarea
                          id={inputId}
                          name={key}
                          rows={4}
                          maxLength={8_000}
                          defaultValue={profile[key].join("\n")}
                          placeholder={field.placeholder}
                          aria-describedby={helpId}
                        />
                        <small id={helpId}>
                          {field.help} {t.projectContext.profile.oneItemPerLine}
                        </small>
                      </div>
                    );
                  })}
                </div>
                <div className="context-field">
                  <label htmlFor="context-change-summary">
                    {t.projectContext.profile.changeSummaryLabel}
                  </label>
                  <input
                    id="context-change-summary"
                    name="changeSummary"
                    minLength={3}
                    maxLength={240}
                    required
                    placeholder={
                      t.projectContext.profile.changeSummaryPlaceholder
                    }
                    aria-describedby="context-change-summary-help"
                  />
                  <small id="context-change-summary-help">
                    {t.projectContext.profile.changeSummaryHelp}
                  </small>
                </div>
                <div className="form-actions">
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending
                      ? t.projectContext.profile.saving
                      : t.projectContext.profile.save}
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="context-journal-card">
              <div className="context-card-heading">
                <div>
                  <p className="eyebrow">
                    {t.projectContext.journalForm.eyebrow}
                  </p>
                  <h2>{t.projectContext.journalForm.heading}</h2>
                </div>
              </div>
              <form className="context-journal-form" onSubmit={appendJournal}>
                <div className="form-grid">
                  <label>
                    {t.projectContext.journalForm.kindLabel}
                    <select name="kind" defaultValue="observation">
                      <option value="observation">
                        {t.projectContext.journalKinds.observation}
                      </option>
                      <option value="decision">
                        {t.projectContext.journalKinds.decision}
                      </option>
                      <option value="constraint">
                        {t.projectContext.journalKinds.constraint}
                      </option>
                      <option value="experiment">
                        {t.projectContext.journalKinds.experiment}
                      </option>
                    </select>
                  </label>
                  <label>
                    {t.projectContext.journalForm.sourceLabel}
                    <select name="sourceRunId" defaultValue="">
                      <option value="">
                        {t.projectContext.journalForm.noLinkedAudit}
                      </option>
                      {(runs.data?.data.items ?? []).slice(0, 25).map((run) => (
                        <option key={run.id} value={run.id}>
                          {formatDate(run.completedAt ?? run.startedAt, true)} ·{" "}
                          {run.status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  {t.projectContext.journalForm.titleLabel}
                  <input
                    name="title"
                    minLength={3}
                    maxLength={160}
                    required
                    placeholder={t.projectContext.journalForm.titlePlaceholder}
                  />
                </label>
                <label>
                  {t.projectContext.journalForm.detailLabel}
                  <textarea
                    name="detail"
                    minLength={3}
                    maxLength={2_000}
                    rows={5}
                    required
                    placeholder={t.projectContext.journalForm.detailPlaceholder}
                  />
                </label>
                <div className="form-actions">
                  <Button type="submit" disabled={append.isPending}>
                    {append.isPending
                      ? t.projectContext.journalForm.appending
                      : t.projectContext.journalForm.append}
                  </Button>
                  <span className="muted-copy">
                    {t.projectContext.journalForm.immutableNote}
                  </span>
                </div>
              </form>
            </Card>
          </div>
        ) : null}

        {workspace?.journal.length ? (
          <section aria-labelledby="context-journal-history">
            <div className="section-heading">
              <div>
                <h2 id="context-journal-history">
                  {t.projectContext.journalHistory.heading}
                </h2>
                <p>{t.projectContext.journalHistory.description}</p>
              </div>
            </div>
            <ol className="context-journal-list">
              {workspace.journal.map((entry) => (
                <li key={entry.id}>
                  <Card>
                    <div className="context-entry-heading">
                      <StatusBadge
                        status={entry.kind}
                        label={journalLabel(entry.kind, t)}
                      />
                      <span>#{entry.sequence}</span>
                      <time dateTime={entry.createdAt}>
                        {formatDate(entry.createdAt, true)}
                      </time>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.detail}</p>
                    {entry.sourceRunId ? (
                      <small>
                        {fmt(t.projectContext.journalHistory.sourceRun, {
                          id: entry.sourceRunId,
                        })}
                      </small>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <EmptyState
            title={t.projectContext.journalHistory.emptyTitle}
            description={t.projectContext.journalHistory.emptyDescription}
          />
        )}

        {workspace?.history.length ? (
          <section aria-labelledby="context-revision-history">
            <div className="section-heading">
              <div>
                <h2 id="context-revision-history">
                  {t.projectContext.revisionHistory.heading}
                </h2>
                <p>{t.projectContext.revisionHistory.description}</p>
              </div>
            </div>
            <ol className="context-revision-list">
              {workspace.history.map((version) => (
                <li key={version.revision}>
                  <strong>
                    {fmt(t.projectContext.revisionLabel, {
                      revision: version.revision,
                    })}
                  </strong>
                  <span>{version.changeSummary}</span>
                  <time dateTime={version.createdAt}>
                    {formatDate(version.createdAt, true)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </QueryState>
    </div>
  );
}
