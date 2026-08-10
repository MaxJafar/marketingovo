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
import { fmt, useI18n } from "../i18n";

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
  const { t } = useI18n();
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
            {fmt(t.emailBuilder.report.okSummary, {
              size: Math.round(report.sizeBytes / 1024),
            })}
            {report.counts.warning > 0
              ? fmt(
                  report.counts.warning === 1
                    ? t.emailBuilder.report.okWarningSingular
                    : t.emailBuilder.report.okWarningPlural,
                  { count: report.counts.warning },
                )
              : t.emailBuilder.report.okNoWarnings}
          </>
        ) : (
          <>
            {report.counts.blocking > 0
              ? fmt(t.emailBuilder.report.blockingRemoved, {
                  count: report.counts.blocking,
                })
              : ""}
            {fmt(
              report.counts.error === 1
                ? t.emailBuilder.report.errorSingular
                : t.emailBuilder.report.errorPlural,
              { count: report.counts.error },
            )}
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
  const { t } = useI18n();
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
        <h2>{t.emailBuilder.brandKit.title}</h2>
        <span className="pixel-panel-mark">
          {brandKit.data?.data.current
            ? fmt(t.emailBuilder.brandKit.revisionMark, {
                revision: brandKit.data.data.current.revision,
              })
            : t.emailBuilder.brandKit.notSetUp}
        </span>
      </div>
      <div className="pixel-panel-body">
        <p className="pixel-hero-sub">{t.emailBuilder.brandKit.intro}</p>

        <div className="pixel-subsection">
          <h4>{t.emailBuilder.brandKit.colours}</h4>
          {profile.colors.map((color, index) => (
            <div key={index} className="pixel-row-actions">
              <input
                className="pixel-input"
                value={color.name}
                aria-label={fmt(t.emailBuilder.brandKit.colourNameLabel, {
                  number: index + 1,
                })}
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
                aria-label={fmt(t.emailBuilder.brandKit.colourValueLabel, {
                  number: index + 1,
                })}
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
                {color.value} ·{" "}
                {color.usage ?? t.emailBuilder.brandKit.noStatedUse}
              </span>
            </div>
          ))}
        </div>

        <div className="pixel-subsection">
          <h4>{t.emailBuilder.brandKit.type}</h4>
          {profile.typefaces.map((face, index) => (
            <div key={index} className="pixel-row-actions">
              <span className="pixel-hero-sub">{face.role}</span>
              <input
                className="pixel-input"
                value={face.stack}
                aria-label={fmt(t.emailBuilder.brandKit.fontStackLabel, {
                  role: face.role,
                })}
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
            {t.emailBuilder.brandKit.fontStackHelp}
          </p>
        </div>

        <div className="pixel-subsection">
          <h4>{t.emailBuilder.brandKit.legalFooter}</h4>
          <div className="pixel-row-actions">
            <input
              className="pixel-input"
              placeholder={t.emailBuilder.brandKit.companyName}
              value={profile.footer.companyName}
              aria-label={t.emailBuilder.brandKit.companyName}
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
              placeholder={t.emailBuilder.brandKit.postalAddress}
              value={profile.footer.postalAddress}
              aria-label={t.emailBuilder.brandKit.postalAddress}
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
              aria-label={t.emailBuilder.brandKit.unsubscribeLabel}
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
            {t.emailBuilder.brandKit.unsubHelpBefore} <code>*|UNSUB|*</code>
            {t.emailBuilder.brandKit.unsubHelpMiddle}{" "}
            <code>
              {"{{"}handlebars{"}}"}
            </code>{" "}
            {t.emailBuilder.brandKit.unsubHelpAfter}
          </p>
        </div>

        <div className="pixel-subsection">
          <h4>{t.emailBuilder.brandKit.voice}</h4>
          <textarea
            className="pixel-input"
            rows={3}
            placeholder={t.emailBuilder.brandKit.voicePlaceholder}
            value={profile.voice ?? ""}
            aria-label={t.emailBuilder.brandKit.voiceLabel}
            onChange={(event) => update({ voice: event.target.value || null })}
          />
        </div>

        <div className="pixel-row-actions">
          <input
            className="pixel-input"
            placeholder={t.emailBuilder.brandKit.changeSummaryPlaceholder}
            value={summary}
            aria-label={t.emailBuilder.brandKit.changeSummaryLabel}
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
            {t.emailBuilder.brandKit.saveRevision}
          </button>
        </div>
        <p className="pixel-hero-sub">{t.emailBuilder.brandKit.revisionNote}</p>
      </div>
    </section>
  );
}

export function EmailBuilderPage() {
  const { t } = useI18n();
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
          <h2>{t.emailBuilder.templates.title}</h2>
          <div className="pixel-row-actions">
            <input
              className="pixel-input"
              placeholder={t.emailBuilder.templates.newNameLabel}
              value={newName}
              aria-label={t.emailBuilder.templates.newNameLabel}
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
              {t.emailBuilder.templates.create}
            </button>
          </div>
        </div>
        <div className="pixel-panel-body">
          {items.length === 0 ? (
            <p className="pixel-hero-sub">{t.emailBuilder.templates.empty}</p>
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
                      ? t.emailBuilder.templates.noRevisions
                      : fmt(t.emailBuilder.templates.revisionMeta, {
                          revision: template.latestRevision,
                          time: new Date(template.updatedAt).toLocaleString(),
                        })}
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
            <h2>{t.emailBuilder.compose.title}</h2>
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
                title={t.emailBuilder.compose.starterTitle}
              >
                {t.emailBuilder.compose.starter}
              </button>
              <button
                type="button"
                className="pixel-button"
                disabled={!subject.trim() || !html.trim() || preview.isPending}
                onClick={() => preview.mutate({ subject, preheader, html })}
              >
                {preview.isPending
                  ? t.emailBuilder.compose.checking
                  : t.emailBuilder.compose.check}
              </button>
              <button
                type="button"
                className="pixel-button pixel-button-primary"
                disabled={!canSave || save.isPending}
                onClick={() => save.mutate({ subject, preheader, html })}
              >
                {t.emailBuilder.compose.saveRevision}
              </button>
            </div>
          </div>
          <div className="pixel-panel-body">
            <div className="pixel-row-actions">
              <input
                className="pixel-input"
                placeholder={t.emailBuilder.compose.subject}
                value={subject}
                aria-label={t.emailBuilder.compose.subject}
                onChange={(event) => setSubject(event.target.value)}
              />
              <input
                className="pixel-input"
                placeholder={t.emailBuilder.compose.preheaderPlaceholder}
                value={preheader}
                aria-label={t.emailBuilder.compose.preheaderLabel}
                onChange={(event) => setPreheader(event.target.value)}
              />
            </div>
            <textarea
              className="pixel-input pixel-code-editor"
              rows={18}
              spellCheck={false}
              placeholder={t.emailBuilder.compose.emailHtml}
              value={html}
              aria-label={t.emailBuilder.compose.emailHtml}
              onChange={(event) => setHtml(event.target.value)}
            />
            {preview.isError ? (
              <p className="pixel-hero-sub" role="alert">
                {preview.error instanceof Error
                  ? preview.error.message
                  : t.emailBuilder.compose.compileFailed}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>{t.emailBuilder.report.title}</h2>
          </div>
          <div className="pixel-panel-body">
            <ReportPanel report={report} />
          </div>
        </section>
      ) : null}

      {rendered ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>{t.emailBuilder.preview.title}</h2>
            <div className="pixel-row-actions">
              <button
                type="button"
                className={`pixel-button${width === "desktop" ? " pixel-button-primary" : ""}`}
                onClick={() => setWidth("desktop")}
              >
                {t.emailBuilder.preview.desktop}
              </button>
              <button
                type="button"
                className={`pixel-button${width === "mobile" ? " pixel-button-primary" : ""}`}
                onClick={() => setWidth("mobile")}
              >
                {t.emailBuilder.preview.mobile}
              </button>
            </div>
          </div>
          <div className="pixel-panel-body">
            {/* No scripts, no same-origin, no top-level navigation. The
                compiler already stripped what it could; a preview that ran
                what it displays would undo that. */}
            <iframe
              title={t.emailBuilder.preview.frameTitle}
              sandbox=""
              srcDoc={rendered}
              className="pixel-email-preview"
              style={{ width: width === "mobile" ? "375px" : "100%" }}
            />
            <details>
              <summary className="pixel-hero-sub">
                {t.emailBuilder.preview.compiledSummary}
              </summary>
              <pre className="pixel-code">{rendered}</pre>
            </details>
            <details>
              <summary className="pixel-hero-sub">
                {t.emailBuilder.preview.plainTextSummary}
              </summary>
              <pre className="pixel-code">
                {preview.data?.data.plainText ?? current?.plainText ?? ""}
              </pre>
            </details>
            <p className="pixel-hero-sub">
              {t.emailBuilder.preview.exportNote}
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}
