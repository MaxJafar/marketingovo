import { useEffect, useState, type FormEvent } from "react";
import type { ExtractionRule, ExtractionRuleTemplate } from "../api/contracts";
import {
  useExtractionRuleTemplates,
  useExtractionRules,
  usePreviewExtractionRules,
  useUpdateExtractionRules,
} from "../api/queries";
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
          <p className="eyebrow">Evidence configuration</p>
          <h2>Custom extraction rules</h2>
          <p>
            Capture prices, authors, product IDs, CMS markers, or any other page
            field on every audit. Rules belong to this project and each saved
            revision remains available for reproducible run replay.
          </p>
        </div>
        {workspace?.current ? (
          <div className="extraction-revision" aria-label="Current rule set">
            <strong>Revision {workspace.current.revision}</strong>
            <code title={workspace.current.configurationHash}>
              {workspace.current.configurationHash.slice(0, 12)}
            </code>
          </div>
        ) : null}
      </div>
      <FreshnessNotice meta={query.data?.meta} />
      {query.isLoading ? <p role="status">Loading extraction rules…</p> : null}
      {!query.isLoading && workspace && !editorReady ? (
        <p role="status">Preparing the extraction editor…</p>
      ) : null}
      {query.error ? (
        <InlineNotice tone="danger" title="Extraction rules unavailable">
          {query.error.message}
        </InlineNotice>
      ) : null}
      {update.isSuccess ? (
        <InlineNotice tone="success" title="Rule revision saved">
          New audits will snapshot this revision. Existing runs and their
          evidence remain unchanged.
        </InlineNotice>
      ) : null}
      {update.isError ? (
        <InlineNotice tone="danger" title="Rule revision was rejected">
          {update.error.message}
        </InlineNotice>
      ) : null}

      <section
        className="extraction-template-library"
        aria-labelledby="extraction-template-heading"
      >
        <div className="extraction-template-heading">
          <div>
            <p className="eyebrow">Review-first library</p>
            <h3 id="extraction-template-heading">Extraction templates</h3>
            <p>
              Start from a curated evidence pack, inspect every selector, then
              add it to the unsaved draft. Templates never write a revision or
              start a crawl on their own.
            </p>
          </div>
          <span className="template-policy-pill">Review required</span>
        </div>
        {templatesQuery.isLoading ? (
          <p role="status">Loading extraction templates…</p>
        ) : null}
        {templatesQuery.isError ? (
          <InlineNotice tone="danger" title="Template catalog unavailable">
            {templatesQuery.error.message}
          </InlineNotice>
        ) : null}
        {templates.length > 0 ? (
          <div className="extraction-template-grid" aria-label="Templates">
            {templates.map((template) => (
              <button
                type="button"
                className={`extraction-template-card ${
                  selectedTemplateId === template.id
                    ? "extraction-template-selected"
                    : ""
                }`}
                aria-pressed={selectedTemplateId === template.id}
                aria-label={`Review ${template.name}`}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setImportedTemplateName(null);
                }}
                key={template.id}
              >
                <span>{template.category}</span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
                <b>{template.rules.length} fields</b>
              </button>
            ))}
          </div>
        ) : null}
        {importedTemplateName ? (
          <InlineNotice tone="success" title="Template added to draft">
            {importedTemplateName} fields are ready for review or preview below.
            Nothing is persisted until you provide a revision summary and choose
            Save revision.
          </InlineNotice>
        ) : null}

        {selectedTemplate ? (
          <div className="extraction-template-review">
            <div className="extraction-template-review-heading">
              <div>
                <p className="eyebrow">Draft import review</p>
                <h4>{selectedTemplate.name}</h4>
                <p>{selectedTemplate.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedTemplateId(null)}
              >
                Close review
              </Button>
            </div>
            <dl className="extraction-template-guidance">
              <div>
                <dt>Preview on</dt>
                <dd>{selectedTemplate.recommendedPage}</dd>
              </div>
              <div>
                <dt>Before saving</dt>
                <dd>
                  Preview a representative URL and remove or rename fields that
                  do not match this site.
                </dd>
              </div>
            </dl>
            <div>
              <strong className="template-assumption-label">
                Assumptions to verify
              </strong>
              <ul className="template-assumption-list">
                {selectedTemplate.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
            <div className="table-shell extraction-template-table">
              <table aria-label={`${selectedTemplate.name} fields`}>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>CSS selector</th>
                    <th>Capture</th>
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
                          ? `Attribute: ${rule.attribute}`
                          : rule.type === "html"
                            ? "Inner HTML"
                            : "Text content"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {conflictingTemplateRules.length > 0 ? (
              <InlineNotice tone="danger" title="Resolve field conflicts">
                Rename or remove the existing draft field
                {conflictingTemplateRules.length === 1 ? "" : "s"}:{" "}
                {conflictingTemplateRules.map((rule) => rule.label).join(", ")}.
                Template labels must stay unique.
              </InlineNotice>
            ) : null}
            {templateExceedsCapacity ? (
              <InlineNotice tone="danger" title="Rule limit exceeded">
                This pack would exceed the 50-rule project boundary. Remove
                draft rules before importing it.
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
                Add {selectedTemplate.rules.length} field
                {selectedTemplate.rules.length === 1 ? "" : "s"} to draft
              </Button>
              <small>
                Fresh rule IDs are created locally; catalog IDs are never
                persisted as if they were user-owned configuration.
              </small>
            </div>
          </div>
        ) : null}
      </section>

      <form className="extraction-rules-form" onSubmit={saveRules}>
        <div className="extraction-rule-list" aria-label="Extraction rules">
          {rules.length === 0 ? (
            <p className="empty-rule-state">
              No rules yet. Add one to turn page-specific data into auditable
              evidence.
            </p>
          ) : null}
          {rules.map((rule, index) => {
            const prefix = `extraction-rule-${rule.id}`;
            return (
              <fieldset className="extraction-rule-row" key={rule.id}>
                <legend>Rule {index + 1}</legend>
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
                    <span>Enabled</span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setRules((current) =>
                        current.filter((candidate) => candidate.id !== rule.id),
                      )
                    }
                    aria-label={`Remove rule ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
                <div className="form-grid extraction-rule-grid">
                  <label htmlFor={`${prefix}-label`}>
                    Field label
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
                    Capture
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
                      <option value="text">Text content</option>
                      <option value="html">Inner HTML</option>
                      <option value="attribute">Attribute</option>
                    </select>
                  </label>
                  <label
                    className="extraction-selector-field"
                    htmlFor={`${prefix}-selector`}
                  >
                    CSS selector
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
                      Attribute name
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
                    Safe regex filter <span>(optional)</span>
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
                    <small>
                      Capture group 1 is kept when present. Backreferences,
                      lookarounds, and ambiguous repetition are rejected.
                    </small>
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
            Add rule
          </Button>
          <label className="revision-summary-field">
            Revision summary
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
            {update.isPending ? "Saving revision…" : "Save revision"}
          </Button>
        </div>
      </form>

      <div className="extraction-preview-section">
        <div>
          <h3>Safe live preview</h3>
          <p>
            Fetch one URL on the project&apos;s exact origin through the same
            redirect-aware egress policy used by audits. Draft rules are never
            saved by previewing them.
          </p>
        </div>
        {preview.isError ? (
          <InlineNotice tone="danger" title="Preview failed">
            {preview.error.message}
          </InlineNotice>
        ) : null}
        <form className="extraction-preview-form" onSubmit={previewRules}>
          <label className="preview-url-field">
            Page URL
            <input
              type="url"
              value={previewUrl}
              onChange={(event) => setPreviewUrl(event.currentTarget.value)}
              required
            />
          </label>
          <label>
            Rendering
            <select
              value={renderMode}
              onChange={(event) =>
                setRenderMode(event.currentTarget.value as "static" | "js")
              }
            >
              <option value="static">Static HTML</option>
              <option value="js">JavaScript</option>
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
              <strong>Allow this exact private host</strong>
              <small>
                Required only for localhost or an approved internal site. Cloud
                metadata addresses remain blocked.
              </small>
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
            {preview.isPending ? "Rendering preview…" : "Preview draft"}
          </Button>
        </form>
        {preview.data ? (
          <div className="extraction-preview-results" aria-live="polite">
            <div className="extraction-preview-meta">
              <strong>
                HTTP {preview.data.data.statusCode} ·{" "}
                {preview.data.data.renderMode}
              </strong>
              <span>{Math.round(preview.data.data.responseTimeMs)} ms</span>
              <a
                href={preview.data.data.finalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Final URL
              </a>
            </div>
            <div className="table-shell">
              <table aria-label="Extraction preview results">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.data.fields.map((field) => (
                    <tr key={field.ruleId}>
                      <th scope="row">{field.label}</th>
                      <td>
                        {field.value === null ? (
                          <span className="evidence-unavailable">No match</span>
                        ) : (
                          <code>{field.value}</code>
                        )}
                        {field.truncated ? (
                          <small>
                            {" "}
                            Value truncated at the evidence boundary.
                          </small>
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
