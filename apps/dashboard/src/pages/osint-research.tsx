import { useState, type FormEvent } from "react";
import type {
  OsintChange,
  OsintDossier,
  OsintEvidence,
  OsintWorkspace,
  OsintTargetDossier,
} from "../api/contracts";
import { useOsintDossier, useStartWorkflow } from "../api/queries";
import { useSite } from "../context/site-context";
import { FreshnessNotice, QueryState } from "../components/data-state";
import {
  Button,
  Card,
  InlineNotice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";

function displayEvidenceValue(value: unknown): string {
  if (value === null || value === undefined || value === "")
    return "Unavailable";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Unavailable";
  }
}

function evidenceLabel(item: OsintEvidence): string {
  return `${item.label} · ${Math.round(item.confidence * 100)}% confidence`;
}

function EvidenceRow({ item }: { item: OsintEvidence }) {
  const source = safeExternalUrl(item.sourceUrl);
  return (
    <li>
      <div className="evidence-row-heading">
        <strong>{item.label}</strong>
        <StatusBadge status={item.state} />
      </div>
      <p>{displayEvidenceValue(item.value)}</p>
      <small>
        {evidenceLabel(item)} · observed {formatDate(item.observedAt, true)}
        {source ? (
          <>
            {" "}
            ·{" "}
            <a href={source} target="_blank" rel="noreferrer">
              source
            </a>
          </>
        ) : null}
      </small>
    </li>
  );
}

function TargetCard({ target }: { target: OsintTargetDossier }) {
  const targetUrl = safeExternalUrl(target.targetUrl);
  const finalUrl = safeExternalUrl(target.finalUrl);
  const usefulEvidence = target.evidence.filter((item) =>
    [
      "site-identity",
      "social-profile",
      "structured-identity",
      "public-channel",
      "discovery",
      "publishing-cadence",
    ].includes(item.kind),
  );
  const cadence = target.publishingCadence?.cadence;

  return (
    <Card className="osint-target-card">
      <div className="osint-target-heading">
        <div>
          <p className="eyebrow">Target dossier</p>
          <h3>{target.host ?? target.targetUrl}</h3>
          <small>
            {targetUrl ? (
              <a href={targetUrl} target="_blank" rel="noreferrer">
                {target.targetUrl}
              </a>
            ) : (
              target.targetUrl
            )}
          </small>
        </div>
        <StatusBadge status={target.status} />
      </div>

      <div className="evidence-metric-grid osint-metrics">
        <div>
          <span>Pages observed</span>
          <strong>{formatNumber(target.pagesObserved)}</strong>
        </div>
        <div>
          <span>Available evidence</span>
          <strong>
            {formatNumber(
              target.evidence.filter((item) => item.state === "available")
                .length,
            )}
          </strong>
        </div>
        <div>
          <span>Graph entities</span>
          <strong>{formatNumber(target.entities.length)}</strong>
        </div>
        <div>
          <span>Graph links</span>
          <strong>{formatNumber(target.relationships.length)}</strong>
        </div>
      </div>

      {finalUrl && finalUrl !== targetUrl ? (
        <p className="evidence-source-link">
          Final URL:{" "}
          <a href={finalUrl} target="_blank" rel="noreferrer">
            {target.finalUrl}
          </a>
        </p>
      ) : null}

      {cadence ? (
        <InlineNotice tone="info" title="Public publishing signal">
          {cadence.datedItems} dated item{cadence.datedItems === 1 ? "" : "s"}{" "}
          in the observed feed
          {cadence.cadenceDays === null
            ? "; cadence is unavailable without a measured interval."
            : `; average interval ${cadence.cadenceDays.toFixed(1)} days.`}{" "}
          This is publication evidence, not reach or engagement.
        </InlineNotice>
      ) : null}

      {target.error ? (
        <InlineNotice tone="warning" title="Target was not fully observed">
          {target.error}
        </InlineNotice>
      ) : null}

      <ul className="osint-evidence-list">
        {(usefulEvidence.length > 0 ? usefulEvidence : target.evidence).map(
          (item) => (
            <EvidenceRow key={item.id} item={item} />
          ),
        )}
      </ul>
    </Card>
  );
}

function Coverage({ dossier }: { dossier: OsintDossier }) {
  return (
    <Card>
      <SectionHeading
        title="Coverage and policy"
        description="Every observation keeps its source and evidence state. A missing signal is never turned into zero."
      />
      <div className="evidence-metric-grid osint-metrics">
        <div>
          <span>Coverage</span>
          <strong>
            <StatusBadge status={dossier.coverage.state} />
          </strong>
        </div>
        <div>
          <span>Targets completed</span>
          <strong>
            {formatNumber(dossier.coverage.targetsCompleted)} /{" "}
            {formatNumber(dossier.coverage.targetsRequested)}
          </strong>
        </div>
        <div>
          <span>Pages observed</span>
          <strong>{formatNumber(dossier.coverage.pagesObserved)}</strong>
        </div>
        <div>
          <span>Evidence available</span>
          <strong>{formatNumber(dossier.coverage.evidenceAvailable)}</strong>
        </div>
      </div>
      <div className="osint-policy-list">
        <StatusBadge status="available" label="Public web only" />
        <StatusBadge status="missing" label="Personal data disabled" />
        <StatusBadge status="missing" label="Identity resolution disabled" />
        <StatusBadge
          status="missing"
          label="Authenticated collection disabled"
        />
        <StatusBadge status="missing" label="Dark web disabled" />
      </div>
    </Card>
  );
}

function Findings({ dossier }: { dossier: OsintDossier }) {
  return (
    <Card>
      <SectionHeading
        title="Findings"
        description="Descriptive, evidence-linked observations from the public web."
      />
      {dossier.findings.length === 0 ? (
        <p className="muted-copy">
          No findings were supported by the observed evidence.
        </p>
      ) : (
        <ul className="stack-list">
          {dossier.findings.map((finding) => (
            <li key={finding.id}>
              <div className="evidence-row-heading">
                <strong>{finding.title}</strong>
                <StatusBadge status={finding.severity} />
              </div>
              <p>{finding.statement}</p>
              <small>
                {finding.evidenceIds.length} cited evidence item
                {finding.evidenceIds.length === 1 ? "" : "s"} ·{" "}
                {Math.round(finding.confidence * 100)}% confidence
              </small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChangeHistory({ workspace }: { workspace: OsintWorkspace }) {
  const description =
    workspace.compared && workspace.previousGeneratedAt
      ? "Cited public-web changes since " +
        formatDate(workspace.previousGeneratedAt, true) +
        ". A blocked target is excluded instead of being treated as a disappearance."
      : "Run a second public-web pass to compare exact signals over time.";
  return (
    <Card>
      <SectionHeading title="Pass history" description={description} />
      {!workspace.compared ? (
        <p className="muted-copy">
          The first pass establishes the baseline. Later passes report added,
          removed, and changed evidence without making identity claims.
        </p>
      ) : workspace.changes.length === 0 ? (
        <p className="muted-copy">
          No supported public signal changed since the previous pass.
        </p>
      ) : (
        <ul className="stack-list">
          {workspace.changes.map((change: OsintChange) => {
            const target = safeExternalUrl(change.targetUrl);
            const source = safeExternalUrl(change.sourceUrl);
            const before = change.before
              ? displayEvidenceValue(change.before.value)
              : null;
            const after = change.after
              ? displayEvidenceValue(change.after.value)
              : null;
            return (
              <li key={change.id}>
                <div className="evidence-row-heading">
                  <strong>{change.label}</strong>
                  <StatusBadge status={change.change} />
                </div>
                <p>
                  {change.change === "changed"
                    ? String(before ?? "Unavailable") +
                      " → " +
                      String(after ?? "Unavailable")
                    : change.change === "added"
                      ? (after ?? "Available")
                      : (before ?? "Unavailable")}
                </p>
                <small>
                  {change.category} · target{" "}
                  {target ? (
                    <a href={target} target="_blank" rel="noreferrer">
                      {change.targetUrl}
                    </a>
                  ) : (
                    change.targetUrl
                  )}{" "}
                  · {change.evidenceIds.length} cited evidence item
                  {change.evidenceIds.length === 1 ? "" : "s"} ·{" "}
                  {Math.round(change.confidence * 100)}% confidence
                  {source ? (
                    <>
                      {" "}
                      ·{" "}
                      <a href={source} target="_blank" rel="noreferrer">
                        source
                      </a>
                    </>
                  ) : null}
                </small>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function OsintResearchPage() {
  const { siteId } = useSite();
  const query = useOsintDossier(siteId);
  const start = useStartWorkflow();
  const [targets, setTargets] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const workspace = query.data?.data;
  const dossier = workspace?.dossier ?? null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = targets
      .split(/[\n,]/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 4);
    const invalid = values.find((value) => {
      try {
        return new URL(value).protocol !== "https:";
      } catch {
        return true;
      }
    });
    if (invalid) {
      setInputError(`Use an explicit public https:// URL: ${invalid}`);
      return;
    }
    setInputError(null);
    start.mutate({
      projectId: siteId,
      workflowId: "osint-research",
      options: { targetUrls: values, maxUrls: 12 },
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Product priority · intelligence layer"
        title="Public-web OSINT"
        description="Build a bounded, source-linked dossier from your site and up to four explicitly supplied public targets. The graph preserves what was observed without turning missing data into a claim."
      />

      <Card className="schedule-editor">
        <form onSubmit={submit}>
          <SectionHeading
            title="Start an evidence pass"
            description="The project site is included automatically. Add public competitor, partner, newsroom, or reference URLs when they are in scope."
          />
          <label htmlFor="osint-targets">
            Additional public targets
            <textarea
              id="osint-targets"
              value={targets}
              onChange={(event) => setTargets(event.currentTarget.value)}
              placeholder={
                "https://competitor.example\nhttps://partner.example"
              }
              rows={4}
              maxLength={4_000}
              aria-describedby="osint-targets-help"
            />
          </label>
          <small id="osint-targets-help">
            Up to four URLs, one per line. HTTPS only; no credentials, cookies,
            account probes, or people-search pivots.
          </small>
          <div className="form-actions">
            <Button type="submit" disabled={!siteId || start.isPending}>
              {start.isPending
                ? "Queueing public-web research…"
                : "Run OSINT pass"}
            </Button>
          </div>
        </form>
      </Card>

      {inputError ? (
        <InlineNotice tone="warning" title="Target list was not accepted">
          {inputError}
        </InlineNotice>
      ) : null}
      {start.isError ? (
        <InlineNotice tone="danger" title="OSINT run could not start">
          {start.error.message}
        </InlineNotice>
      ) : null}
      {start.isSuccess ? (
        <InlineNotice tone="success" title="OSINT run queued">
          The run is being collected with public-web limits. This page will
          refresh when its evidence dossier is persisted.
        </InlineNotice>
      ) : null}

      <QueryState
        isLoading={query.isLoading || query.latestRun?.status === "running"}
        error={query.error}
        siteId={siteId}
        onRetry={() => void query.refetch()}
      >
        {dossier ? (
          <>
            <FreshnessNotice meta={query.data?.meta} />
            <Coverage dossier={dossier} />
            <Findings dossier={dossier} />
            {workspace ? <ChangeHistory workspace={workspace} /> : null}
            <section>
              <SectionHeading
                title="Target dossiers"
                description={`Generated ${formatDate(dossier.generatedAt, true)} · ${dossier.sourceBudget} bounded source target${dossier.sourceBudget === 1 ? "" : "s"}.`}
              />
              <div className="osint-target-grid">
                {dossier.targets.map((target) => (
                  <TargetCard key={target.targetUrl} target={target} />
                ))}
              </div>
            </section>
            <Card>
              <SectionHeading
                title="Known limitations"
                description="These constraints are part of the dossier contract, not a hidden gap in the UI."
              />
              <ul className="stack-list">
                {dossier.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </Card>
          </>
        ) : (
          <InlineNotice tone="info" title="No OSINT dossier yet">
            Run a public-web pass above to create the first evidence-linked
            dossier for this project.
          </InlineNotice>
        )}
      </QueryState>
    </div>
  );
}
