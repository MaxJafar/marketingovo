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

const PLACEMENTS: Array<{ value: QrPlacement; label: string; hint: string }> = [
  { value: "screen", label: "Screen", hint: "Slides, a web page, a video" },
  {
    value: "print-handheld",
    label: "Held in the hand",
    hint: "Flyer, business card, receipt",
  },
  {
    value: "print-poster",
    label: "Poster",
    hint: "Read from a distance, rarely touched",
  },
  {
    value: "packaging",
    label: "Packaging",
    hint: "Curved, scuffed in transit",
  },
  { value: "outdoor", label: "Outdoors", hint: "Rain, sun, partly obstructed" },
];

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

const VERDICT_LABEL: Record<string, string> = {
  comfortable: "scans reliably",
  tight: "marginal",
  unscannable: "will not scan",
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
  const markPrinted = useMarkCampaignLinkPrinted(siteId);
  const remove = useDeleteCampaignLink(siteId);
  const [copied, setCopied] = useState(false);

  return (
    <li className="pixel-list-row">
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <img
          src={`/api/v1/campaign-links/${encodeURIComponent(link.id)}/qr?format=svg`}
          alt={`QR code for ${link.label}`}
          width={72}
          height={72}
          style={{ imageRendering: "pixelated", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong>{link.label}</strong>
          {link.printedAt ? (
            <span className="pixel-tag pixel-tag-ok"> printed</span>
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
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              className="pixel-button"
              href={`/api/v1/campaign-links/${encodeURIComponent(link.id)}/qr?format=svg`}
              download={`${link.label}.svg`}
            >
              SVG
            </a>
            <a
              className="pixel-button"
              href={`/api/v1/campaign-links/${encodeURIComponent(link.id)}/qr?format=png&scale=16`}
              download={`${link.label}.png`}
            >
              PNG
            </a>
            {link.printedAt ? null : (
              <button
                type="button"
                className="pixel-button"
                onClick={() => markPrinted.mutate(link.id)}
                disabled={markPrinted.isPending}
              >
                Mark printed
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
              Delete
            </button>
          </div>
          {link.findings.length > 0 ? (
            <details>
              <summary className="pixel-hero-sub">
                {link.findings.length} note
                {link.findings.length === 1 ? "" : "s"} from when this was made
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
          <h2>New campaign link</h2>
          <span className="pixel-panel-mark">
            checked before the code exists
          </span>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">
            A QR code is a URL that has been made expensive to change. The
            tagging is checked here, while it still costs nothing to fix.
          </p>

          <label className="pixel-field">
            <span>Name</span>
            <input
              className="pixel-input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Summer flyer, café window"
            />
            <small className="pixel-hero-sub">
              For finding it later. Never appears in the URL.
            </small>
          </label>

          <label className="pixel-field">
            <span>Destination</span>
            <input
              className="pixel-input"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
              placeholder="https://example.com/summer"
            />
            <small className="pixel-hero-sub">
              The untagged page. The tagging is added below.
            </small>
          </label>

          <div className="pixel-grid-3">
            <label className="pixel-field">
              <span>Source</span>
              <input
                className="pixel-input"
                value={utm.source}
                onChange={(event) =>
                  setUtm({ ...utm, source: event.target.value })
                }
                placeholder="flyer"
              />
              <small className="pixel-hero-sub">Where it came from</small>
            </label>
            <label className="pixel-field">
              <span>Medium</span>
              <input
                className="pixel-input"
                value={utm.medium}
                onChange={(event) =>
                  setUtm({ ...utm, medium: event.target.value })
                }
                placeholder="referral"
              />
              <small className="pixel-hero-sub">How it arrived</small>
            </label>
            <label className="pixel-field">
              <span>Campaign</span>
              <input
                className="pixel-input"
                value={utm.campaign}
                onChange={(event) =>
                  setUtm({ ...utm, campaign: event.target.value })
                }
                placeholder="summer-sale-2026"
              />
              <small className="pixel-hero-sub">Which campaign</small>
            </label>
          </div>

          {needsNormalizing && normalized ? (
            <div className="pixel-subsection">
              <p className="pixel-hero-sub">
                Under the convention this becomes{" "}
                <strong>
                  {normalized.source} / {normalized.medium} /{" "}
                  {normalized.campaign}
                </strong>
                .
              </p>
              <button
                type="button"
                className="pixel-button"
                onClick={() => setUtm(normalized)}
              >
                Use that
              </button>
            </div>
          ) : null}

          <div className="pixel-grid-2">
            <label className="pixel-field">
              <span>Where will this code be?</span>
              <select
                className="pixel-input"
                value={placement}
                onChange={(event) =>
                  setPlacement(event.target.value as QrPlacement)
                }
              >
                {PLACEMENTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </select>
              <small className="pixel-hero-sub">
                Decides the error-correction level and the minimum size.
              </small>
            </label>

            <label className="pixel-field">
              <span>Printed width (mm)</span>
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
                How wide it will actually be on the finished thing.
              </small>
            </label>
          </div>

          <details>
            <summary className="pixel-hero-sub">Colours and margin</summary>
            <div className="pixel-grid-3">
              <label className="pixel-field">
                <span>Modules</span>
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
                <span>Background</span>
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
                <span>Quiet zone</span>
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
                  Four is the standard minimum.
                </small>
              </label>
            </div>
          </details>
        </div>
      </section>

      {result ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>Preview</h2>
            {result.advice ? (
              <span
                className={`pixel-tag pixel-tag-${VERDICT_TONE[result.advice.verdict]}`}
              >
                {VERDICT_LABEL[result.advice.verdict]}
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
                        <th scope="row">Module size</th>
                        <td>{result.advice.moduleSizeMm.toFixed(2)}mm</td>
                      </tr>
                      <tr>
                        <th scope="row">Readable from</th>
                        <td>
                          up to{" "}
                          {Math.round(result.advice.maxScanDistanceMm / 10)}cm
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">Contrast</th>
                        <td>{result.advice.contrastRatio.toFixed(1)}:1</td>
                      </tr>
                      <tr>
                        <th scope="row">Symbol</th>
                        <td>
                          version {result.advice.version},{" "}
                          {result.advice.moduleCount}×
                          {result.advice.moduleCount} modules, level{" "}
                          {result.advice.errorCorrection}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : null}
              </div>
            </div>

            {blocking.length > 0 ? (
              <div className="pixel-subsection">
                <h4>These prevent saving</h4>
                <p className="pixel-hero-sub">
                  Everything else in this product records a problem and carries
                  on. These do not, because a printed code has no second
                  attempt.
                </p>
                <FindingList findings={blocking} />
              </div>
            ) : null}

            {advisory.length > 0 ? (
              <div className="pixel-subsection">
                <h4>Worth knowing</h4>
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
                            : "The link could not be saved.",
                        ),
                    },
                  );
                }}
              >
                {create.isPending ? "Saving…" : "Save this link"}
              </button>
              {!label && ready ? (
                <span className="pixel-hero-sub">Give it a name first.</span>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>Links</h2>
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
            <p className="pixel-hero-sub">
              No links yet. Codes made here encode their URL directly, so
              nothing resolves them and they cannot be revoked or metered.
            </p>
          )}
        </div>
      </section>

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>Codes you can re-point later</h2>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">
            A QR code cannot expire or change — the modules encode the
            destination. Products selling &ldquo;dynamic&rdquo; codes are
            selling a redirect on their own domain, which is also why they can
            stop resolving it. Put the redirect on a domain you already own and
            the same capability costs nothing and answers to nobody.
          </p>

          <div className="pixel-grid-3">
            <label className="pixel-field">
              <span>Platform</span>
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
                    {option.expires ? "" : " — cannot expire by itself"}
                  </option>
                ))}
              </select>
            </label>
            <label className="pixel-field">
              <span>Your short domain</span>
              <input
                className="pixel-input"
                value={shortHost}
                onChange={(event) => setShortHost(event.target.value)}
                placeholder="go.example.com"
              />
            </label>
            <label className="pixel-field">
              <span>Ends on</span>
              <input
                className="pixel-input"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
              {expiresAt && selectedTarget && !selectedTarget.expires ? (
                <small className="pixel-hero-sub">
                  {selectedTarget.label} cannot check a date. The expiry is
                  written in as a comment and something has to edit the file.
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
              {redirectConfig.isPending ? "Building…" : "Build the config"}
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
                Copy
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

export default CampaignLinksPage;
