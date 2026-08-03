// Workspace setup wizard.
//
// One linear pass that takes an empty install to a dashboard with real data in
// every section. The order is deliberate: everything that costs the user nothing
// comes first, and the steps that need a credential are last and skippable, so
// nobody is blocked at step two hunting for an API key.
//
// The wizard writes the same records the rest of the app reads — a project, a
// versioned context profile, integration credentials — so nothing here is a
// parallel store that could drift from what the dashboard shows.

import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  useCreateSite,
  useIntegrations,
  useSaveIntegrationCredentials,
  useStartAudit,
  useStartWorkflow,
  useUpdateProjectContext,
} from "../api/queries";
import type { ProjectContextProfile } from "../api/contracts";
import {
  Button,
  Card,
  InlineNotice,
  PageHeader,
  SectionHeading,
} from "../components/ui";
import { Icon } from "../components/icon";

/** Providers offered during setup, in the order a marketer would reach for them. */
const CREDENTIAL_PROVIDERS = [
  {
    id: "google-search-console",
    label: "Google Search Console",
    why: "Ranks findings by the queries and pages that actually earn impressions.",
    field: "Property URL or sc-domain identifier",
    placeholder: "sc-domain:example.com",
  },
  {
    id: "google-analytics-4",
    label: "Google Analytics 4",
    why: "Weights findings by sessions and conversions rather than severity alone.",
    field: "Property ID",
    placeholder: "123456789",
  },
  {
    id: "pagespeed-insights",
    label: "PageSpeed Insights",
    why: "Adds field Core Web Vitals to the technical audit.",
    field: "API key",
    placeholder: "AIza…",
  },
  {
    id: "serpapi",
    label: "SerpAPI",
    why: "Required for live rank tracking. Without it, positions stay unmeasured.",
    field: "API key",
    placeholder: "Your SerpAPI key",
  },
] as const;

interface BrandProfileDraft {
  label: string;
  url: string;
}

const EMPTY_PROFILE: ProjectContextProfile = {
  summary: null,
  audiences: [],
  markets: [],
  languages: [],
  conversionGoals: [],
  priorityTopics: [],
  competitors: [],
  brandProfiles: [],
  constraints: [],
};

/**
 * Adds a scheme to a bare host.
 *
 * https is the right default for a real domain, and the wrong one for loopback:
 * a local or staging server on 127.0.0.1:4501 almost never speaks TLS, and
 * silently forcing https there produces a connection failure the user cannot
 * diagnose from the form. An explicit scheme is always respected.
 */
export function withProtocol(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  const host = trimmed.split("/", 1)[0]!.split(":", 1)[0]!.toLowerCase();
  const loopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return `${loopback ? "http" : "https"}://${trimmed}`;
}

/**
 * Hosts the crawler refuses without explicit authorization.
 *
 * The egress guard blocks private addresses by default, so a staging or local
 * target simply fails with no explanation from the form. Detecting it here lets
 * setup ask for the authorization rather than leaving the user stuck.
 */
function privateHostOf(rawUrl: string): string | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  } catch {
    return null;
  }
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    /^127\./u.test(host) ||
    /^10\./u.test(host) ||
    /^192\.168\./u.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./u.test(host);
  return isPrivate ? host : null;
}

/** Splits a textarea into clean lines, dropping blanks and duplicates. */
function lines(value: string, limit: number): string[] {
  const seen = new Set<string>();
  for (const entry of value.split(/[\n,]/u)) {
    const trimmed = entry.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].slice(0, limit);
}

const STEPS = [
  { id: "workspace", label: "Workspace", hint: "Name the brand and its site." },
  { id: "brand", label: "Brand presence", hint: "Where else the brand lives." },
  { id: "competitors", label: "Competitors", hint: "Who to measure against." },
  { id: "data", label: "Data sources", hint: "Optional. Skippable." },
  { id: "launch", label: "Review", hint: "Start the first runs." },
] as const;

export function WizardPage() {
  const [stepIndex, setStepIndex] = useState(0);

  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [profiles, setProfiles] = useState<BrandProfileDraft[]>([
    { label: "", url: "" },
  ]);
  const [competitorText, setCompetitorText] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});

  // The project is created at the end of step 1 so later steps have an id to
  // write against. Keeping it in state means a back-navigation reuses it rather
  // than creating a second workspace.
  const [siteId, setSiteId] = useState<string | null>(null);
  const [launched, setLaunched] = useState<string[]>([]);
  const [allowPrivate, setAllowPrivate] = useState(false);
  const [includeOsint, setIncludeOsint] = useState(true);

  const createSite = useCreateSite();
  const updateContext = useUpdateProjectContext(siteId ?? "");
  const saveCredentials = useSaveIntegrationCredentials(siteId ?? "");
  const startAudit = useStartAudit();
  const startWorkflow = useStartWorkflow();
  const integrations = useIntegrations(siteId ?? "");

  const step = STEPS[stepIndex]!;
  const competitors = useMemo(
    () => lines(competitorText, 50),
    [competitorText],
  );
  const cleanProfiles = useMemo(
    () =>
      profiles
        .map((entry) => ({
          label: entry.label.trim(),
          url: withProtocol(entry.url),
        }))
        .filter((entry) => entry.label && entry.url),
    [profiles],
  );

  // Every private host across the site and its competitors, so one affirmation
  // covers the whole run rather than prompting per target.
  const privateHosts = useMemo(() => {
    const hosts = new Set<string>();
    for (const candidate of [websiteUrl, ...competitors]) {
      const host = privateHostOf(withProtocol(candidate));
      if (host) hosts.add(host);
    }
    return [...hosts];
  }, [websiteUrl, competitors]);

  const primaryPrivateHost = useMemo(
    () => privateHostOf(withProtocol(websiteUrl)),
    [websiteUrl],
  );
  const osintTargets = useMemo(
    () =>
      competitors
        .filter((candidate) => !privateHostOf(withProtocol(candidate)))
        .slice(0, 4)
        .map(withProtocol),
    [competitors],
  );

  const configuredProviders = useMemo(
    () => Object.entries(secrets).filter(([, value]) => value.trim()),
    [secrets],
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateProfile(index: number, patch: Partial<BrandProfileDraft>) {
    setProfiles((current) =>
      current.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  async function persistContext(id: string): Promise<void> {
    await updateContext.mutateAsync({
      profile: {
        ...EMPTY_PROFILE,
        summary: summary.trim() || null,
        competitors,
        brandProfiles: cleanProfiles,
      },
      changeSummary: "Workspace setup",
    });
    void id;
  }

  async function advance(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      if (step.id === "workspace") {
        if (!siteId) {
          const created = await createSite.mutateAsync({
            name: brandName.trim(),
            url: withProtocol(websiteUrl),
          });
          setSiteId(created.data.id);
        }
      }
      // Brand profiles and competitors land in the same versioned context
      // record, so both steps write once the second of them is done.
      if (step.id === "competitors" && siteId) await persistContext(siteId);
      if (step.id === "data" && siteId) {
        for (const [provider, value] of configuredProviders) {
          await saveCredentials.mutateAsync({
            integrationId: provider,
            credentials: { value: value.trim() },
          });
        }
      }
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function launch(): Promise<void> {
    if (!siteId) return;
    setError(null);
    setBusy(true);
    const started: string[] = [];
    try {
      const privateHostAllowlist =
        allowPrivate && privateHosts.length > 0 ? privateHosts : undefined;
      await startAudit.mutateAsync({
        siteId,
        mode: "full",
        ...(privateHostAllowlist ? { privateHostAllowlist } : {}),
      });
      started.push("Baseline audit");
      // The comparison is what fills Market intel. Without competitors there is
      // nothing to compare, so it is skipped rather than started empty.
      if (competitors.length > 0) {
        await startWorkflow.mutateAsync({
          projectId: siteId,
          workflowId: "compare",
          options: {
            competitorUrls: competitors.slice(0, 2).map(withProtocol),
            maxUrls: 30,
            renderMode: "static",
            ...(privateHostAllowlist ? { privateHostAllowlist } : {}),
          },
        });
        started.push("Competitor comparison");
      }
      if (includeOsint && !primaryPrivateHost) {
        await startWorkflow.mutateAsync({
          projectId: siteId,
          workflowId: "osint-research",
          options: {
            targetUrls: osintTargets,
            maxUrls: 12,
          },
        });
        started.push("Public-web OSINT dossier");
      }
      setLaunched(started);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start runs.",
      );
      setLaunched(started);
    } finally {
      setBusy(false);
    }
  }

  const canAdvance = (() => {
    if (busy) return false;
    if (step.id === "workspace")
      return brandName.trim().length > 0 && websiteUrl.trim().length > 0;
    return true;
  })();

  return (
    <div className="page-stack wizard">
      <PageHeader
        eyebrow="Setup"
        title="Create your marketing workspace"
        description="Five steps to a dashboard with real data. Only the first needs anything from you."
      />

      <ol className="wizard-rail" aria-label="Setup progress">
        {STEPS.map((entry, index) => {
          const state =
            index < stepIndex
              ? "done"
              : index === stepIndex
                ? "current"
                : "upcoming";
          return (
            <li
              key={entry.id}
              className={`wizard-rail-step is-${state}`}
              aria-current={index === stepIndex ? "step" : undefined}
            >
              <span className="wizard-rail-marker">
                {state === "done" ? <Icon name="check" /> : index + 1}
              </span>
              <span className="wizard-rail-text">
                <strong>{entry.label}</strong>
                <small>{entry.hint}</small>
              </span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <InlineNotice tone="danger" title="That step could not be saved">
          {error}
        </InlineNotice>
      ) : null}

      <Card>
        {step.id === "workspace" ? (
          <form
            className="wizard-fields"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void advance();
            }}
          >
            <SectionHeading
              title="What are we tracking?"
              description="The workspace is named for the brand. The site is what gets crawled."
            />
            <label htmlFor="wizard-brand-name">
              Brand name
              <input
                id="wizard-brand-name"
                value={brandName}
                onChange={(event) => setBrandName(event.currentTarget.value)}
                placeholder="Acme Running"
                required
              />
            </label>
            <label htmlFor="wizard-website">
              Website
              <input
                id="wizard-website"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.currentTarget.value)}
                placeholder="acme.example"
                required
              />
              <small>https:// is added if you leave it off.</small>
            </label>
            <label htmlFor="wizard-summary">
              What does this brand do?{" "}
              <span className="optional">Optional</span>
              <textarea
                id="wizard-summary"
                value={summary}
                onChange={(event) => setSummary(event.currentTarget.value)}
                placeholder="Direct-to-consumer running shoes, UK and Ireland."
                rows={2}
              />
              <small>
                Recorded as workspace context so reports and agents share the
                same background.
              </small>
            </label>
          </form>
        ) : null}

        {step.id === "brand" ? (
          <div className="wizard-fields">
            <SectionHeading
              title="Where else does the brand live?"
              description="Each profile is checked against your crawl: whether any page links to it, and whether it is declared in schema.org sameAs. An unlinked profile is invisible to search engines."
            />
            {profiles.map((entry, index) => (
              <div className="wizard-row" key={index}>
                <label htmlFor={`wizard-profile-label-${index}`}>
                  Label
                  <input
                    id={`wizard-profile-label-${index}`}
                    value={entry.label}
                    onChange={(event) =>
                      updateProfile(index, { label: event.currentTarget.value })
                    }
                    placeholder="Instagram"
                  />
                </label>
                <label htmlFor={`wizard-profile-url-${index}`}>
                  Profile URL
                  <input
                    id={`wizard-profile-url-${index}`}
                    value={entry.url}
                    onChange={(event) =>
                      updateProfile(index, { url: event.currentTarget.value })
                    }
                    placeholder="instagram.com/acmerunning"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setProfiles((current) =>
                      current.length === 1
                        ? [{ label: "", url: "" }]
                        : current.filter((_, position) => position !== index),
                    )
                  }
                  aria-label={`Remove profile ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setProfiles((current) => [...current, { label: "", url: "" }])
              }
            >
              Add another profile
            </Button>
          </div>
        ) : null}

        {step.id === "competitors" ? (
          <div className="wizard-fields">
            <SectionHeading
              title="Who are you measured against?"
              description="Every competitor is crawled with the same limits as your own site. Publishing cadence and content gaps come from their pages, so no provider key is needed."
            />
            <label htmlFor="wizard-competitors">
              Competitor domains
              <textarea
                id="wizard-competitors"
                value={competitorText}
                onChange={(event) =>
                  setCompetitorText(event.currentTarget.value)
                }
                placeholder={"competitor-one.com\ncompetitor-two.com"}
                rows={4}
              />
              <small>
                One per line. The first two are compared in the opening run; the
                rest are kept in workspace context.
              </small>
            </label>
          </div>
        ) : null}

        {step.id === "data" ? (
          <div className="wizard-fields">
            <SectionHeading
              title="Connect your data"
              description="Every one of these is optional. Skip them and the audit still runs — findings are ranked by technical severity and reach, and anything that needs a source is reported as unavailable rather than guessed."
            />
            {CREDENTIAL_PROVIDERS.map((provider) => (
              <label
                key={provider.id}
                htmlFor={`wizard-provider-${provider.id}`}
              >
                {provider.label} <span className="optional">Optional</span>
                <input
                  id={`wizard-provider-${provider.id}`}
                  type="password"
                  autoComplete="off"
                  value={secrets[provider.id] ?? ""}
                  onChange={(event) =>
                    setSecrets((current) => ({
                      ...current,
                      [provider.id]: event.currentTarget.value,
                    }))
                  }
                  placeholder={provider.placeholder}
                  aria-describedby={`${provider.id}-why`}
                />
                <small id={`${provider.id}-why`}>
                  {provider.field}. {provider.why}
                </small>
              </label>
            ))}
            <InlineNotice tone="info" title="Where these are stored">
              Credentials go to the local credential vault on this machine and
              are never written into reports, logs or artifacts.
            </InlineNotice>
          </div>
        ) : null}

        {step.id === "launch" ? (
          <div>
            <SectionHeading
              title="Ready to run"
              description="The baseline audit, competitor comparison, and optional public-web OSINT pass are queued together."
            />
            <dl className="wizard-summary">
              <div>
                <dt>Brand</dt>
                <dd>{brandName || "Unnamed"}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{withProtocol(websiteUrl) || "Not set"}</dd>
              </div>
              <div>
                <dt>Brand profiles</dt>
                <dd>
                  {cleanProfiles.length > 0
                    ? cleanProfiles.map((entry) => entry.label).join(", ")
                    : "None — brand presence will not be checked"}
                </dd>
              </div>
              <div>
                <dt>Competitors</dt>
                <dd>
                  {competitors.length > 0
                    ? competitors.join(", ")
                    : "None — Market intel stays empty"}
                </dd>
              </div>
              <div>
                <dt>Data sources</dt>
                <dd>
                  {configuredProviders.length > 0
                    ? `${configuredProviders.length} configured`
                    : "None — findings ranked by severity and reach only"}
                </dd>
              </div>
              <div>
                <dt>Public-web OSINT</dt>
                <dd>
                  {includeOsint && !primaryPrivateHost
                    ? "Included — cited public signals and repeat-pass history"
                    : primaryPrivateHost
                      ? "Skipped — public target required"
                      : "Skipped by choice"}
                </dd>
              </div>
              <div>
                <dt>Integrations detected</dt>
                <dd>
                  {integrations.data
                    ? `${integrations.data.data.items.length} available`
                    : "Checking…"}
                </dd>
              </div>
            </dl>

            <label
              className={`wizard-affirm wizard-osint-option${primaryPrivateHost ? " wizard-osint-disabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={includeOsint}
                disabled={Boolean(primaryPrivateHost)}
                onChange={(event) =>
                  setIncludeOsint(event.currentTarget.checked)
                }
                aria-describedby="wizard-osint-help"
              />
              <span>
                <strong>Include the public-web OSINT dossier</strong>
                <small id="wizard-osint-help">
                  Recommended. Uses only this site and the explicit competitor
                  URLs above, with source links, availability states, and no
                  people-search, authenticated scraping, or dark-web collection.
                  Private or loopback competitor URLs are excluded.
                </small>
              </span>
            </label>
            {primaryPrivateHost ? (
              <p className="wizard-lock-reason">
                OSINT stays off for {primaryPrivateHost}; it is limited to
                public targets. The baseline can still run with the private-host
                authorization above.
              </p>
            ) : null}

            {privateHosts.length > 0 ? (
              <InlineNotice
                tone="warning"
                title="This run targets a private address"
              >
                <p>
                  {privateHosts.join(", ")}{" "}
                  {privateHosts.length === 1 ? "is" : "are"} on a private or
                  loopback network. The crawler refuses these unless you
                  authorize them for this workspace.
                </p>
                <label className="wizard-affirm">
                  <input
                    type="checkbox"
                    checked={allowPrivate}
                    onChange={(event) =>
                      setAllowPrivate(event.currentTarget.checked)
                    }
                  />
                  <span>
                    Allow crawling{" "}
                    {privateHosts.length === 1 ? "this host" : "these hosts"}.
                    Only these exact hosts are authorized; the rest of the
                    private network stays blocked.
                  </span>
                </label>
              </InlineNotice>
            ) : null}

            {launched.length > 0 ? (
              <InlineNotice tone="success" title="Runs started">
                {launched.join(" and ")} queued. Progress is visible under
                Audits; this workspace fills in as each run completes.
              </InlineNotice>
            ) : null}
          </div>
        ) : null}

        <div className="wizard-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
            disabled={stepIndex === 0 || busy}
          >
            Back
          </Button>
          {step.id === "launch" ? (
            launched.length > 0 ? (
              <Link to="/" className="button button-primary">
                Go to the dashboard
              </Link>
            ) : (
              <Button
                type="button"
                onClick={() => void launch()}
                disabled={busy}
              >
                {busy ? "Starting…" : "Start the first runs"}
              </Button>
            )
          ) : (
            <Button
              type="button"
              onClick={() => void advance()}
              disabled={!canAdvance}
            >
              {busy ? "Saving…" : "Continue"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
