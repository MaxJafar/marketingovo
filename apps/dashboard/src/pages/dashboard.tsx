import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useCompetitors, useKeywords, useOverview } from "../api/queries";
import { fmt, useI18n } from "../i18n";
import { PixelSprite } from "../components/pixel-sprite";
import {
  decoGlyphs,
  feedGlyphs,
  kpiGlyphs,
  mascotGlyphs,
  panelGlyphs,
} from "../components/pixel-glyphs";
import { MeterRow, PixelDonut, SparkBars } from "../components/pixel-charts";
import {
  formatCompact,
  formatScore,
  metricNumber,
  toDelta,
  toSpark,
} from "../lib/intel";

/**
 * The console home. Every mark on this page is a measurement; where a source
 * has not reported, the panel says so and points at the workspace that can
 * change that. Nothing here falls back to a sample set — a number a marketer
 * cannot trust poisons the ones they can.
 */

function Panel({
  title,
  mark,
  span,
  children,
}: {
  title: string;
  mark?: ReactNode;
  span: string;
  children: ReactNode;
}) {
  return (
    <section className={`pixel-panel ${span}`}>
      <div className="pixel-panel-head">
        <h2>{title}</h2>
        <span className="pixel-panel-mark">{mark}</span>
      </div>
      <div className="pixel-panel-body">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  glyph,
  sprite,
  accent,
  spark,
  change,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  glyph: ReactNode;
  sprite: string;
  accent: "pink" | "cyan";
  spark: number[];
  change: number | null;
  note?: string;
}) {
  const { t } = useI18n();
  const delta = toDelta(change);
  return (
    <div className="pixel-stat">
      <span style={{ color: `var(--px-${accent})` }}>
        <PixelSprite src={sprite} fallback={glyph} size={40} />
      </span>
      <div className="pixel-stat-body">
        <span className="pixel-stat-label">{label}</span>
        <strong className="pixel-stat-value">
          {value}
          {unit ? <span className="pixel-stat-unit">{unit}</span> : null}
        </strong>
        <span className="pixel-stat-foot">
          {delta ? (
            <span className="pixel-delta" data-direction={delta.direction}>
              {delta.label}
            </span>
          ) : (
            <span className="pixel-delta" data-direction="flat">
              {note ?? t.dashboard.stats.noTrendYet}
            </span>
          )}
          <SparkBars values={spark} accent={accent} />
        </span>
      </div>
    </div>
  );
}

function PanelEmpty({
  message,
  to,
  action,
}: {
  message: string;
  to: string;
  action: string;
}) {
  return (
    <p className="pixel-hero-sub">
      {message}{" "}
      <Link to={to} className="pixel-linklike">
        {action}
      </Link>
    </p>
  );
}

export function DashboardPage() {
  const { t } = useI18n();
  const { siteId, site } = useSite();
  const overview = useOverview(siteId);
  const keywords = useKeywords(siteId);
  const competitors = useCompetitors(siteId);

  const data = overview.data?.data;
  const health = metricNumber(data?.siteHealth);
  const clicks = metricNumber(data?.organicClicks);
  const keyEvents = metricNumber(data?.organicKeyEvents);
  const vitalsPassRate = metricNumber(data?.coreWebVitalsPassRate);
  const trend = (data?.healthTrend ?? [])
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");

  const keywordRows = keywords.data?.data.opportunities ?? [];
  const competitorRows = competitors.data?.data.items ?? [];
  const gapTerms = competitors.data?.data.contentGapTerms ?? [];

  const healthBars = [
    {
      name: t.dashboard.seoOverview.crawlability,
      value: metricNumber(data?.indexableCoverage),
    },
    {
      name: t.dashboard.seoOverview.sitePerformance,
      value: vitalsPassRate,
    },
    { name: t.dashboard.seoOverview.onPageSeo, value: health },
    {
      name: t.dashboard.seoOverview.keyEvents,
      value: keyEvents,
    },
  ];

  return (
    <>
      <section className="pixel-panel pixel-hero">
        <div className="pixel-hero-copy">
          <h1>{t.dashboard.hero.welcome}</h1>
          <strong className="pixel-hero-title">
            <span className="mark-a">marketing</span>
            <span className="mark-b">ovo</span>
          </strong>
          <p className="pixel-hero-sub">{t.dashboard.hero.tagline}</p>
        </div>
        <div className="pixel-hero-art">
          <span className="pixel-bubble">{t.dashboard.hero.bubble}</span>
          <PixelSprite
            src="/pixel/mascot/cat-hero.png"
            fallback={mascotGlyphs.cat}
            size={140}
            height={122}
          />
          <span
            className="pixel-sparkle"
            style={{ top: 14, left: -22, color: "var(--px-ink)" }}
          >
            <PixelSprite
              src="/pixel/deco/sparkle-ink.png"
              fallback={decoGlyphs.sparkle}
              size={14}
            />
          </span>
          <span
            className="pixel-sparkle"
            style={{ top: 62, left: -46, color: "var(--px-pink-lift)" }}
          >
            <PixelSprite
              src="/pixel/deco/sparkle-pink.png"
              fallback={decoGlyphs.sparkle}
              size={11}
            />
          </span>
          <span
            className="pixel-sparkle"
            style={{ top: 2, right: 18, color: "var(--px-gold)" }}
          >
            <PixelSprite
              src="/pixel/deco/star-gold.png"
              fallback={decoGlyphs.star}
              size={15}
            />
          </span>
          <span
            className="pixel-sparkle"
            style={{ bottom: 10, left: -10, color: "var(--px-cyan-lift)" }}
          >
            <PixelSprite
              src="/pixel/deco/sparkle-cyan.png"
              fallback={decoGlyphs.sparkle}
              size={12}
            />
          </span>
        </div>
      </section>

      <div className="pixel-stats">
        <Stat
          label={t.dashboard.stats.seoVisibility}
          value={formatScore(health)}
          unit={health === null ? undefined : "/100"}
          glyph={kpiGlyphs.visibility}
          sprite="/pixel/kpi/visibility.png"
          accent="pink"
          spark={trend.length > 1 ? toSpark(trend) : []}
          change={data?.siteHealth?.change ?? null}
          note={
            health === null ? t.dashboard.stats.runAuditToMeasure : undefined
          }
        />
        <Stat
          label={t.dashboard.stats.organicTraffic}
          value={formatCompact(clicks)}
          glyph={kpiGlyphs.traffic}
          sprite="/pixel/kpi/traffic.png"
          accent="cyan"
          spark={[]}
          change={data?.organicClicks?.change ?? null}
          note={
            clicks === null ? t.dashboard.stats.connectSearchConsole : undefined
          }
        />
        <Stat
          label={t.dashboard.stats.keyEvents}
          value={formatCompact(keyEvents)}
          glyph={kpiGlyphs.mentions}
          sprite="/pixel/kpi/mentions.png"
          accent="pink"
          spark={[]}
          change={data?.organicKeyEvents?.change ?? null}
          note={
            keyEvents === null ? t.dashboard.stats.connectAnalytics : undefined
          }
        />
        <Stat
          label={t.dashboard.stats.cwvPassRate}
          value={formatScore(vitalsPassRate)}
          unit={vitalsPassRate === null ? undefined : "%"}
          glyph={kpiGlyphs.sentiment}
          sprite="/pixel/kpi/sentiment.png"
          accent="cyan"
          spark={[]}
          change={data?.coreWebVitalsPassRate?.change ?? null}
          note={
            vitalsPassRate === null
              ? t.dashboard.stats.runAuditWithVitals
              : undefined
          }
        />
      </div>

      <div className="pixel-grid">
        <Panel
          title={t.dashboard.seoOverview.title}
          span="pixel-col-5"
          mark={
            <PixelSprite
              src="/pixel/panel/coffee.png"
              fallback={panelGlyphs.coffee}
              size={22}
            />
          }
        >
          <p className="pixel-hero-sub" style={{ marginBottom: 12 }}>
            {t.dashboard.seoOverview.domainHealth}
          </p>
          {health === null ? (
            <PanelEmpty
              message={t.dashboard.seoOverview.empty}
              to="/audits"
              action={t.dashboard.seoOverview.runAudit}
            />
          ) : (
            <div className="pixel-donut-row">
              <PixelDonut
                value={health}
                label={fmt(t.dashboard.seoOverview.donutLabel, {
                  value: Math.round(health),
                })}
              />
              <div className="pixel-meters">
                {healthBars.map((bar) => (
                  <MeterRow key={bar.name} name={bar.name} value={bar.value} />
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title={t.dashboard.crossChannel.title}
          span="pixel-col-7"
          mark={
            <PixelSprite
              src="/pixel/panel/chat.png"
              fallback={panelGlyphs.chat}
              size={22}
            />
          }
        >
          <p className="pixel-hero-sub">{t.dashboard.crossChannel.body}</p>
          <div className="pixel-row-actions" style={{ marginTop: 12 }}>
            <Link to="/report" className="pixel-button pixel-button-primary">
              {t.dashboard.crossChannel.openReport}
            </Link>
            <Link to="/monitoring" className="pixel-button">
              {t.dashboard.crossChannel.scheduleIt}
            </Link>
          </div>
        </Panel>

        <Panel
          title={t.dashboard.topKeywords.title}
          span="pixel-col-4"
          mark={
            <span style={{ color: "var(--px-gold)" }}>
              <PixelSprite
                src="/pixel/panel/star.png"
                fallback={panelGlyphs.star}
                size={22}
              />
            </span>
          }
        >
          {keywordRows.length === 0 ? (
            <PanelEmpty
              message={t.dashboard.topKeywords.empty}
              to="/keywords"
              action={t.dashboard.topKeywords.openLab}
            />
          ) : (
            <>
              <table className="pixel-table">
                <thead>
                  <tr>
                    <th scope="col">{t.dashboard.topKeywords.keyword}</th>
                    <th scope="col" className="is-numeric">
                      {t.dashboard.topKeywords.position}
                    </th>
                    <th scope="col" className="is-numeric">
                      {t.dashboard.topKeywords.volume}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keywordRows.slice(0, 5).map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.keyword}</td>
                      <td className="is-numeric">
                        {entry.position === null || entry.position === undefined
                          ? "—"
                          : entry.position}
                      </td>
                      <td className="is-numeric">
                        {formatCompact(
                          entry.volume ?? entry.impressions ?? null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link to="/keywords" className="pixel-panel-action">
                {t.dashboard.topKeywords.viewAll}
              </Link>
            </>
          )}
        </Panel>

        <Panel
          title={t.dashboard.competitorInsights.title}
          span="pixel-col-4"
          mark={
            <span style={{ color: "var(--px-pink)" }}>
              <PixelSprite
                src="/pixel/panel/target.png"
                fallback={panelGlyphs.target}
                size={22}
              />
            </span>
          }
        >
          {competitorRows.length === 0 ? (
            <PanelEmpty
              message={t.dashboard.competitorInsights.empty}
              to="/competitors"
              action={t.dashboard.competitorInsights.research}
            />
          ) : (
            <>
              <table className="pixel-table">
                <thead>
                  <tr>
                    <th scope="col">{t.dashboard.competitorInsights.domain}</th>
                    <th scope="col" className="is-numeric">
                      {t.dashboard.competitorInsights.visibility}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr data-self="true">
                    <td>
                      {fmt(t.dashboard.competitorInsights.you, {
                        name:
                          site?.name?.toLowerCase() ??
                          t.dashboard.competitorInsights.thisSite,
                      })}
                    </td>
                    <td className="is-numeric">{formatScore(health)}</td>
                  </tr>
                  {competitorRows.slice(0, 4).map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.domain}</td>
                      <td className="is-numeric">
                        {formatScore(entry.technicalHealth ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link to="/competitors" className="pixel-panel-action">
                {t.dashboard.competitorInsights.viewAll}
              </Link>
            </>
          )}
        </Panel>

        <Panel
          title={t.dashboard.contentFeed.title}
          span="pixel-col-4"
          mark={
            <PixelSprite
              src="/pixel/panel/feed.png"
              fallback={panelGlyphs.feed}
              size={22}
            />
          }
        >
          {gapTerms.length === 0 ? (
            <PanelEmpty
              message={t.dashboard.contentFeed.empty}
              to="/content"
              action={t.dashboard.contentFeed.open}
            />
          ) : (
            <>
              <div className="pixel-feed">
                {gapTerms.slice(0, 3).map((gap) => (
                  <article className="pixel-feed-item" key={gap.term}>
                    <PixelSprite
                      src="/pixel/feed/trend.png"
                      fallback={feedGlyphs.trend}
                      size={28}
                    />
                    <div className="pixel-feed-body">
                      <h3 className="pixel-feed-title">{gap.term}</h3>
                      <div className="pixel-feed-meta">
                        <span>
                          {fmt(t.dashboard.contentFeed.competitorsCovering, {
                            count: gap.referencesCovering,
                          })}
                        </span>
                      </div>
                    </div>
                    <span className="pixel-tag" data-tone="hot">
                      {t.dashboard.contentFeed.gapTag}
                    </span>
                  </article>
                ))}
              </div>
              <Link
                to="/content"
                className="pixel-panel-action"
                data-accent="pink"
              >
                {t.dashboard.contentFeed.viewFeed}
              </Link>
            </>
          )}
        </Panel>
      </div>

      <PixelSprite
        src="/pixel/mascot/blob-buddy.png"
        fallback={mascotGlyphs.blob}
        size={54}
        height={62}
        className="pixel-corner-buddy"
      />
    </>
  );
}
