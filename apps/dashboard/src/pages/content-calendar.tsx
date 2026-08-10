import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import {
  useApprovePublishIntent,
  useAttachPublicUrl,
  useCalendar,
  useMediaLibrary,
  usePublishIntents,
  usePublishNow,
  useRelayMedia,
  useScheduleIntent,
  useUploadMedia,
} from "../api/queries";
import type {
  CalendarEntry,
  MediaAsset,
  SocialPlatform,
} from "../api/contracts";
import { fmt, useI18n } from "../i18n";

/**
 * The content calendar.
 *
 * Three things on this page are deliberate and cost something.
 *
 * Rescheduling an approved post clears its approval and says so, because the
 * time is part of what was consented to. It is one extra click and it is the
 * reason an unattended send is defensible at all.
 *
 * A post that failed shows the provider's own error rather than "failed", and
 * one whose outcome is unknown says exactly that instead of picking a side —
 * an operator told "failed" about a post that actually went out will send it
 * twice.
 *
 * Local files stay local. The button that sends one to public storage is
 * separate, labelled, and only appears for the platform that forces it.
 */

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  telegram: "Telegram",
  x: "X",
  "facebook-page": "Facebook",
  instagram: "Instagram",
};

const STATE_TONE: Record<string, string> = {
  published: "ok",
  approved: "ready",
  staged: "pending",
  publishing: "pending",
  failed: "bad",
  void: "bad",
  withdrawn: "muted",
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** The next `count` days from today, as ISO date keys. */
function upcomingDays(count: number): string[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) =>
    new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10),
  );
}

function EntryCard({
  entry,
  siteId,
}: {
  entry: CalendarEntry;
  siteId: string;
}) {
  const { t } = useI18n();
  const approve = useApprovePublishIntent(siteId);
  const publishNow = usePublishNow(siteId);
  const intents = usePublishIntents(siteId);
  const intent = intents.data?.data.items.find(
    (candidate) => candidate.id === entry.intentId,
  );

  return (
    <li className="pixel-list-row">
      <div>
        <strong>
          {PLATFORM_LABEL[entry.platform]} · {entry.accountName}
        </strong>
        <p className="pixel-hero-sub">{entry.preview.slice(0, 140)}</p>
        <p className="pixel-hero-sub">
          <span
            className={`pixel-tag pixel-tag-${STATE_TONE[entry.state] ?? "muted"}`}
          >
            {entry.state}
          </span>
          {entry.scheduledAt
            ? ` · ${new Date(entry.scheduledAt).toLocaleString()}${entry.timezone ? ` (${entry.timezone})` : ""}`
            : ` · ${t.contentCalendar.entry.noTimeSet}`}
          {entry.attachmentCount > 0
            ? ` · ${fmt(
                entry.attachmentCount === 1
                  ? t.contentCalendar.entry.attachmentSingular
                  : t.contentCalendar.entry.attachmentPlural,
                { count: entry.attachmentCount },
              )}`
            : ""}
        </p>
      </div>

      {entry.record ? (
        <p className="pixel-hero-sub">
          {entry.record.state === "published" ? (
            <>
              {fmt(t.contentCalendar.entry.sent, {
                time: new Date(entry.record.attemptedAt).toLocaleString(),
              })}
              {entry.record.permalink ? (
                <>
                  {" · "}
                  <a
                    href={entry.record.permalink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="pixel-linklike"
                  >
                    {t.contentCalendar.entry.openPost}
                  </a>
                </>
              ) : null}
            </>
          ) : entry.record.state === "indeterminate" ? (
            // The honest state, kept distinct from failure on purpose.
            <span role="alert">
              {fmt(t.contentCalendar.entry.indeterminate, {
                platform: PLATFORM_LABEL[entry.platform],
              })}
            </span>
          ) : (
            <span role="alert">
              {entry.record.error ?? t.contentCalendar.entry.refusedFallback}
            </span>
          )}
        </p>
      ) : null}

      <div className="pixel-row-actions">
        {entry.state === "staged" && intent ? (
          <button
            type="button"
            className="pixel-button pixel-button-primary"
            disabled={approve.isPending || !entry.scheduledAt}
            title={
              entry.scheduledAt
                ? undefined
                : t.contentCalendar.entry.needsTimeTitle
            }
            onClick={() =>
              approve.mutate({
                id: entry.intentId,
                payloadHash: intent.payloadHash,
              })
            }
          >
            {t.contentCalendar.entry.approve}
          </button>
        ) : null}
        {entry.state === "approved" ? (
          <button
            type="button"
            className="pixel-button"
            disabled={publishNow.isPending}
            onClick={() => publishNow.mutate(entry.intentId)}
          >
            {publishNow.isPending
              ? t.contentCalendar.entry.sending
              : t.contentCalendar.entry.sendNow}
          </button>
        ) : null}
      </div>
      {publishNow.data?.data.state === "indeterminate" ? (
        <p className="pixel-hero-sub" role="alert">
          {publishNow.data.data.reason}
        </p>
      ) : null}
    </li>
  );
}

function MediaCard({ asset, siteId }: { asset: MediaAsset; siteId: string }) {
  const { t } = useI18n();
  const relay = useRelayMedia(siteId);
  const attach = useAttachPublicUrl(siteId);
  const [url, setUrl] = useState("");

  return (
    <li className="pixel-list-row">
      <div>
        <strong>{asset.filename}</strong>
        <p className="pixel-hero-sub">
          {asset.mediaType} ·{" "}
          {fmt(t.contentCalendar.media.sizeKb, {
            size: Math.round(asset.sizeBytes / 1024),
          })}
          {asset.width && asset.height
            ? ` · ${asset.width}×${asset.height}`
            : ""}
        </p>
        <p className="pixel-hero-sub">
          {asset.publicUrl
            ? fmt(t.contentCalendar.media.publiclyReachable, {
                source: asset.publicUrlSource ?? "",
              })
            : // Stated rather than implied: this is the default and the good one.
              t.contentCalendar.media.storedLocally}
        </p>
      </div>
      {asset.publicUrl ? null : (
        <div className="pixel-row-actions">
          <button
            type="button"
            className="pixel-button"
            disabled={relay.isPending}
            onClick={() => relay.mutate(asset.id)}
            title={t.contentCalendar.media.relayTitle}
          >
            {relay.isPending
              ? t.contentCalendar.media.uploading
              : t.contentCalendar.media.relay}
          </button>
          <input
            type="url"
            className="pixel-input"
            placeholder={t.contentCalendar.media.urlPlaceholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            type="button"
            className="pixel-button"
            disabled={!url.startsWith("https://") || attach.isPending}
            onClick={() => attach.mutate({ mediaId: asset.id, publicUrl: url })}
          >
            {t.contentCalendar.media.useUrl}
          </button>
        </div>
      )}
      {relay.isError ? (
        <p className="pixel-hero-sub" role="alert">
          {relay.error instanceof Error
            ? relay.error.message
            : t.contentCalendar.media.uploadRefused}
        </p>
      ) : null}
    </li>
  );
}

export function ContentCalendarPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const calendar = useCalendar(siteId);
  const media = useMediaLibrary(siteId);
  const upload = useUploadMedia(siteId);
  const schedule = useScheduleIntent(siteId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [when, setWhen] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const workspace = calendar.data?.data;
  const days = useMemo(() => upcomingDays(14), []);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of workspace?.entries ?? []) {
      if (!entry.scheduledAt) continue;
      const key = dayKey(entry.scheduledAt);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [workspace]);

  return (
    <>
      {workspace && workspace.overdue.length > 0 ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>{t.contentCalendar.overdue.title}</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">{t.contentCalendar.overdue.body}</p>
            <ul className="pixel-list">
              {workspace.overdue.map((entry) => (
                <EntryCard key={entry.intentId} entry={entry} siteId={siteId} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.contentCalendar.week.title}</h2>
          <span className="pixel-panel-mark">{timezone}</span>
        </div>
        <div className="pixel-panel-body">
          {calendar.isLoading ? (
            <p className="pixel-hero-sub">{t.contentCalendar.week.loading}</p>
          ) : (workspace?.entries.length ?? 0) === 0 ? (
            <p className="pixel-hero-sub">
              {t.contentCalendar.week.emptyBefore}{" "}
              <Link to="/ads" className="pixel-linklike">
                {t.contentCalendar.week.composerLink}
              </Link>{" "}
              {t.contentCalendar.week.emptyAfter}
            </p>
          ) : (
            <div className="pixel-calendar">
              {days.map((day) => {
                const entries = byDay.get(day) ?? [];
                return (
                  <div key={day} className="pixel-calendar-day">
                    <h4>
                      {new Date(`${day}T00:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: "short", day: "numeric", month: "short" },
                      )}
                    </h4>
                    {entries.length === 0 ? (
                      <p className="pixel-hero-sub">—</p>
                    ) : (
                      <ul className="pixel-list">
                        {entries.map((entry) => (
                          <EntryCard
                            key={entry.intentId}
                            entry={entry}
                            siteId={siteId}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {workspace && workspace.unscheduled.length > 0 ? (
        <section className="pixel-panel">
          <div className="pixel-panel-head">
            <h2>{t.contentCalendar.unscheduled.title}</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">
              {t.contentCalendar.unscheduled.body}
            </p>
            <div className="pixel-row-actions">
              <input
                type="datetime-local"
                className="pixel-input"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                aria-label={t.contentCalendar.unscheduled.timeLabel}
              />
              <button
                type="button"
                className="pixel-button"
                disabled={!when || !selected || schedule.isPending}
                onClick={() =>
                  schedule.mutate({
                    intentId: selected!,
                    scheduledAt: new Date(when).toISOString(),
                    timezone,
                  })
                }
              >
                {t.contentCalendar.unscheduled.schedule}
              </button>
            </div>
            <ul className="pixel-list">
              {workspace.unscheduled.map((entry) => (
                <li key={entry.intentId} className="pixel-list-row">
                  <label>
                    <input
                      type="radio"
                      name="unscheduled"
                      checked={selected === entry.intentId}
                      onChange={() => setSelected(entry.intentId)}
                    />{" "}
                    <strong>
                      {PLATFORM_LABEL[entry.platform]} · {entry.accountName}
                    </strong>
                  </label>
                  <p className="pixel-hero-sub">
                    {entry.preview.slice(0, 140)}
                  </p>
                </li>
              ))}
            </ul>
            {schedule.isError ? (
              <p className="pixel-hero-sub" role="alert">
                {schedule.error instanceof Error
                  ? schedule.error.message
                  : t.contentCalendar.unscheduled.scheduleFailed}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.contentCalendar.media.title}</h2>
          <div className="pixel-row-actions">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime"
              className="pixel-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = "";
              }}
              aria-label={t.contentCalendar.media.uploadLabel}
            />
          </div>
        </div>
        <div className="pixel-panel-body">
          {upload.isError ? (
            <p className="pixel-hero-sub" role="alert">
              {upload.error instanceof Error
                ? upload.error.message
                : t.contentCalendar.media.uploadRefused}
            </p>
          ) : null}
          {(media.data?.data.items.length ?? 0) === 0 ? (
            <p className="pixel-hero-sub">{t.contentCalendar.media.empty}</p>
          ) : (
            <ul className="pixel-list">
              {media.data!.data.items.map((asset) => (
                <MediaCard key={asset.id} asset={asset} siteId={siteId} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
