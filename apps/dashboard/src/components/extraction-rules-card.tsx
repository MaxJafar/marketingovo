import { useEffect, useState, type FormEvent } from "react";
import type { ExtractionRule, ExtractionRuleTemplate } from "../api/contracts";
import {
  useExtractionRuleTemplates,
  useExtractionRules,
  usePreviewExtractionRules,
  useUpdateExtractionRules,
} from "../api/queries";
import { fmt, useI18n } from "../i18n";
import { FreshnessNotice } from "./data-state";
import { Button, Card, InlineNotice } from "./ui";

function createRule(): ExtractionRule {
  return {
    id: crypto.randomUUID(),
    label: "",
    selector: "",
    type: "text",
    attribute: null,
    regex: null,
    enabled: true,
  };
}

export function ExtractionRulesCard({
  siteId,
  siteUrl,
}: {
  siteId: string;
  siteUrl: string;
}) {
  const { t } = useI18n();
  const query = useExtractionRules(siteId);
  const templatesQuery = useExtractionRuleTemplates();
  const update = useUpdateExtractionRules(siteId);
  const preview = usePreviewExtractionRules(siteId);
  const workspace = query.data?.data;
  const revision = workspace?.current?.revision ?? null;
  const workspaceIdentity = workspace
    ? `${workspace.projectId}:${revision ?? "empty"}`
    : null;
  const [loadedWorkspaceIdentity, setLoadedWorkspaceIdentity] = useState<
    string | null
  >();
  const editorReady =
    workspaceIdentity !== null && loadedWorkspaceIdentity === workspaceIdentity;
  const [rules, setRules] = useState<ExtractionRule[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [previewUrl, setPreviewUrl] = useState(siteUrl);
  const [renderMode, setRenderMode] = useState<"static" | "js">("static");
  const [allowPrivateHost, setAllowPrivateHost] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [importedTemplateName, setImportedTemplateName] = useState<
    string | null
  >(null);

  const templates = templatesQuery.data?.data.templates ?? [];
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;
  const draftLabels = new Set(
    rules.map((rule) => rule.label.trim().toLocaleLowerCase("en-US")),
  );
  const conflictingTemplateRules =
    selectedTemplate?.rules.filter((rule) =>
      draftLabels.has(rule.label.trim().toLocaleLowerCase("en-US")),
    ) ?? [];
  const templateExceedsCapacity = Boolean(
    selectedTemplate && rules.length + selectedTemplate.rules.length > 50,
  );

  useEffect(() => {
    if (!workspace || loadedWorkspaceIdentity === workspaceIdentity) return;
    setRules(workspace.current?.rules ?? []);
    setLoadedWorkspaceIdentity(workspaceIdentity);
    setChangeSummary("");
    setSelectedTemplateId(null);
    setImportedTemplateName(null);
  }, [loadedWorkspaceIdentity, workspace, workspaceIdentity]);

  useEffect(() => setPreviewUrl(siteUrl), [siteUrl]);

  function patchRule(id: string, patch: Partial<ExtractionRule>) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...patch,
              ...(patch.type && patch.type !== "attribute"
                ? { attribute: null }
                : {}),
            }
          : rule,
      ),
    );
  }

  function saveRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate({ rules, changeSummary });
  }

  function previewRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    preview.mutate({
      url: previewUrl,
      renderMode,
      allowPrivateHost,
      rules,
    });
  }

  function addTemplateToDraft(template: ExtractionRuleTemplate) {
    if (conflictingTemplateRules.length > 0 || templateExceedsCapacity) return;
    setRules((current) => [
      ...current,
      ...template.rules.map((rule) => ({
        ...rule,
        id: crypto.randomUUID(),
      })),
    ]);
    setImportedTemplateName(template.name);
    setSelectedTemplateId(null);
  }

  return (
    <Card className="settings-card extraction-rules-card">
      <div className="extraction-rules-heading">
        <div>
          <p className="eyebrow">{t.extractionRules.eyebrow}</p>
          <h2>{t.extractionRules.title}</h2>
          <p>{t.extractionRules.description}</p>
        </div>
        {workspace?.current ? (
          <div
            className="extraction-revision"
            aria-label={t.extractionRules.currentRuleSet}
          >
            <strong>
              {fmt(t.extractionRules.revisionLabel, {
                revision: workspace.current.revision,
              })}
            </strong>
            <code title={workspace.current.configurationHash}>
              {workspace.current.configurationHash.slice(0, 12)}
            </code>
          </div>
        ) : null}
      </div>
      <FreshnessNotice meta={query.data?.meta} />
      {query.isLoading ? (
        <p role="status">{t.extractionRules.loadingRules}</p>
      ) : null}
      {!query.isLoading && workspace && !editorReady ? (
        <p role="status">{t.extractionRules.preparingEditor}</p>
      ) : null}
      {query.error ? (
        <InlineNotice
          tone="danger"
          title={t.extractionRules.rulesUnavailableTitle}
        >
          {query.error.message}
        </InlineNotice>
      ) : null}
      {update.isSuccess ? (
        <InlineNotice
          tone="success"
          title={t.extractionRules.revisionSavedTitle}
        >
          {t.extractionRules.revisionSavedBody}
        </InlineNotice>
      ) : null}
      {update.isError ? (
        <InlineNotice
          tone="danger"
          title={t.extractionRules.revisionRejectedTitle}
        >
          {update.error.message}
        </InlineNotice>
      ) : null}

      <section
        className="extraction-template-library"
        aria-labelledby="extraction-template-heading"
      >
        <div className="extraction-template-heading">
          <div>
            <p className="eyebrow">{t.extractionRules.template.eyebrow}</p>
            <h3 id="extraction-template-heading">
              {t.extractionRules.template.title}
            </h3>
            <p>{t.extractionRules.template.description}</p>
          </div>
          <span className="template-policy-pill">
            {t.extractionRules.template.policyPill}
          </span>
        </div>
        {templatesQuery.isLoading ? (
          <p role="status">{t.extractionRules.template.loading}</p>
        ) : null}
        {templatesQuery.isError ? (
          <InlineNotice
            tone="danger"
            title={t.extractionRules.template.catalogUnavailableTitle}
          >
            {templatesQuery.error.message}
          </InlineNotice>
        ) : null}
        {templates.length > 0 ? (
          <div
            className="extraction-template-grid"
            aria-label={t.extractionRules.template.gridLabel}
          >
            {templates.map((template) => (
              <button
                type="button"
                className={`extraction-template-card ${
                  selectedTemplateId === template.id
                    ? "extraction-template-selected"
                    : ""
                }`}
                aria-pressed={selectedTemplateId === template.id}
                aria-label={fmt(t.extractionRules.template.review, {
                  name: template.name,
                })}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setImportedTemplateName(null);
                }}
                key={template.id}
              >
                <span>{template.category}</span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
                <b>
                  {fmt(t.extractionRules.template.fieldsCount, {
                    count: template.rules.length,
                  })}
                </b>
              </button>
            ))}
          </div>
        ) : null}
        {importedTemplateName ? (
          <InlineNotice
            tone="success"
            title={t.extractionRules.template.addedTitle}
          >
            {fmt(t.extractionRules.template.addedBody, {
              name: importedTemplateName,
            })}
          </InlineNotice>
        ) : null}

        {selectedTemplate ? (
          <div className="extraction-template-review">
            <div className="extraction-template-review-heading">
              <div>
                <p className="eyebrow">
                  {t.extractionRules.template.reviewEyebrow}
                </p>
                <h4>{selectedTemplate.name}</h4>
                <p>{selectedTemplate.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedTemplateId(null)}
              >
                {t.extractionRules.template.closeReview}
              </Button>
            </div>
            <dl className="extraction-template-guidance">
              <div>
                <dt>{t.extractionRules.template.previewOn}</dt>
                <dd>{selectedTemplate.recommendedPage}</dd>
              </div>
              <div>
                <dt>{t.extractionRules.template.beforeSaving}</dt>
                <dd>{t.extractionRules.template.beforeSavingBody}</dd>
              </div>
            </dl>
            <div>
              <strong className="template-assumption-label">
                {t.extractionRules.template.assumptionsLabel}
              </strong>
              <ul className="template-assumption-list">
                {selectedTemplate.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
            <div className="table-shell extraction-template-table">
              <table
                aria-label={fmt(t.extractionRules.template.fieldsTable, {
                  name: selectedTemplate.name,
                })}
              >
                <thead>
                  <tr>
                    <th>{t.extractionRules.template.fieldColumn}</th>
                    <th>{t.extractionRules.template.selectorColumn}</th>
                    <th>{t.extractionRules.template.captureColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTemplate.rules.map((rule) => (
                    <tr key={rule.id}>
                      <th scope="row">{rule.label}</th>
                      <td>
                        <code>{rule.selector}</code>
                      </td>
                      <td>
                        {rule.type === "attribute"
                          ? fmt(t.extractionRules.template.attributeCapture, {
                              attribute: String(rule.attribute),
                            })
                          : rule.type === "html"
                            ? t.extractionRules.captureOptions.html
                            : t.extractionRules.captureOptions.text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {conflictingTemplateRules.length > 0 ? (
              <InlineNotice
                tone="danger"
                title={t.extractionRules.template.conflictTitle}
              >
                {conflictingTemplateRules.length === 1
                  ? fmt(t.extractionRules.template.conflictBodyOne, {
                      labels: conflictingTemplateRules
                        .map((rule) => rule.label)
                        .join(", "),
                    })
                  : fmt(t.extractionRules.template.conflictBodyMany, {
                      labels: conflictingTemplateRules
                        .map((rule) => rule.label)
                        .join(", "),
                    })}
              </InlineNotice>
            ) : null}
            {templateExceedsCapacity ? (
              <InlineNotice
                tone="danger"
                title={t.extractionRules.template.capacityTitle}
              >
                {t.extractionRules.template.capacityBody}
              </InlineNotice>
            ) : null}
            <div className="extraction-template-review-actions">
              <Button
                type="button"
                onClick={() => addTemplateToDraft(selectedTemplate)}
                disabled={
                  !editorReady ||
                  conflictingTemplateRules.length > 0 ||
                  templateExceedsCapacity
                }
              >
                {selectedTemplate.rules.length === 1
                  ? fmt(t.extractionRules.template.addFieldsOne, {
                      count: selectedTemplate.rules.length,
                    })
                  : fmt(t.extractionRules.template.addFieldsMany, {
                      count: selectedTemplate.rules.length,
                    })}
              </Button>
              <small>{t.extractionRules.template.freshIdsNote}</small>
            </div>
          </div>
        ) : null}
      </section>

      <form className="extraction-rules-form" onSubmit={saveRules}>
        <div
          className="extraction-rule-list"
          aria-label={t.extractionRules.editor.listLabel}
        >
          {rules.length === 0 ? (
            <p className="empty-rule-state">{t.extractionRules.editor.empty}</p>
          ) : null}
          {rules.map((rule, index) => {
            const prefix = `extraction-rule-${rule.id}`;
            return (
              <fieldset className="extraction-rule-row" key={rule.id}>
                <legend>
                  {fmt(t.extractionRules.editor.ruleLegend, {
                    number: index + 1,
                  })}
                </legend>
                <div className="extraction-rule-toolbar">
                  <label className="checkbox-label compact-checkbox">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) =>
                        patchRule(rule.id, {
                          enabled: event.currentTarget.checked,
                        })
                      }
                    />
                    <span>{t.extractionRules.editor.enabled}</span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setRules((current) =>
                        current.filter((candidate) => candidate.id !== rule.id),
                      )
                    }
                    aria-label={fmt(t.extractionRules.editor.removeRule, {
                      number: index + 1,
                    })}
                  >
                    {t.extractionRules.editor.remove}
                  </Button>
                </div>
                <div className="form-grid extraction-rule-grid">
                  <label htmlFor={`${prefix}-label`}>
                    {t.extractionRules.editor.fieldLabel}
                    <input
                      id={`${prefix}-label`}
                      value={rule.label}
                      maxLength={240}
                      placeholder="Product price"
                      onChange={(event) =>
                        patchRule(rule.id, { label: event.currentTarget.value })
                      }
                      required
                    />
                  </label>
                  <label htmlFor={`${prefix}-type`}>
                    {t.extractionRules.editor.capture}
                    <select
                      id={`${prefix}-type`}
                      value={rule.type}
                      onChange={(event) =>
                        patchRule(rule.id, {
                          type: event.currentTarget
                            .value as ExtractionRule["type"],
                        })
                      }
                    >
                      <option value="text">
                        {t.extractionRules.captureOptions.text}
                      </option>
                      <option value="html">
                        {t.extractionRules.captureOptions.html}
                      </option>
                      <option value="attribute">
                        {t.extractionRules.captureOptions.attribute}
                      </option>
                    </select>
                  </label>
                  <label
                    className="extraction-selector-field"
                    htmlFor={`${prefix}-selector`}
                  >
                    {t.extractionRules.editor.cssSelector}
                    <input
                      id={`${prefix}-selector`}
                      value={rule.selector}
                      maxLength={2_000}
                      placeholder="[itemprop='price']"
                      spellCheck={false}
                      onChange={(event) =>
                        patchRule(rule.id, {
                          selector: event.currentTarget.value,
                        })
                      }
                      required
                    />
                  </label>
                  {rule.type === "attribute" ? (
                    <label htmlFor={`${prefix}-attribute`}>
                      {t.extractionRules.editor.attributeName}
                      <input
                        id={`${prefix}-attribute`}
                        value={rule.attribute ?? ""}
                        maxLength={256}
                        placeholder="content"
                        spellCheck={false}
                        onChange={(event) =>
                          patchRule(rule.id, {
                            attribute: event.currentTarget.value || null,
                          })
                        }
                        required
                      />
                    </label>
                  ) : null}
                  <label
                    className="extraction-regex-field"
                    htmlFor={`${prefix}-regex`}
                  >
                    {t.extractionRules.editor.regexLabel}{" "}
                    <span>{t.extractionRules.editor.regexOptional}</span>
                    <input
                      id={`${prefix}-regex`}
                      value={rule.regex ?? ""}
                      maxLength={512}
                      placeholder="USD\\s*([0-9.]+)"
                      spellCheck={false}
                      onChange={(event) =>
                        patchRule(rule.id, {
                          regex: event.currentTarget.value || null,
                        })
                      }
                    />
                    <small>{t.extractionRules.editor.regexHelp}</small>
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="form-actions extraction-rule-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRules((current) => [...current, createRule()])}
            disabled={!editorReady || rules.length >= 50}
          >
            {t.extractionRules.editor.addRule}
          </Button>
          <label className="revision-summary-field">
            {t.extractionRules.editor.revisionSummary}
            <input
              value={changeSummary}
              minLength={3}
              maxLength={240}
              placeholder="Capture product price and SKU"
              onChange={(event) => setChangeSummary(event.currentTarget.value)}
              required
            />
          </label>
          <Button type="submit" disabled={update.isPending || !editorReady}>
            {update.isPending
              ? t.extractionRules.editor.savingRevision
              : t.extractionRules.editor.saveRevision}
          </Button>
        </div>
      </form>

      <div className="extraction-preview-section">
        <div>
          <h3>{t.extractionRules.preview.title}</h3>
          <p>{t.extractionRules.preview.description}</p>
        </div>
        {preview.isError ? (
          <InlineNotice
            tone="danger"
            title={t.extractionRules.preview.failedTitle}
          >
            {preview.error.message}
          </InlineNotice>
        ) : null}
        <form className="extraction-preview-form" onSubmit={previewRules}>
          <label className="preview-url-field">
            {t.extractionRules.preview.pageUrl}
            <input
              type="url"
              value={previewUrl}
              onChange={(event) => setPreviewUrl(event.currentTarget.value)}
              required
            />
          </label>
          <label>
            {t.extractionRules.preview.rendering}
            <select
              value={renderMode}
              onChange={(event) =>
                setRenderMode(event.currentTarget.value as "static" | "js")
              }
            >
              <option value="static">
                {t.extractionRules.preview.renderOptions.static}
              </option>
              <option value="js">
                {t.extractionRules.preview.renderOptions.js}
              </option>
            </select>
          </label>
          <label className="checkbox-label compact-checkbox private-preview-optin">
            <input
              type="checkbox"
              checked={allowPrivateHost}
              onChange={(event) =>
                setAllowPrivateHost(event.currentTarget.checked)
              }
            />
            <span>
              <strong>{t.extractionRules.preview.allowPrivateHost}</strong>
              <small>{t.extractionRules.preview.allowPrivateHostHelp}</small>
            </span>
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={
              preview.isPending ||
              !editorReady ||
              !rules.some((rule) => rule.enabled)
            }
          >
            {preview.isPending
              ? t.extractionRules.preview.renderingPreview
              : t.extractionRules.preview.previewDraft}
          </Button>
        </form>
        {preview.data ? (
          <div className="extraction-preview-results" aria-live="polite">
            <div className="extraction-preview-meta">
              <strong>
                {fmt(t.extractionRules.preview.httpStatus, {
                  status: preview.data.data.statusCode,
                })}{" "}
                · {preview.data.data.renderMode}
              </strong>
              <span>
                {fmt(t.extractionRules.preview.responseTime, {
                  ms: Math.round(preview.data.data.responseTimeMs),
                })}
              </span>
              <a
                href={preview.data.data.finalUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t.extractionRules.preview.finalUrl}
              </a>
            </div>
            <div className="table-shell">
              <table aria-label={t.extractionRules.preview.resultsTable}>
                <thead>
                  <tr>
                    <th>{t.extractionRules.preview.fieldColumn}</th>
                    <th>{t.extractionRules.preview.resultColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.data.fields.map((field) => (
                    <tr key={field.ruleId}>
                      <th scope="row">{field.label}</th>
                      <td>
                        {field.value === null ? (
                          <span className="evidence-unavailable">
                            {t.extractionRules.preview.noMatch}
                          </span>
                        ) : (
                          <code>{field.value}</code>
                        )}
                        {field.truncated ? (
                          <small> {t.extractionRules.preview.truncated}</small>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
