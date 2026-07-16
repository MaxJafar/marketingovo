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
  competitors: [],
  constraints: [],
};

const profileLists: ReadonlyArray<{
  key: Exclude<keyof ProjectContextProfile, "summary">;
  label: string;
  help: string;
  placeholder: string;
}> = [
  {
    key: "audiences",
    label: "Priority audiences",
    help: "Who must find, trust, and act on this site?",
    placeholder: "Technical SEO leads\nB2B growth teams",
  },
  {
    key: "markets",
    label: "Markets",
    help: "Countries, regions, or commercial segments that change intent.",
    placeholder: "United States\nUnited Kingdom",
  },
  {
    key: "languages",
    label: "Languages",
    help: "Use the labels your team recognizes; include locale when relevant.",
    placeholder: "English (en-US)\nGerman (de-DE)",
  },
  {
    key: "conversionGoals",
    label: "Conversion goals",
    help: "Name the events that make organic work valuable.",
    placeholder: "Qualified demo request\nTrial activation",
  },
  {
    key: "priorityTopics",
    label: "Priority topics",
    help: "Products, problems, or themes the current strategy must support.",
    placeholder: "Technical SEO automation\nLocal-first analytics",
  },
  {
    key: "competitors",
    label: "Known competitors",
    help: "Brands or domains used for fair, explicit comparison.",
    placeholder: "example-competitor.com\nAlternative category leader",
  },
  {
    key: "constraints",
    label: "Constraints and guardrails",
    help: "Legal, brand, platform, migration, or resourcing limits.",
    placeholder:
      "Do not change checkout URLs\nLegal review required for claims",
  },
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

function journalLabel(kind: ProjectContextJournalEntry["kind"]): string {
  return kind[0]!.toUpperCase() + kind.slice(1);
}

export function ProjectContextPage() {
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
        eyebrow="Reusable strategy memory"
        title="Project context"
        description="Keep business goals, audiences, markets, constraints, and decisions beside crawl evidence so every human and agent starts from the same facts."
      />
      {update.isSuccess ? (
        <InlineNotice tone="success" title="Context revision saved">
          The previous revision remains immutable and available in history.
        </InlineNotice>
      ) : null}
      {update.isError ? (
        <InlineNotice tone="danger" title="Context was not saved">
          {update.error.message}
        </InlineNotice>
      ) : null}
      {append.isSuccess ? (
        <InlineNotice tone="success" title="Journal entry appended">
          The entry is immutable and now available to local agent resources.
        </InlineNotice>
      ) : null}
      {append.isError ? (
        <InlineNotice tone="danger" title="Journal entry was not appended">
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
                  <p className="eyebrow">Versioned profile</p>
                  <h2>
                    {workspace.current
                      ? `Revision ${workspace.current.revision}`
                      : "Create the first revision"}
                  </h2>
                </div>
                {workspace.current ? (
                  <span className="muted-copy">
                    Saved {formatDate(workspace.current.createdAt, true)}
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
                    Business and search summary
                  </label>
                  <textarea
                    id="context-summary"
                    name="summary"
                    rows={5}
                    maxLength={4_000}
                    defaultValue={profile.summary ?? ""}
                    placeholder="What does the business offer, to whom, and what must organic search accomplish now?"
                  />
                </div>
                <div className="context-list-grid">
                  {profileLists.map((field) => {
                    const inputId = `context-${field.key}`;
                    const helpId = `${inputId}-help`;
                    return (
                      <div className="context-field" key={field.key}>
                        <label htmlFor={inputId}>{field.label}</label>
                        <textarea
                          id={inputId}
                          name={field.key}
                          rows={4}
                          maxLength={8_000}
                          defaultValue={profile[field.key].join("\n")}
                          placeholder={field.placeholder}
                          aria-describedby={helpId}
                        />
                        <small id={helpId}>
                          {field.help} One item per line.
                        </small>
                      </div>
                    );
                  })}
                </div>
                <div className="context-field">
                  <label htmlFor="context-change-summary">
                    Revision summary
                  </label>
                  <input
                    id="context-change-summary"
                    name="changeSummary"
                    minLength={3}
                    maxLength={240}
                    required
                    placeholder="Added UK market and clarified demo conversion"
                    aria-describedby="context-change-summary-help"
                  />
                  <small id="context-change-summary-help">
                    Explain what changed. Saving always creates a new immutable
                    revision.
                  </small>
                </div>
                <div className="form-actions">
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending
                      ? "Saving revision…"
                      : "Save new revision"}
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="context-journal-card">
              <div className="context-card-heading">
                <div>
                  <p className="eyebrow">Append-only journal</p>
                  <h2>Record what changed the strategy</h2>
                </div>
              </div>
              <form className="context-journal-form" onSubmit={appendJournal}>
                <div className="form-grid">
                  <label>
                    Entry type
                    <select name="kind" defaultValue="observation">
                      <option value="observation">Observation</option>
                      <option value="decision">Decision</option>
                      <option value="constraint">Constraint</option>
                      <option value="experiment">Experiment</option>
                    </select>
                  </label>
                  <label>
                    Source audit (optional)
                    <select name="sourceRunId" defaultValue="">
                      <option value="">No linked audit</option>
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
                  Entry title
                  <input
                    name="title"
                    minLength={3}
                    maxLength={160}
                    required
                    placeholder="UK comparison pages convert qualified demos"
                  />
                </label>
                <label>
                  Evidence and implication
                  <textarea
                    name="detail"
                    minLength={3}
                    maxLength={2_000}
                    rows={5}
                    required
                    placeholder="State what was observed or decided, why it matters, and what would invalidate it."
                  />
                </label>
                <div className="form-actions">
                  <Button type="submit" disabled={append.isPending}>
                    {append.isPending ? "Appending…" : "Append journal entry"}
                  </Button>
                  <span className="muted-copy">
                    Entries cannot be edited in place. Add a later decision when
                    evidence changes.
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
                <h2 id="context-journal-history">Decision journal</h2>
                <p>
                  Newest entries appear first; sequence numbers never change.
                </p>
              </div>
            </div>
            <ol className="context-journal-list">
              {workspace.journal.map((entry) => (
                <li key={entry.id}>
                  <Card>
                    <div className="context-entry-heading">
                      <StatusBadge
                        status={entry.kind}
                        label={journalLabel(entry.kind)}
                      />
                      <span>#{entry.sequence}</span>
                      <time dateTime={entry.createdAt}>
                        {formatDate(entry.createdAt, true)}
                      </time>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.detail}</p>
                    {entry.sourceRunId ? (
                      <small>Source run: {entry.sourceRunId}</small>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <EmptyState
            title="No strategy journal yet"
            description="Append an observation, decision, constraint, or experiment when evidence changes how the team should act."
          />
        )}

        {workspace?.history.length ? (
          <section aria-labelledby="context-revision-history">
            <div className="section-heading">
              <div>
                <h2 id="context-revision-history">Revision history</h2>
                <p>Profile revisions are immutable and newest-first.</p>
              </div>
            </div>
            <ol className="context-revision-list">
              {workspace.history.map((version) => (
                <li key={version.revision}>
                  <strong>Revision {version.revision}</strong>
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
