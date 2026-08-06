import { useEffect, useMemo, useState } from "react";
import { useSite } from "../context/site-context";
import {
  useBrandKit,
  useCreateEmailTemplate,
  useEmailStarter,
  useEmailTemplate,
  useEmailTemplates,
  usePreviewEmail,
  useReviseBrandKit,
  useSaveEmailVersion,
} from "../api/queries";
import type {
  BrandKitProfile,
  EmailFinding,
  EmailValidationReport,
} from "../api/contracts";

/**
 * The email builder.
 *
 * Two decisions shape this page.
 *
 * The preview is a sandboxed iframe with no scripts and no same-origin access.
 * It renders HTML that a language model wrote, and the compiler already
 * stripped what it could — but a preview that executes what it displays is a
 * hole in a product whose whole job here is to be the thing that does not
 * trust the input.
 *
 * The report an operator reads is the same one the agent iterates against. A
 * friendlier summary for humans would drift from the specification the model
 * is working to, and then the two would disagree about whether the email is
 * finished.
 */

const SEVERITY_TONE: Record<EmailFinding["severity"], string> = {
  blocking: "bad",
  error: "bad",
  warning: "pending",
  info: "muted",
};

const EMPTY_PROFILE: BrandKitProfile = {
  colors: [
    { name: "Text", value: "#101828", usage: "Body copy" },
    { name: "Background", value: "#f4f4f5", usage: "Outer canvas" },
    { name: "Surface", value: "#ffffff", usage: "Content card" },
    { name: "Accent", value: "#1570ef", usage: "Buttons and links" },
  ],
  typefaces: [
    {
      role: "heading",
      stack: "Arial, Helvetica, sans-serif",
      sizePx: 24,
      lineHeight: 1.3,
      weight: 700,
    },
    {
      role: "body",
      stack: "Arial, Helvetica, sans-serif",
      sizePx: 16,
      lineHeight: 1.5,
      weight: 400,
    },
  ],
  logoMediaId: null,
  logoAltText: null,
  contentWidthPx: 600,
  buttonRadiusPx: 4,
  voice: null,
  prohibitions: [],
  footer: {
    companyName: "",
    postalAddress: "",
    unsubscribePlaceholder: "{{unsubscribe_url}}",
    legalNotes: null,
  },
  referenceMediaId: null,
  referenceNotes: null,
};

function ReportPanel({ report }: { report: EmailValidationReport }) {
  const order: EmailFinding["severity"][] = [
    "blocking",
    "error",
    "warning",
    "info",
  ];
  const sorted = [...report.findings].sort(
    (left, right) =>
      order.indexOf(left.severity) - order.indexOf(right.severity),
  );

  return (
    <>
      <p className="pixel-hero-sub">
        {report.ok ? (
          <>
            Nothing blocking or broken. {Math.round(report.sizeBytes / 1024)}KB
            compiled
            {report.counts.warning > 0
              ? `, with ${report.counts.warning} warning${report.counts.warning === 1 ? "" : "s"} worth reading.`
              : "."}
          </>
        ) : (
          <>
            {report.counts.blocking > 0
              ? `${report.counts.blocking} thing(s) were removed from what you submitted, so the document you have is not the one you wrote. `
              : ""}
            {report.counts.error} error
            {report.counts.error === 1 ? "" : "s"} will visibly break in at
            least one client.
          </>
        )}
      </p>
      {sorted.length === 0 ? null : (
        <ul className="pixel-list">
          {sorted.map((finding, index) => (
            <li key={`${finding.rule}-${index}`} className="pixel-list-row">
              <div>
                <span
                  className={`pixel-tag pixel-tag-${SEVERITY_TONE[finding.severity]}`}
                >
                  {finding.severity}
                </span>{" "}
                <strong>{finding.message}</strong>
              </div>
              {finding.remedy ? (
                <p className="pixel-hero-sub">{finding.remedy}</p>
              ) : null}
              <p className="pixel-hero-sub">
                {finding.where ? `${finding.where} · ` : ""}
                {finding.affects.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function BrandKitEditor({ siteId }: { siteId: string }) {
  const brandKit = useBrandKit(siteId);
  const revise = useReviseBrandKit(siteId);
  const [draft, setDraft] = useState<BrandKitProfile | null>(null);
  const [summary, setSummary] = useState("");

  const current = brandKit.data?.data.current?.profile;
  const profile = draft ?? current ?? EMPTY_PROFILE;

  const update = (patch: Partial<BrandKitProfile>): void =>
    setDraft({ ...profile, ...patch });

  return (
    <section className="pixel-panel">
      <div className="pixel-panel-head">
        <h2>Brand kit</h2>
        <span className="pixel-panel-mark">
          {brandKit.data?.data.current
            ? `revision ${brandKit.data.data.current.revision}`
            : "not set up"}
        </span>
      </div>
      <div className="pixel-panel-body">
        <p className="pixel-hero-sub">
          What an agent writes emails against, and what the compiler checks the
          result for. The postal address and the unsubscribe tag are not
          styling: commercial email is legally required to carry both.
        </p>

        <div className="pixel-subsection">
          <h4>Colours</h4>
          {profile.colors.map((color, index) => (
            <div key={index} className="pixel-row-actions">
              <input
                className="pixel-input"
                value={color.name}
                aria-label={`Colour ${index + 1} name`}
                onChange={(event) =>
                  update({
                    colors: profile.colors.map((entry, position) =>
                      position === index
                        ? { ...entry, name: event.target.value }
                        : entry,
                    ),
                  })
                }
              />
              <input
                className="pixel-input"
                type="color"
                value={color.value}
                aria-label={`Colour ${index + 1} value`}
                onChange={(event) =>
                  update({
                    colors: profile.colors.map((entry, position) =>
                      position === index
                        ? { ...entry, value: event.target.value }
                        : entry,
                    ),
                  })
                }
              />
              <span className="pixel-hero-sub">
                {color.value} · {color.usage ?? "no stated use"}
              </span>
            </div>
          ))}
        </div>

        <div className="pixel-subsection">
          <h4>Type</h4>
          {profile.typefaces.map((face, index) => (
            <div key={index} className="pixel-row-actions">
              <span className="pixel-hero-sub">{face.role}</span>
              <input
                className="pixel-input"
                value={face.stack}
                aria-label={`${face.role} font stack`}
                onChange={(event) =>
                  update({
                    typefaces: profile.typefaces.map((entry, position) =>
                      position === index
                        ? { ...entry, stack: event.target.value }
                        : entry,
                    ),
                  })
                }
              />
            </div>
          ))}
          <p className="pixel-hero-sub">
            End every stack with a generic family. Outlook and Gmail's mobile
            apps ignore web fonts, and with nothing to fall back to they pick
            their own default.
          </p>
        </div>

        <div className="pixel-subsection">
          <h4>Legal footer</h4>
          <div className="pixel-row-actions">
            <input
              className="pixel-input"
              placeholder="Company name"
              value={profile.footer.companyName}
              aria-label="Company name"
              onChange={(event) =>
                update({
                  footer: {
                    ...profile.footer,
                    companyName: event.target.value,
                  },
                })
              }
            />
            <input
              className="pixel-input"
              placeholder="Postal address"
              value={profile.footer.postalAddress}
              aria-label="Postal address"
              onChange={(event) =>
                update({
                  footer: {
                    ...profile.footer,
                    postalAddress: event.target.value,
                  },
                })
              }
            />
            <input
              className="pixel-input"
              placeholder="{{unsubscribe_url}}"
              value={profile.footer.unsubscribePlaceholder}
              aria-label="Unsubscribe merge tag"
              onChange={(event) =>
                update({
                  footer: {
                    ...profile.footer,
                    unsubscribePlaceholder: event.target.value,
                  },
                })
              }
            />
          </div>
          <p className="pixel-hero-sub">
            The unsubscribe tag is whatever your email service substitutes —
            Mailchimp uses <code>*|UNSUB|*</code>, most others use a{" "}
            <code>
              {"{{"}handlebars{"}}"}
            </code>{" "}
            form. Stored verbatim, because guessing it produces a dead link in a
            legally required place.
          </p>
        </div>

        <div className="pixel-subsection">
          <h4>Voice</h4>
          <textarea
            className="pixel-input"
            rows={3}
            placeholder="How the brand sounds. Read by the agent writing the copy."
            value={profile.voice ?? ""}
            aria-label="Brand voice"
            onChange={(event) => update({ voice: event.target.value || null })}
          />
        </div>

        <div className="pixel-row-actions">
          <input
            className="pixel-input"
            placeholder="What changed, and why"
            value={summary}
            aria-label="Change summary"
            onChange={(event) => setSummary(event.target.value)}
          />
          <button
            type="button"
            className="pixel-button pixel-button-primary"
            disabled={!draft || !summary.trim() || revise.isPending}
            onClick={() =>
              revise.mutate(
                { profile, changeSummary: summary.trim() },
                {
                  onSuccess: () => {
                    setDraft(null);
                    setSummary("");
                  },
                },
              )
            }
          >
            Save a revision
          </button>
        </div>
        <p className="pixel-hero-sub">
          Every save appends a revision. An email built last quarter can still
          say which brand it was built against.
        </p>
      </div>
    </section>
  );
}

export function EmailBuilderPage() {
  const { siteId } = useSite();
  const templates = useEmailTemplates(siteId);
  const createTemplate = useCreateEmailTemplate(siteId);
  const [selectedId, setSelectedId] = useState<string>("");
  const workspace = useEmailTemplate(selectedId);
  const preview = usePreviewEmail(siteId);
  const starter = useEmailStarter(siteId);
  const save = useSaveEmailVersion(siteId, selectedId);

  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [html, setHtml] = useState("");
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [newName, setNewName] = useState("");

  const items = templates.data?.data.items ?? [];
  const current = workspace.data?.data.current;

  // Loading a template replaces the editor with the stored source, which is
  // what a person edits next — not the compiled output.
  useEffect(() => {
    if (!current) return;
    setSubject(current.subject);
    setPreheader(current.preheader);
    setHtml(current.sourceHtml);
  }, [current]);

  const report = preview.data?.data.report ?? current?.report ?? null;
  const rendered =
    preview.data?.data.compiledHtml ?? current?.compiledHtml ?? "";
  const canSave = useMemo(
    () => Boolean(selectedId && subject.trim() && html.trim()),
    [selectedId, subject, html],
  );

  return (
    <>
      <BrandKitEditor siteId={siteId} />

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>Templates</h2>
          <div className="pixel-row-actions">
            <input
              className="pixel-input"
              placeholder="New template name"
              value={newName}
              aria-label="New template name"
              onChange={(event) => setNewName(event.target.value)}
            />
            <button
              type="button"
              className="pixel-button"
              disabled={!newName.trim() || createTemplate.isPending}
              onClick={() =>
                createTemplate.mutate(
                  { name: newName.trim() },
                  {
                    onSuccess: (created) => {
                      setSelectedId(created.data.id);
                      setNewName("");
                    },
                  },
                )
              }
            >
              Create
            </button>
          </div>
        </div>
        <div className="pixel-panel-body">
          {items.length === 0 ? (
            <p className="pixel-hero-sub">
              No templates yet. Create one, then write the HTML here or ask an
              attached agent to draft it against your brand kit.
            </p>
          ) : (
            <ul className="pixel-list">
              {items.map((template) => (
                <li key={template.id} className="pixel-list-row">
                  <label>
                    <input
                      type="radio"
                      name="template"
                      checked={selectedId === template.id}
                      onChange={() => setSelectedId(template.id)}
                    />{" "}
                    <strong>{template.name}</strong>
                  </label>
                  <p className="pixel-hero-sub">
                    {template.latestRevision === 0
                      ? "no revisions yet"
                      : `revision ${template.latestRevision} · updated ${new Date(template.updatedAt).toLocaleString()}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {selectedId ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>Compose</h2>
            <div className="pixel-row-actions">
              <button
                type="button"
                className="pixel-button"
                disabled={starter.isPending}
                onClick={() =>
                  starter.mutate(undefined, {
                    onSuccess: (result) => setHtml(result.data.html),
                  })
                }
                title="A table-based document already built from your brand kit that passes every check."
              >
                Start from the brand kit
              </button>
              <button
                type="button"
                className="pixel-button"
                disabled={!subject.trim() || !html.trim() || preview.isPending}
                onClick={() => preview.mutate({ subject, preheader, html })}
              >
                {preview.isPending ? "Checking…" : "Check"}
              </button>
              <button
                type="button"
                className="pixel-button pixel-button-primary"
                disabled={!canSave || save.isPending}
                onClick={() => save.mutate({ subject, preheader, html })}
              >
                Save revision
              </button>
            </div>
          </div>
          <div className="pixel-panel-body">
            <div className="pixel-row-actions">
              <input
                className="pixel-input"
                placeholder="Subject"
                value={subject}
                aria-label="Subject"
                onChange={(event) => setSubject(event.target.value)}
              />
              <input
                className="pixel-input"
                placeholder="Preheader — the line the inbox shows after the subject"
                value={preheader}
                aria-label="Preheader"
                onChange={(event) => setPreheader(event.target.value)}
              />
            </div>
            <textarea
              className="pixel-input pixel-code-editor"
              rows={18}
              spellCheck={false}
              placeholder="Email HTML"
              value={html}
              aria-label="Email HTML"
              onChange={(event) => setHtml(event.target.value)}
            />
            {preview.isError ? (
              <p className="pixel-hero-sub" role="alert">
                {preview.error instanceof Error
                  ? preview.error.message
                  : "The email could not be compiled."}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>What clients will do with it</h2>
          </div>
          <div className="pixel-panel-body">
            <ReportPanel report={report} />
          </div>
        </section>
      ) : null}

      {rendered ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>Preview</h2>
            <div className="pixel-row-actions">
              <button
                type="button"
                className={`pixel-button${width === "desktop" ? " pixel-button-primary" : ""}`}
                onClick={() => setWidth("desktop")}
              >
                Desktop
              </button>
              <button
                type="button"
                className={`pixel-button${width === "mobile" ? " pixel-button-primary" : ""}`}
                onClick={() => setWidth("mobile")}
              >
                Mobile
              </button>
            </div>
          </div>
          <div className="pixel-panel-body">
            {/* No scripts, no same-origin, no top-level navigation. The
                compiler already stripped what it could; a preview that ran
                what it displays would undo that. */}
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={rendered}
              className="pixel-email-preview"
              style={{ width: width === "mobile" ? "375px" : "100%" }}
            />
            <details>
              <summary className="pixel-hero-sub">
                Compiled HTML — this is what you export
              </summary>
              <pre className="pixel-code">{rendered}</pre>
            </details>
            <details>
              <summary className="pixel-hero-sub">
                Plain-text alternative
              </summary>
              <pre className="pixel-code">
                {preview.data?.data.plainText ?? current?.plainText ?? ""}
              </pre>
            </details>
            <p className="pixel-hero-sub">
              Marketingovo does not send email. Copy the compiled HTML into your
              own email service, which already owns your list, your consent
              records and your unsubscribe handling.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}
