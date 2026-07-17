import { useState, type FormEvent } from "react";
import type { Integration } from "../api/contracts";
import {
  useIntegrations,
  useRemoveIntegration,
  useSaveIntegrationConfiguration,
  useSaveIntegrationCredentials,
  useTestIntegration,
} from "../api/queries";
import { useSite } from "../context/site-context";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Icon } from "../components/icon";

import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  formatDate,
  safeExternalUrl,
} from "../components/ui";

function CredentialForm({
  integration,
  siteId,
  onClose,
}: {
  integration: Integration;
  siteId: string;
  onClose: () => void;
}) {
  const save = useSaveIntegrationCredentials(siteId);
  const fields = integration.credentialFields ?? [
    {
      key: "apiKey",
      label: "API key",
      type: "secret" as const,
      required: true,
    },
  ];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(
      fields.flatMap((field) => {
        const value = String(form.get(field.key) ?? "");
        return value ? [[field.key, value]] : [];
      }),
    );
    if (Object.keys(credentials).length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { integrationId: integration.id, credentials },
      { onSuccess: onClose },
    );
  }

  return (
    <form className="credential-form" onSubmit={submit} autoComplete="off">
      <div className="credential-heading">
        <div>
          <h3>Connect {integration.name}</h3>
          <p>
            Credentials are sent directly to the local API. This dashboard never
            stores them in browser storage or reads them back.
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close credential form"
        >
          <Icon name="close" />
        </button>
      </div>
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          <input
            name={field.key}
            type={field.type === "text" ? "text" : "password"}
            required={field.required}
            spellCheck={false}
            autoCapitalize="none"
          />
          <small>
            {field.help ??
              (field.type === "text"
                ? "Enter the account identifier supplied by the platform."
                : "Stored by the API credential vault; never returned to the browser.")}
          </small>
        </label>
      ))}
      {save.isError ? (
        <InlineNotice tone="danger" title="Credentials were not saved">
          {save.error.message}
        </InlineNotice>
      ) : null}
      <div className="form-actions">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? "Saving securely…"
            : fields.some((field) => field.required)
              ? "Save and connect"
              : "Continue"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ConfigurationForm({
  integration,
  siteId,
  onClose,
}: {
  integration: Integration;
  siteId: string;
  onClose: () => void;
}) {
  const save = useSaveIntegrationConfiguration(siteId);
  const fields = integration.configurationFields ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const configuration = Object.fromEntries(
      fields.flatMap((field) => {
        const value = String(form.get(field.key) ?? "").trim();
        return value ? [[field.key, value]] : [];
      }),
    );
    save.mutate(
      { integrationId: integration.id, configuration },
      { onSuccess: onClose },
    );
  }

  return (
    <form className="credential-form" onSubmit={submit} autoComplete="off">
      <div className="credential-heading">
        <div>
          <h3>Configure {integration.name}</h3>
          <p>
            These non-secret settings are stored per site, so one local
            workspace can map several sites to different provider properties.
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close configuration form"
        >
          <Icon name="close" />
        </button>
      </div>
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          <input
            name={field.key}
            type="text"
            required={field.required}
            placeholder={field.placeholder}
            defaultValue={String(integration.configuration?.[field.key] ?? "")}
            spellCheck={false}
            autoCapitalize="none"
          />
          <small>
            {field.help ??
              "This setting contains no secret credential material."}
          </small>
        </label>
      ))}
      {save.isError ? (
        <InlineNotice tone="danger" title="Configuration was not saved">
          {save.error.message}
        </InlineNotice>
      ) : null}
      <div className="form-actions">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save configuration"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RemovalConfirmation({
  integration,
  isPending,
  error,
  onConfirm,
  onClose,
}: {
  integration: Integration;
  isPending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmed) onConfirm();
  }

  return (
    <form className="integration-removal-form" onSubmit={submit}>
      <div className="credential-heading">
        <div>
          <h3>Revoke local access to {integration.name}</h3>
          <p>
            Delete this credential from the operating-system-backed local vault
            and disconnect it from every local project. Non-secret site mappings
            stay in place for a later reconnect.
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close credential removal"
          disabled={isPending}
        >
          <Icon name="close" />
        </button>
      </div>
      <InlineNotice tone="warning" title="Provider access may remain active">
        AGENTseo can delete its local copy, but it cannot deactivate an API key
        or OAuth grant at the provider. Use the provider setup page when you
        need to revoke the credential at its source.
      </InlineNotice>
      <label className="integration-removal-confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.currentTarget.checked)}
        />
        <span>
          I understand this disconnects {integration.name} across every local
          project.
        </span>
      </label>
      {error ? (
        <InlineNotice tone="danger" title="Credential was not removed">
          {error.message}
        </InlineNotice>
      ) : null}
      <div className="form-actions">
        <Button
          type="submit"
          variant="danger"
          disabled={!confirmed || isPending}
        >
          {isPending ? "Removing…" : "Remove local credential"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function IntegrationsPage() {
  const { siteId } = useSite();
  const query = useIntegrations(siteId);
  const testIntegration = useTestIntegration(siteId);
  const removeIntegration = useRemoveIntegration();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const integrations = query.data?.data.items ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Connected data"
        title="Integrations"
        description="Bring search, analytics, crawling, and content signals into one defensible decision layer."
      />
      <InlineNotice tone="info" title="Credentials stay out of the browser">
        Secret values are submitted to the local API for encrypted server-side
        storage. The UI only receives connection status and safe account labels.
      </InlineNotice>

      {testIntegration.isError ? (
        <InlineNotice tone="danger" title="Connection test failed">
          {testIntegration.error.message}
        </InlineNotice>
      ) : null}
      {testIntegration.isSuccess ? (
        <InlineNotice tone="success" title="Connection test complete">
          The integration status has been refreshed.
        </InlineNotice>
      ) : null}
      {removeIntegration.isSuccess ? (
        <InlineNotice tone="success" title="Local credential removed">
          The provider is disconnected from AGENTseo. Any non-secret site
          mapping remains available for a later reconnect.
        </InlineNotice>
      ) : null}
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        siteId={siteId}
        onRetry={() => void query.refetch()}
      >
        <FreshnessNotice meta={query.data?.meta} />
        {integrations.length > 0 ? (
          <div className="integration-grid">
            {integrations.map((integration) => {
              const setupUrl = safeExternalUrl(integration.setupUrl);
              const credentialFields = integration.credentialFields ?? [];
              const hasRequiredCredentials = credentialFields.some(
                (field) => field.required,
              );
              const usesSingleApiKey =
                credentialFields.length === 1 &&
                credentialFields[0]?.key === "apiKey";
              return (
                <Card
                  className={`integration-card ${editingId === integration.id || configuringId === integration.id || removingId === integration.id ? "integration-editing" : ""}`}
                  key={integration.id}
                >
                  {editingId === integration.id ? (
                    <CredentialForm
                      integration={integration}
                      siteId={siteId}
                      onClose={() => setEditingId(null)}
                    />
                  ) : configuringId === integration.id ? (
                    <ConfigurationForm
                      integration={integration}
                      siteId={siteId}
                      onClose={() => setConfiguringId(null)}
                    />
                  ) : removingId === integration.id ? (
                    <RemovalConfirmation
                      integration={integration}
                      isPending={removeIntegration.isPending}
                      error={
                        removeIntegration.isError
                          ? removeIntegration.error
                          : null
                      }
                      onConfirm={() =>
                        removeIntegration.mutate(integration.id, {
                          onSuccess: () => setRemovingId(null),
                        })
                      }
                      onClose={() => setRemovingId(null)}
                    />
                  ) : (
                    <>
                      <div className="integration-top">
                        <div className="integration-logo">
                          {integration.name.slice(0, 2).toUpperCase()}
                        </div>
                        <StatusBadge status={integration.status} />
                      </div>
                      <div>
                        <span className="integration-category">
                          {integration.category ?? "Data source"}
                        </span>
                        <h2>{integration.name}</h2>
                        <p>
                          {integration.description ??
                            "No integration description was returned."}
                        </p>
                      </div>
                      <dl className="integration-meta">
                        <div>
                          <dt>Account</dt>
                          <dd>{integration.accountLabel ?? "Not connected"}</dd>
                        </div>
                        <div>
                          <dt>Last verified sync</dt>
                          <dd>{formatDate(integration.lastSyncAt, true)}</dd>
                        </div>
                        <div>
                          <dt>Quota remaining</dt>
                          <dd>
                            {integration.quota
                              ? `${integration.quota.remaining}${integration.quota.limit === null ? "" : ` / ${integration.quota.limit}`}`
                              : "Unavailable"}
                          </dd>
                        </div>
                        <div>
                          <dt>Quota reset</dt>
                          <dd>
                            {formatDate(integration.quota?.resetsAt, true)}
                          </dd>
                        </div>
                      </dl>
                      {integration.lastError ? (
                        <p className="integration-error">
                          {integration.lastError}
                        </p>
                      ) : null}
                      <div className="integration-actions">
                        {integration.supportsApiKey ? (
                          <Button
                            variant={
                              integration.status === "connected"
                                ? "secondary"
                                : "primary"
                            }
                            onClick={() => setEditingId(integration.id)}
                          >
                            {integration.status !== "not_configured"
                              ? "Rotate credentials"
                              : !hasRequiredCredentials
                                ? "Add optional API key"
                                : usesSingleApiKey
                                  ? "Connect API key"
                                  : "Connect credentials"}
                          </Button>
                        ) : null}
                        {setupUrl ? (
                          <a
                            className="button button-secondary"
                            href={setupUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {integration.status === "not_configured"
                              ? "Connect account"
                              : "Reconnect account"}{" "}
                            <Icon name="external" />
                          </a>
                        ) : null}
                        {integration.configurationFields?.length ? (
                          <Button
                            variant="secondary"
                            onClick={() => setConfiguringId(integration.id)}
                          >
                            {Object.keys(integration.configuration ?? {}).length
                              ? "Edit site mapping"
                              : "Configure site"}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          onClick={() => testIntegration.mutate(integration.id)}
                          disabled={testIntegration.isPending}
                        >
                          Test connection
                        </Button>
                        {integration.status !== "not_configured" ? (
                          <Button
                            variant="ghost"
                            aria-label={`Revoke ${integration.name} local access`}
                            onClick={() => setRemovingId(integration.id)}
                          >
                            Revoke local access
                          </Button>
                        ) : null}
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No integrations available"
            description="The API did not return an integration catalog. Check system health and server configuration."
          />
        )}
      </QueryState>
    </div>
  );
}
