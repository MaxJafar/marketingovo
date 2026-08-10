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
import { fmt, useI18n } from "../i18n";
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
  const { t } = useI18n();
  const save = useSaveIntegrationCredentials(siteId);
  const fields = integration.credentialFields ?? [
    {
      key: "apiKey",
      label: t.integrations.credentialForm.apiKeyLabel,
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
          <h3>
            {fmt(t.integrations.credentialForm.title, {
              name: integration.name,
            })}
          </h3>
          <p>{t.integrations.credentialForm.intro}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={t.integrations.credentialForm.closeAria}
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
                ? t.integrations.credentialForm.textHelp
                : t.integrations.credentialForm.secretHelp)}
          </small>
        </label>
      ))}
      {save.isError ? (
        <InlineNotice
          tone="danger"
          title={t.integrations.credentialForm.notSavedTitle}
        >
          {save.error.message}
        </InlineNotice>
      ) : null}
      <div className="form-actions">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? t.integrations.credentialForm.saving
            : fields.some((field) => field.required)
              ? t.integrations.credentialForm.saveAndConnect
              : t.integrations.credentialForm.continue}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.integrations.cancel}
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
  const { t } = useI18n();
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
          <h3>
            {fmt(t.integrations.configurationForm.title, {
              name: integration.name,
            })}
          </h3>
          <p>{t.integrations.configurationForm.intro}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={t.integrations.configurationForm.closeAria}
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
          <small>{field.help ?? t.integrations.configurationForm.help}</small>
        </label>
      ))}
      {save.isError ? (
        <InlineNotice
          tone="danger"
          title={t.integrations.configurationForm.notSavedTitle}
        >
          {save.error.message}
        </InlineNotice>
      ) : null}
      <div className="form-actions">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? t.integrations.configurationForm.saving
            : t.integrations.configurationForm.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.integrations.cancel}
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
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmed) onConfirm();
  }

  return (
    <form className="integration-removal-form" onSubmit={submit}>
      <div className="credential-heading">
        <div>
          <h3>
            {fmt(t.integrations.removal.title, { name: integration.name })}
          </h3>
          <p>{t.integrations.removal.intro}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={t.integrations.removal.closeAria}
          disabled={isPending}
        >
          <Icon name="close" />
        </button>
      </div>
      <InlineNotice
        tone="warning"
        title={t.integrations.removal.providerNoticeTitle}
      >
        {t.integrations.removal.providerNoticeBody}
      </InlineNotice>
      <label className="integration-removal-confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.currentTarget.checked)}
        />
        <span>
          {fmt(t.integrations.removal.acknowledgement, {
            name: integration.name,
          })}
        </span>
      </label>
      {error ? (
        <InlineNotice
          tone="danger"
          title={t.integrations.removal.notRemovedTitle}
        >
          {error.message}
        </InlineNotice>
      ) : null}
      <div className="form-actions">
        <Button
          type="submit"
          variant="danger"
          disabled={!confirmed || isPending}
        >
          {isPending
            ? t.integrations.removal.removing
            : t.integrations.removal.remove}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isPending}
        >
          {t.integrations.cancel}
        </Button>
      </div>
    </form>
  );
}

export function IntegrationsPage() {
  const { t } = useI18n();
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
        eyebrow={t.integrations.eyebrow}
        title={t.integrations.title}
        description={t.integrations.description}
      />
      <InlineNotice tone="info" title={t.integrations.vaultNoticeTitle}>
        {t.integrations.vaultNoticeBody}
      </InlineNotice>

      {testIntegration.isError ? (
        <InlineNotice tone="danger" title={t.integrations.testFailedTitle}>
          {testIntegration.error.message}
        </InlineNotice>
      ) : null}
      {testIntegration.isSuccess ? (
        <InlineNotice tone="success" title={t.integrations.testCompleteTitle}>
          {t.integrations.testCompleteBody}
        </InlineNotice>
      ) : null}
      {removeIntegration.isSuccess ? (
        <InlineNotice tone="success" title={t.integrations.removedTitle}>
          {t.integrations.removedBody}
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
                  // The card's inner heading changes while a sub-form is open
                  // ("Configure SerpAPI" replaces "SerpAPI"), so the provider
                  // name lives on the container instead. That keeps the card
                  // identifiable to assistive technology and to tests no matter
                  // which form is showing.
                  role="group"
                  aria-label={integration.name}
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
                          {integration.category ??
                            t.integrations.card.categoryFallback}
                        </span>
                        <h2>{integration.name}</h2>
                        <p>
                          {integration.description ??
                            t.integrations.card.descriptionFallback}
                        </p>
                      </div>
                      <dl className="integration-meta">
                        <div>
                          <dt>{t.integrations.card.account}</dt>
                          <dd>
                            {integration.accountLabel ??
                              t.integrations.card.notConnected}
                          </dd>
                        </div>
                        <div>
                          <dt>{t.integrations.card.lastVerifiedSync}</dt>
                          <dd>{formatDate(integration.lastSyncAt, true)}</dd>
                        </div>
                        <div>
                          <dt>{t.integrations.card.quotaRemaining}</dt>
                          <dd>
                            {integration.quota
                              ? `${integration.quota.remaining}${integration.quota.limit === null ? "" : ` / ${integration.quota.limit}`}`
                              : t.common.unavailable}
                          </dd>
                        </div>
                        <div>
                          <dt>{t.integrations.card.quotaReset}</dt>
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
                              ? t.integrations.card.rotateCredentials
                              : !hasRequiredCredentials
                                ? t.integrations.card.addOptionalApiKey
                                : usesSingleApiKey
                                  ? t.integrations.card.connectApiKey
                                  : t.integrations.card.connectCredentials}
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
                              ? t.integrations.card.connectAccount
                              : t.integrations.card.reconnectAccount}{" "}
                            <Icon name="external" />
                          </a>
                        ) : null}
                        {integration.configurationFields?.length ? (
                          <Button
                            variant="secondary"
                            onClick={() => setConfiguringId(integration.id)}
                          >
                            {Object.keys(integration.configuration ?? {}).length
                              ? t.integrations.card.editSiteMapping
                              : t.integrations.card.configureSite}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          onClick={() => testIntegration.mutate(integration.id)}
                          disabled={testIntegration.isPending}
                        >
                          {t.integrations.card.testConnection}
                        </Button>
                        {integration.status !== "not_configured" ? (
                          <Button
                            variant="ghost"
                            aria-label={fmt(t.integrations.card.revokeAria, {
                              name: integration.name,
                            })}
                            onClick={() => setRemovingId(integration.id)}
                          >
                            {t.integrations.card.revoke}
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
            title={t.integrations.emptyTitle}
            description={t.integrations.emptyDescription}
          />
        )}
      </QueryState>
    </div>
  );
}
