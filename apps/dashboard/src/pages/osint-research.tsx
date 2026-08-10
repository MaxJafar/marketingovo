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
import { fmt, getMessages, useI18n } from "../i18n";
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
    return getMessages().common.unavailable;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return getMessages().common.unavailable;
  }
}

function evidenceLabel(item: OsintEvidence): string {
  return fmt(getMessages().osintResearch.evidence.confidence, {
    label: item.label,
    confidence: Math.round(item.confidence * 100),
  });
}

function EvidenceRow({ item }: { item: OsintEvidence }) {
  const { t } = useI18n();
  const source = safeExternalUrl(item.sourceUrl);
  return (
    <li>
      <div className="evidence-row-heading">
        <strong>{item.label}</strong>
        <StatusBadge status={item.state} />
      </div>
      <p>{displayEvidenceValue(item.value)}</p>
      <small>
        {evidenceLabel(item)}{" "}
        {fmt(t.osintResearch.evidence.observedAt, {
          date: formatDate(item.observedAt, true),
        })}
        {item.claimHash ? (
          <>
            {" "}
            {t.osintResearch.evidence.claimLabel}{" "}
            <code title={item.claimHash}>{item.claimHash.slice(0, 12)}…</code>
          </>
        ) : null}
        {source ? (
          <>
            {" "}
            ·{" "}
            <a href={source} target="_blank" rel="noreferrer">
              {t.osintResearch.sourceLink}
            </a>
          </>
        ) : null}
      </small>
    </li>
  );
}

function TargetCard({ target }: { target: OsintTargetDossier }) {
  const { t } = useI18n();
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
          <p className="eyebrow">{t.osintResearch.target.eyebrow}</p>
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
          <span>{t.osintResearch.target.pagesObserved}</span>
          <strong>{formatNumber(target.pagesObserved)}</strong>
        </div>
        <div>
          <span>{t.osintResearch.target.availableEvidence}</span>
          <strong>
            {formatNumber(
              target.evidence.filter((item) => item.state === "available")
                .length,
            )}
          </strong>
        </div>
        <div>
          <span>{t.osintResearch.target.graphEntities}</span>
          <strong>{formatNumber(target.entities.length)}</strong>
        </div>
        <div>
          <span>{t.osintResearch.target.graphLinks}</span>
          <strong>{formatNumber(target.relationships.length)}</strong>
        </div>
      </div>

      {finalUrl && finalUrl !== targetUrl ? (
        <p className="evidence-source-link">
          {t.osintResearch.target.finalUrl}{" "}
          <a href={finalUrl} target="_blank" rel="noreferrer">
            {target.finalUrl}
          </a>
        </p>
      ) : null}

      {cadence ? (
        <InlineNotice
          tone="info"
          title={t.osintResearch.target.publishingSignalTitle}
        >
          {cadence.datedItems === 1
            ? fmt(t.osintResearch.target.cadenceItemsOne, {
                count: cadence.datedItems,
              })
            : fmt(t.osintResearch.target.cadenceItemsMany, {
                count: cadence.datedItems,
              })}
          {cadence.cadenceDays === null
            ? t.osintResearch.target.cadenceUnavailable
            : fmt(t.osintResearch.target.cadenceAverage, {
                days: cadence.cadenceDays.toFixed(1),
              })}{" "}
          {t.osintResearch.target.cadenceDisclaimer}
        </InlineNotice>
      ) : null}

      {target.error ? (
        <InlineNotice
          tone="warning"
          title={t.osintResearch.target.notObservedTitle}
        >
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
  const { t } = useI18n();
  return (
    <Card>
      <SectionHeading
        title={t.osintResearch.coverage.title}
        description={t.osintResearch.coverage.description}
      />
      <div className="evidence-metric-grid osint-metrics">
        <div>
          <span>{t.osintResearch.coverage.coverage}</span>
          <strong>
            <StatusBadge status={dossier.coverage.state} />
          </strong>
        </div>
        <div>
          <span>{t.osintResearch.coverage.targetsCompleted}</span>
          <strong>
            {formatNumber(dossier.coverage.targetsCompleted)} /{" "}
            {formatNumber(dossier.coverage.targetsRequested)}
          </strong>
        </div>
        <div>
          <span>{t.osintResearch.coverage.pagesObserved}</span>
          <strong>{formatNumber(dossier.coverage.pagesObserved)}</strong>
        </div>
        <div>
          <span>{t.osintResearch.coverage.evidenceAvailable}</span>
          <strong>{formatNumber(dossier.coverage.evidenceAvailable)}</strong>
        </div>
      </div>
      <div className="osint-policy-list">
        <StatusBadge
          status="available"
          label={t.osintResearch.coverage.publicWebOnly}
        />
        <StatusBadge
          status="missing"
          label={t.osintResearch.coverage.personalDataDisabled}
        />
        <StatusBadge
          status="missing"
          label={t.osintResearch.coverage.identityResolutionDisabled}
        />
        <StatusBadge
          status="missing"
          label={t.osintResearch.coverage.authenticatedCollectionDisabled}
        />
        <StatusBadge
          status="missing"
          label={t.osintResearch.coverage.darkWebDisabled}
        />
      </div>
    </Card>
  );
}

function TrustSummary({ dossier }: { dossier: OsintDossier }) {
  const { t } = useI18n();
  const evidence = dossier.targets.flatMap((target) => target.evidence);
  const fingerprinted = evidence.filter((item) =>
    item.claimHash ? /^[a-f0-9]{64}$/u.test(item.claimHash) : false,
  ).length;
  const sourceCount = new Set(
    evidence
      .map((item) => item.sourceUrl)
      .filter((sourceUrl): sourceUrl is string => sourceUrl !== null),
  ).size;
  const provenance = dossier.provenance;
  const integrityRecorded =
    provenance !== undefined &&
    provenance.evidenceCount === evidence.length &&
    provenance.sourceCount === sourceCount &&
    /^[a-f0-9]{64}$/u.test(provenance.evidenceDigest) &&
    fingerprinted === evidence.length;

  return (
    <Card>
      <SectionHeading
        title={t.osintResearch.trust.title}
        description={t.osintResearch.trust.description}
      />
      <div className="evidence-metric-grid osint-metrics">
        <div>
          <span>{t.osintResearch.trust.claimFingerprints}</span>
          <strong>
            {formatNumber(fingerprinted)} / {formatNumber(evidence.length)}
          </strong>
        </div>
        <div>
          <span>{t.osintResearch.trust.sourceUrlsRecorded}</span>
          <strong>{formatNumber(provenance?.sourceCount ?? 0)}</strong>
        </div>
        <div>
          <span>{t.osintResearch.trust.integrityRecord}</span>
          <strong>
            <StatusBadge
              status={integrityRecorded ? "available" : "insufficient"}
              label={
                integrityRecorded
                  ? t.osintResearch.trust.recorded
                  : provenance
                    ? t.osintResearch.trust.incomplete
                    : t.osintResearch.trust.legacyDossier
              }
            />
          </strong>
        </div>
        <div>
          <span>{t.osintResearch.trust.fingerprintAlgorithm}</span>
          <strong>{provenance?.claimHashAlgorithm.toUpperCase() ?? "—"}</strong>
        </div>
      </div>
      {provenance ? (
        <p className="osint-provenance-digest">
          {t.osintResearch.trust.evidenceDigest}{" "}
          <code>{provenance.evidenceDigest}</code>
        </p>
      ) : (
        <InlineNotice
          tone="info"
          title={t.osintResearch.trust.olderFormatTitle}
        >
          {t.osintResearch.trust.olderFormatBody}
        </InlineNotice>
      )}
      <p className="muted-copy">{t.osintResearch.trust.fingerprintScope}</p>
    </Card>
  );
}

function Findings({ dossier }: { dossier: OsintDossier }) {
  const { t } = useI18n();
  return (
    <Card>
      <SectionHeading
        title={t.osintResearch.findings.title}
        description={t.osintResearch.findings.description}
      />
      {dossier.findings.length === 0 ? (
        <p className="muted-copy">{t.osintResearch.findings.empty}</p>
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
                {finding.evidenceIds.length === 1
                  ? fmt(t.osintResearch.citedEvidenceOne, {
                      count: finding.evidenceIds.length,
                    })
                  : fmt(t.osintResearch.citedEvidenceMany, {
                      count: finding.evidenceIds.length,
                    })}{" "}
                ·{" "}
                {fmt(t.osintResearch.confidencePct, {
                  confidence: Math.round(finding.confidence * 100),
                })}
              </small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChangeHistory({ workspace }: { workspace: OsintWorkspace }) {
  const { t } = useI18n();
  const description =
    workspace.compared && workspace.previousGeneratedAt
      ? fmt(t.osintResearch.history.comparedDescription, {
          date: formatDate(workspace.previousGeneratedAt, true),
        })
      : t.osintResearch.history.firstPassDescription;
  return (
    <Card>
      <SectionHeading
        title={t.osintResearch.history.title}
        description={description}
      />
      {!workspace.compared ? (
        <p className="muted-copy">{t.osintResearch.history.baseline}</p>
      ) : workspace.changes.length === 0 ? (
        <p className="muted-copy">{t.osintResearch.history.noChanges}</p>
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
                    ? String(before ?? t.common.unavailable) +
                      " → " +
                      String(after ?? t.common.unavailable)
                    : change.change === "added"
                      ? (after ?? t.osintResearch.available)
                      : (before ?? t.common.unavailable)}
                </p>
                <small>
                  {change.category} {t.osintResearch.history.targetLabel}{" "}
                  {target ? (
                    <a href={target} target="_blank" rel="noreferrer">
                      {change.targetUrl}
                    </a>
                  ) : (
                    change.targetUrl
                  )}{" "}
                  ·{" "}
                  {change.evidenceIds.length === 1
                    ? fmt(t.osintResearch.citedEvidenceOne, {
                        count: change.evidenceIds.length,
                      })
                    : fmt(t.osintResearch.citedEvidenceMany, {
                        count: change.evidenceIds.length,
                      })}{" "}
                  ·{" "}
                  {fmt(t.osintResearch.confidencePct, {
                    confidence: Math.round(change.confidence * 100),
                  })}
                  {source ? (
                    <>
                      {" "}
                      ·{" "}
                      <a href={source} target="_blank" rel="noreferrer">
                        {t.osintResearch.sourceLink}
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
  const { t } = useI18n();
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
      setInputError(fmt(t.osintResearch.form.invalidTarget, { url: invalid }));
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
        eyebrow={t.osintResearch.eyebrow}
        title={t.osintResearch.title}
        description={t.osintResearch.description}
      />

      <Card className="schedule-editor">
        <form onSubmit={submit}>
          <SectionHeading
            title={t.osintResearch.form.title}
            description={t.osintResearch.form.description}
          />
          <label htmlFor="osint-targets">
            {t.osintResearch.form.targetsLabel}
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
            {t.osintResearch.form.targetsHelp}
          </small>
          <div className="form-actions">
            <Button type="submit" disabled={!siteId || start.isPending}>
              {start.isPending
                ? t.osintResearch.form.queueing
                : t.osintResearch.form.run}
            </Button>
          </div>
        </form>
      </Card>

      {inputError ? (
        <InlineNotice tone="warning" title={t.osintResearch.form.rejectedTitle}>
          {inputError}
        </InlineNotice>
      ) : null}
      {start.isError ? (
        <InlineNotice tone="danger" title={t.osintResearch.form.failedTitle}>
          {start.error.message}
        </InlineNotice>
      ) : null}
      {start.isSuccess ? (
        <InlineNotice tone="success" title={t.osintResearch.form.queuedTitle}>
          {t.osintResearch.form.queuedBody}
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
            <TrustSummary dossier={dossier} />
            <Findings dossier={dossier} />
            {workspace ? <ChangeHistory workspace={workspace} /> : null}
            <section>
              <SectionHeading
                title={t.osintResearch.dossiers.title}
                description={
                  dossier.sourceBudget === 1
                    ? fmt(t.osintResearch.dossiers.generatedOne, {
                        date: formatDate(dossier.generatedAt, true),
                        count: dossier.sourceBudget,
                      })
                    : fmt(t.osintResearch.dossiers.generatedMany, {
                        date: formatDate(dossier.generatedAt, true),
                        count: dossier.sourceBudget,
                      })
                }
              />
              <div className="osint-target-grid">
                {dossier.targets.map((target) => (
                  <TargetCard key={target.targetUrl} target={target} />
                ))}
              </div>
            </section>
            <Card>
              <SectionHeading
                title={t.osintResearch.limitations.title}
                description={t.osintResearch.limitations.description}
              />
              <ul className="stack-list">
                {dossier.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </Card>
          </>
        ) : (
          <InlineNotice tone="info" title={t.osintResearch.noDossierTitle}>
            {t.osintResearch.noDossierBody}
          </InlineNotice>
        )}
      </QueryState>
    </div>
  );
}
