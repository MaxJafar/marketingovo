import { useEffect, useMemo, useState } from "react";
import { useSite } from "../context/site-context";
import {
  useCampaignLinks,
  useCreateCampaignLink,
  useDeleteCampaignLink,
  useMarkCampaignLinkPrinted,
  usePreviewCampaignLink,
  useRedirectConfig,
} from "../api/queries";
import type {
  CampaignLink,
  CampaignLinkFinding,
  QrPlacement,
  QrStyle,
  RedirectTarget,
  UtmParameters,
} from "../api/contracts";
import { fmt, useI18n } from "../i18n";

/**
 * Campaign links and their QR codes.
 *
 * The page is built around one asymmetry: everything above the fold is free to
 * change, and the moment a code is printed none of it is. So the checks run
 * while typing rather than on submit, and the blocking ones prevent saving
 * instead of being recorded beside the code as a note nobody reads.
 *
 * The preview also refuses to be decorative. It shows the scan verdict at the
 * width the operator says they will print at, because a QR that looks fine on
 * a monitor is exactly the one that fails on a business card.
 */

const REDIRECT_TARGETS: Array<{
  value: RedirectTarget;
  label: string;
  expires: boolean;
}> = [
  { value: "cloudflare-worker", label: "Cloudflare Worker", expires: true },
  { value: "netlify", label: "Netlify", expires: false },
  { value: "vercel", label: "Vercel", expires: false },
  { value: "nginx", label: "nginx", expires: false },
  { value: "apache", label: "Apache", expires: false },
];

const SEVERITY_TONE: Record<string, string> = {
  blocking: "bad",
  warning: "pending",
  advice: "muted",
};

const VERDICT_TONE: Record<string, string> = {
  comfortable: "ok",
  tight: "pending",
  unscannable: "bad",
};

const EMPTY_UTM: UtmParameters = {
  source: "",
  medium: "",
  campaign: "",
  term: null,
  content: null,
};

const DEFAULT_STYLE: QrStyle = {
  errorCorrection: "M",
  quietZone: 4,
  darkColor: "#000000",
  lightColor: "#ffffff",
  transparent: false,
};

function FindingList({ findings }: { findings: CampaignLinkFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="pixel-list">
      {findings.map((finding, index) => (
        <li key={`${finding.rule}-${index}`} className="pixel-list-row">
          <div>
            <span
              className={`pixel-tag pixel-tag-${SEVERITY_TONE[finding.severity]}`}
            >
              {finding.severity}
            </span>{" "}
            <span>{finding.message}</span>
            {finding.remedy ? (
              <p className="pixel-hero-sub">{finding.remedy}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LinkRow({
  link,
  siteId,
  onDeleted,
}: {
  link: CampaignLink;
  siteId: string;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const markPrinted = useMarkCampaignLinkPrinted(siteId);
  const remove = useDeleteCampaignLink(siteId);
  const [copied, setCopied] = useState(false);

  return (
    <li className="pixel-list-row">
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <img
          src={`/api/v1/campaign-links/${encodeURIComponent(link.id)}/qr?format=svg`}
          alt={fmt(t.campaignLinks.links.qrAlt, { label: link.label })}
          width={72}
          height={72}
          style={{ imageRendering: "pixelated", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong>{link.label}</strong>
          {link.printedAt ? (
            <span className="pixel-tag pixel-tag-ok">
              {" "}
              {t.campaignLinks.links.printedTag}
            </span>
          ) : null}
          <p
            className="pixel-hero-sub"
            style={{ wordBreak: "break-all", margin: "4px 0" }}
          >
            {link.taggedUrl}
          </p>
          <p className="pixel-hero-sub">
            {link.utm.source} / {link.utm.medium} / {link.utm.campaign}
            {link.printedWidthMm ? ` · ${link.printedWidthMm}mm` : ""}
          </p>
          <div className="pixel-row-actions">
            <button
              type="button"
              className="pixel-button"
              onClick={() => {
                void navigator.clipboard.writeText(link.taggedUrl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied
                ? t.campaignLinks.links.copied
                : t.campaignLinks.links.copyLink}
            </button>
            <a
              className="pixel-button"
              href={`/api/v1/campaign-links/${encodeURIComponent(link.id)}/qr?format=svg`}
              download={`${link.label}.svg`}
            >
              {t.campaignLinks.links.svg}
            </a>
            <a
              className="pixel-button"
              href={`/api/v1/campaign-links/${encodeURIComponent(link.id)}/qr?format=png&scale=16`}
              download={`${link.label}.png`}
            >
              {t.campaignLinks.links.png}
            </a>
            {link.printedAt ? null : (
              <button
                type="button"
                className="pixel-button"
                onClick={() => markPrinted.mutate(link.id)}
                disabled={markPrinted.isPending}
              >
                {t.campaignLinks.links.markPrinted}
              </button>
            )}
            <button
              type="button"
              className="pixel-button"
              onClick={() => {
                remove.mutate(link.id, { onSuccess: onDeleted });
              }}
              disabled={remove.isPending}
            >
              {t.campaignLinks.links.delete}
            </button>
          </div>
          {link.findings.length > 0 ? (
            <details>
              <summary className="pixel-hero-sub">
                {link.findings.length === 1
                  ? fmt(t.campaignLinks.links.noteOne, {
                      count: link.findings.length,
                    })
                  : fmt(t.campaignLinks.links.noteMany, {
                      count: link.findings.length,
                    })}
              </summary>
              <FindingList findings={link.findings} />
            </details>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function CampaignLinksPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const links = useCampaignLinks(siteId);
  const preview = usePreviewCampaignLink(siteId);
  const create = useCreateCampaignLink(siteId);
  const redirectConfig = useRedirectConfig(siteId);

  const [label, setLabel] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [utm, setUtm] = useState<UtmParameters>(EMPTY_UTM);
  const [placement, setPlacement] = useState<QrPlacement>("print-handheld");
  const [printedWidthMm, setPrintedWidthMm] = useState(30);
  const [style, setStyle] = useState<QrStyle>(DEFAULT_STYLE);
  const [createError, setCreateError] = useState<string | null>(null);
  const [shortHost, setShortHost] = useState("");
  const [redirectTargetName, setRedirectTargetName] =
    useState<RedirectTarget>("cloudflare-worker");
  const [expiresAt, setExpiresAt] = useState("");

  const placements = useMemo<
    Array<{ value: QrPlacement; label: string; hint: string }>
  >(
    () => [
      {
        value: "screen",
        label: t.campaignLinks.placementOption.screen.label,
        hint: t.campaignLinks.placementOption.screen.hint,
      },
      {
        value: "print-handheld",
        label: t.campaignLinks.placementOption.printHandheld.label,
        hint: t.campaignLinks.placementOption.printHandheld.hint,
      },
      {
        value: "print-poster",
        label: t.campaignLinks.placementOption.printPoster.label,
        hint: t.campaignLinks.placementOption.printPoster.hint,
      },
      {
        value: "packaging",
        label: t.campaignLinks.placementOption.packaging.label,
        hint: t.campaignLinks.placementOption.packaging.hint,
      },
      {
        value: "outdoor",
        label: t.campaignLinks.placementOption.outdoor.label,
        hint: t.campaignLinks.placementOption.outdoor.hint,
      },
    ],
    [t],
  );

  const ready = Boolean(
    destinationUrl && utm.source && utm.medium && utm.campaign,
  );

  // Debounced so the preview follows typing without a request per keystroke.
  const previewMutate = preview.mutate;
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      previewMutate({
        destinationUrl,
        utm,
        style,
        placement,
        printedWidthMm,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    ready,
    destinationUrl,
    utm,
    style,
    placement,
    printedWidthMm,
    previewMutate,
  ]);

  // Every response is enveloped, so unwrap once here rather than at each use.
  const result = preview.data?.data ?? null;
  const config = redirectConfig.data?.data ?? null;
  const items = links.data?.data.items ?? [];
  const blocking = useMemo(
    () => (result?.findings ?? []).filter((f) => f.severity === "blocking"),
    [result],
  );
  const advisory = useMemo(
    () => (result?.findings ?? []).filter((f) => f.severity !== "blocking"),
    [result],
  );

  const normalized = result?.normalizedUtm ?? null;
  const needsNormalizing =
    normalized !== null &&
    (normalized.source !== utm.source ||
      normalized.medium !== utm.medium ||
      normalized.campaign !== utm.campaign);

  const selectedTarget = REDIRECT_TARGETS.find(
    (target) => target.value === redirectTargetName,
  );

  return (
    <>
      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.campaignLinks.form.heading}</h2>
          <span className="pixel-panel-mark">{t.campaignLinks.form.mark}</span>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">{t.campaignLinks.form.intro}</p>

          <label className="pixel-field">
            <span>{t.campaignLinks.form.nameLabel}</span>
            <input
              className="pixel-input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Summer flyer, café window"
            />
            <small className="pixel-hero-sub">
              {t.campaignLinks.form.nameHelp}
            </small>
          </label>

          <label className="pixel-field">
            <span>{t.campaignLinks.form.destinationLabel}</span>
            <input
              className="pixel-input"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
              placeholder="https://example.com/summer"
            />
            <small className="pixel-hero-sub">
              {t.campaignLinks.form.destinationHelp}
            </small>
          </label>

          <div className="pixel-grid-3">
            <label className="pixel-field">
              <span>{t.campaignLinks.form.sourceLabel}</span>
              <input
                className="pixel-input"
                value={utm.source}
                onChange={(event) =>
                  setUtm({ ...utm, source: event.target.value })
                }
                placeholder="flyer"
              />
              <small className="pixel-hero-sub">
                {t.campaignLinks.form.sourceHelp}
              </small>
            </label>
            <label className="pixel-field">
              <span>{t.campaignLinks.form.mediumLabel}</span>
              <input
                className="pixel-input"
                value={utm.medium}
                onChange={(event) =>
                  setUtm({ ...utm, medium: event.target.value })
                }
                placeholder="referral"
              />
              <small className="pixel-hero-sub">
                {t.campaignLinks.form.mediumHelp}
              </small>
            </label>
            <label className="pixel-field">
              <span>{t.campaignLinks.form.campaignLabel}</span>
              <input
                className="pixel-input"
                value={utm.campaign}
                onChange={(event) =>
                  setUtm({ ...utm, campaign: event.target.value })
                }
                placeholder="summer-sale-2026"
              />
              <small className="pixel-hero-sub">
                {t.campaignLinks.form.campaignHelp}
              </small>
            </label>
          </div>

          {needsNormalizing && normalized ? (
            <div className="pixel-subsection">
              <p className="pixel-hero-sub">
                {t.campaignLinks.form.normalizedBefore}{" "}
                <strong>
                  {normalized.source} / {normalized.medium} /{" "}
                  {normalized.campaign}
                </strong>
                {t.campaignLinks.form.normalizedAfter}
              </p>
              <button
                type="button"
                className="pixel-button"
                onClick={() => setUtm(normalized)}
              >
                {t.campaignLinks.form.useThat}
              </button>
            </div>
          ) : null}

          <div className="pixel-grid-2">
            <label className="pixel-field">
              <span>{t.campaignLinks.form.placementLabel}</span>
              <select
                className="pixel-input"
                value={placement}
                onChange={(event) =>
                  setPlacement(event.target.value as QrPlacement)
                }
              >
                {placements.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </select>
              <small className="pixel-hero-sub">
                {t.campaignLinks.form.placementHelp}
              </small>
            </label>

            <label className="pixel-field">
              <span>{t.campaignLinks.form.printedWidthLabel}</span>
              <input
                className="pixel-input"
                type="number"
                min={5}
                max={5000}
                value={printedWidthMm}
                onChange={(event) =>
                  setPrintedWidthMm(Number(event.target.value) || 1)
                }
              />
              <small className="pixel-hero-sub">
                {t.campaignLinks.form.printedWidthHelp}
              </small>
            </label>
          </div>

          <details>
            <summary className="pixel-hero-sub">
              {t.campaignLinks.form.coloursSummary}
            </summary>
            <div className="pixel-grid-3">
              <label className="pixel-field">
                <span>{t.campaignLinks.form.modulesLabel}</span>
                <input
                  className="pixel-input"
                  type="color"
                  value={style.darkColor}
                  onChange={(event) =>
                    setStyle({ ...style, darkColor: event.target.value })
                  }
                />
              </label>
              <label className="pixel-field">
                <span>{t.campaignLinks.form.backgroundLabel}</span>
                <input
                  className="pixel-input"
                  type="color"
                  value={style.lightColor}
                  onChange={(event) =>
                    setStyle({ ...style, lightColor: event.target.value })
                  }
                />
              </label>
              <label className="pixel-field">
                <span>{t.campaignLinks.form.quietZoneLabel}</span>
                <input
                  className="pixel-input"
                  type="number"
                  min={0}
                  max={16}
                  value={style.quietZone}
                  onChange={(event) =>
                    setStyle({
                      ...style,
                      quietZone: Number(event.target.value) || 0,
                    })
                  }
                />
                <small className="pixel-hero-sub">
                  {t.campaignLinks.form.quietZoneHelp}
                </small>
              </label>
            </div>
          </details>
        </div>
      </section>

      {result ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>{t.campaignLinks.preview.heading}</h2>
            {result.advice ? (
              <span
                className={`pixel-tag pixel-tag-${VERDICT_TONE[result.advice.verdict]}`}
              >
                {t.campaignLinks.verdictLabel[result.advice.verdict]}
              </span>
            ) : null}
          </div>
          <div className="pixel-panel-body">
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              {result.svg ? (
                <div
                  style={{ width: 180, flexShrink: 0 }}
                  // The SVG comes from the local daemon's own encoder, not from
                  // anything the operator typed.
                  dangerouslySetInnerHTML={{ __html: result.svg }}
                />
              ) : null}
              <div style={{ minWidth: 240, flex: 1 }}>
                {result.taggedUrl ? (
                  <p
                    className="pixel-hero-sub"
                    style={{ wordBreak: "break-all" }}
                  >
                    {result.taggedUrl}
                  </p>
                ) : null}
                {result.advice ? (
                  <table className="pixel-table">
                    <tbody>
                      <tr>
                        <th scope="row">
                          {t.campaignLinks.preview.moduleSize}
                        </th>
                        <td>{result.advice.moduleSizeMm.toFixed(2)}mm</td>
                      </tr>
                      <tr>
                        <th scope="row">
                          {t.campaignLinks.preview.readableFrom}
                        </th>
                        <td>
                          {fmt(t.campaignLinks.preview.readableUpTo, {
                            distance: Math.round(
                              result.advice.maxScanDistanceMm / 10,
                            ),
                          })}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{t.campaignLinks.preview.contrast}</th>
                        <td>{result.advice.contrastRatio.toFixed(1)}:1</td>
                      </tr>
                      <tr>
                        <th scope="row">{t.campaignLinks.preview.symbol}</th>
                        <td>
                          {fmt(t.campaignLinks.preview.symbolSpec, {
                            version: result.advice.version,
                            count: result.advice.moduleCount,
                            level: result.advice.errorCorrection,
                          })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : null}
              </div>
            </div>

            {blocking.length > 0 ? (
              <div className="pixel-subsection">
                <h4>{t.campaignLinks.preview.blockingHeading}</h4>
                <p className="pixel-hero-sub">
                  {t.campaignLinks.preview.blockingBody}
                </p>
                <FindingList findings={blocking} />
              </div>
            ) : null}

            {advisory.length > 0 ? (
              <div className="pixel-subsection">
                <h4>{t.campaignLinks.preview.advisoryHeading}</h4>
                <FindingList findings={advisory} />
              </div>
            ) : null}

            {createError ? (
              <p className="pixel-hero-sub" role="alert">
                {createError}
              </p>
            ) : null}

            <div className="pixel-row-actions">
              <button
                type="button"
                className="pixel-button"
                disabled={
                  !ready ||
                  !label ||
                  blocking.length > 0 ||
                  create.isPending ||
                  preview.isPending
                }
                onClick={() => {
                  setCreateError(null);
                  create.mutate(
                    {
                      label,
                      destinationUrl,
                      utm,
                      style,
                      placement,
                      printedWidthMm,
                    },
                    {
                      onSuccess: () => {
                        setLabel("");
                        setDestinationUrl("");
                        setUtm(EMPTY_UTM);
                        preview.reset();
                      },
                      onError: (error) =>
                        setCreateError(
                          error instanceof Error
                            ? error.message
                            : t.campaignLinks.preview.saveFailed,
                        ),
                    },
                  );
                }}
              >
                {create.isPending
                  ? t.campaignLinks.preview.saving
                  : t.campaignLinks.preview.saveLink}
              </button>
              {!label && ready ? (
                <span className="pixel-hero-sub">
                  {t.campaignLinks.preview.nameFirst}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.campaignLinks.links.heading}</h2>
          <span className="pixel-panel-mark">{items.length}</span>
        </div>
        <div className="pixel-panel-body">
          {items.length > 0 ? (
            <ul className="pixel-list">
              {items.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  siteId={siteId}
                  onDeleted={() => undefined}
                />
              ))}
            </ul>
          ) : (
            <p className="pixel-hero-sub">{t.campaignLinks.links.empty}</p>
          )}
        </div>
      </section>

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.campaignLinks.redirect.heading}</h2>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">{t.campaignLinks.redirect.body}</p>

          <div className="pixel-grid-3">
            <label className="pixel-field">
              <span>{t.campaignLinks.redirect.platformLabel}</span>
              <select
                className="pixel-input"
                value={redirectTargetName}
                onChange={(event) =>
                  setRedirectTargetName(event.target.value as RedirectTarget)
                }
              >
                {REDIRECT_TARGETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.expires
                      ? ""
                      : ` — ${t.campaignLinks.redirect.cannotExpire}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="pixel-field">
              <span>{t.campaignLinks.redirect.shortDomainLabel}</span>
              <input
                className="pixel-input"
                value={shortHost}
                onChange={(event) => setShortHost(event.target.value)}
                placeholder="go.example.com"
              />
            </label>
            <label className="pixel-field">
              <span>{t.campaignLinks.redirect.endsOnLabel}</span>
              <input
                className="pixel-input"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
              {expiresAt && selectedTarget && !selectedTarget.expires ? (
                <small className="pixel-hero-sub">
                  {fmt(t.campaignLinks.redirect.expiryNote, {
                    platform: selectedTarget.label,
                  })}
                </small>
              ) : null}
            </label>
          </div>

          <div className="pixel-row-actions">
            <button
              type="button"
              className="pixel-button"
              disabled={redirectConfig.isPending}
              onClick={() =>
                redirectConfig.mutate({
                  target: redirectTargetName,
                  shortHost: shortHost || null,
                  expiresAt: expiresAt
                    ? new Date(`${expiresAt}T00:00:00Z`).toISOString()
                    : null,
                })
              }
            >
              {redirectConfig.isPending
                ? t.campaignLinks.redirect.building
                : t.campaignLinks.redirect.buildConfig}
            </button>
          </div>

          {config ? (
            <div className="pixel-subsection">
              <h4>{config.filename}</h4>
              {config.notes.map((note) => (
                <p key={note} className="pixel-hero-sub">
                  {note}
                </p>
              ))}
              <FindingList findings={config.findings} />
              <pre className="pixel-code" style={{ overflowX: "auto" }}>
                {config.contents}
              </pre>
              <button
                type="button"
                className="pixel-button"
                onClick={() =>
                  void navigator.clipboard.writeText(config.contents)
                }
              >
                {t.campaignLinks.redirect.copy}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

export default CampaignLinksPage;
