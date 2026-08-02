import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useCompetitors, useKeywords, useOverview } from "../api/queries";
import { PixelSprite } from "../components/pixel-sprite";
import {
  decoGlyphs,
  feedGlyphs,
  kpiGlyphs,
  mascotGlyphs,
  panelGlyphs,
  socialGlyphs,
} from "../components/pixel-glyphs";
import {
  MeterRow,
  PixelDonut,
  PixelLineChart,
  SparkBars,
} from "../components/pixel-charts";
import {
  DEMO,
  formatCompact,
  formatScore,
  metricNumber,
  toDelta,
  toSpark,
} from "../lib/intel";

/**
 * The console home. Every panel prefers a live measurement and says plainly
 * when it is showing the sample set instead — see the DEMO note in lib/intel.
 */

function Panel({
  title,
  mark,
  span,
  demo,
  children,
}: {
  title: string;
  mark?: ReactNode;
  span: string;
  demo?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`pixel-panel ${span}`}>
      <div className="pixel-panel-head">
        <h2>{title}</h2>
        <span className="pixel-panel-mark">
          {demo ? <span className="pixel-demo-flag">demo</span> : null}
          {mark}
        </span>
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
  demo,
}: {
  label: string;
  value: string;
  unit?: string;
  glyph: ReactNode;
  sprite: string;
  accent: "pink" | "cyan";
  spark: number[];
  change: number | null;
  demo: boolean;
}) {
  const delta = toDelta(change);
  return (
    <div className="pixel-stat">
      <span style={{ color: `var(--px-${accent})` }}>
        <PixelSprite src={sprite} fallback={glyph} size={40} />
      </span>
      <div className="pixel-stat-body">
        <span className="pixel-stat-label">
          {label} {demo ? <span className="pixel-demo-flag">demo</span> : null}
        </span>
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
              no trend yet
            </span>
          )}
          <SparkBars values={spark} accent={accent} />
        </span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { siteId, site } = useSite();
  const overview = useOverview(siteId);
  const keywords = useKeywords(siteId);
  const competitors = useCompetitors(siteId);

  const data = overview.data?.data;
  const health = metricNumber(data?.siteHealth);
  const clicks = metricNumber(data?.organicClicks);
  const trend = (data?.healthTrend ?? [])
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");

  // Visibility and traffic have real sources; mentions and sentiment do not.
  const visibility = health ?? DEMO.visibility;
  const visibilityDemo = health === null;
  const traffic = clicks ?? DEMO.traffic;
  const trafficDemo = clicks === null;

  const keywordRows = keywords.data?.data.opportunities ?? [];
  const competitorRows = competitors.data?.data.items ?? [];
  const gapTerms = competitors.data?.data.contentGapTerms ?? [];

  const usingDemoKeywords = keywordRows.length === 0;
  const usingDemoCompetitors = competitorRows.length === 0;
  const usingDemoFeed = gapTerms.length === 0;

  const healthBars =
    data === undefined
      ? DEMO.health.map((entry) => ({ ...entry, known: false }))
      : [
          {
            name: "Crawlability",
            value: metricNumber(data.indexableCoverage),
            known: true,
          },
          {
            name: "Site Performance",
            value: metricNumber(data.coreWebVitalsPassRate),
            known: true,
          },
          { name: "On-Page SEO", value: health, known: true },
          {
            name: "Backlinks",
            value: null,
            known: true,
          },
          {
            name: "Content Quality",
            value: metricNumber(data.organicKeyEvents) === null ? null : health,
            known: true,
          },
        ];

  return (
    <>
      <section className="pixel-panel pixel-hero">
        <div className="pixel-hero-copy">
          <h1>welcome to</h1>
          <strong className="pixel-hero-title">
            <span className="mark-a">marketing</span>
            <span className="mark-b">ovo</span>
          </strong>
          <p className="pixel-hero-sub">
            your all-in-one marketing intelligence terminal
          </p>
        </div>
        <div className="pixel-hero-art">
          <span className="pixel-bubble">data never sleeps</span>
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
          label="SEO visibility"
          value={formatScore(visibility)}
          unit="/100"
          glyph={kpiGlyphs.visibility}
          sprite="/pixel/kpi/visibility.png"
          accent="pink"
          spark={trend.length > 1 ? toSpark(trend) : [...DEMO.visibilitySpark]}
          change={
            visibilityDemo
              ? DEMO.visibilityChange
              : (data?.siteHealth?.change ?? null)
          }
          demo={visibilityDemo}
        />
        <Stat
          label="Organic traffic"
          value={formatCompact(traffic)}
          glyph={kpiGlyphs.traffic}
          sprite="/pixel/kpi/traffic.png"
          accent="cyan"
          spark={[...DEMO.trafficSpark]}
          change={
            trafficDemo
              ? DEMO.trafficChange
              : (data?.organicClicks?.change ?? null)
          }
          demo={trafficDemo}
        />
        <Stat
          label="Social mentions"
          value={formatCompact(DEMO.mentions)}
          glyph={kpiGlyphs.mentions}
          sprite="/pixel/kpi/mentions.png"
          accent="pink"
          spark={[...DEMO.mentionsSpark]}
          change={DEMO.mentionsChange}
          demo
        />
        <Stat
          label="Brand sentiment"
          value={`${DEMO.sentiment}`}
          unit="%"
          glyph={kpiGlyphs.sentiment}
          sprite="/pixel/kpi/sentiment.png"
          accent="cyan"
          spark={[...DEMO.sentimentSpark]}
          change={DEMO.sentimentChange}
          demo
        />
      </div>

      <div className="pixel-grid">
        <Panel
          title="SEO overview"
          span="pixel-col-5"
          demo={data === undefined}
          mark={
            <PixelSprite
              src="/pixel/panel/coffee.png"
              fallback={panelGlyphs.coffee}
              size={22}
            />
          }
        >
          <p className="pixel-hero-sub" style={{ marginBottom: 12 }}>
            Domain health
          </p>
          <div className="pixel-donut-row">
            <PixelDonut
              value={health ?? DEMO.domainHealth}
              label={`Domain health ${Math.round(health ?? DEMO.domainHealth)} out of 100`}
            />
            <div className="pixel-meters">
              {healthBars.map((bar) => (
                <MeterRow key={bar.name} name={bar.name} value={bar.value} />
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Social media research"
          span="pixel-col-7"
          demo
          mark={
            <PixelSprite
              src="/pixel/panel/chat.png"
              fallback={panelGlyphs.chat}
              size={22}
            />
          }
        >
          <div className="pixel-social-split">
            <div>
              <p className="pixel-hero-sub" style={{ marginBottom: 10 }}>
                Mentions trend (30d)
              </p>
              <PixelLineChart
                title="Mentions trend over the last 30 days"
                series={DEMO.mentionsSeries.map((entry) => ({
                  ...entry,
                  points: [...entry.points],
                }))}
                xLabels={[...DEMO.mentionsAxis]}
              />
            </div>
            <div className="pixel-platforms">
              {DEMO.platforms.map((platform) => (
                <div className="pixel-platform" key={platform.id}>
                  <PixelSprite
                    src={`/pixel/social/${platform.id}.png`}
                    fallback={socialGlyphs[platform.id]}
                    size={20}
                  />
                  <span className="pixel-platform-name">{platform.name}</span>
                  <span className="pixel-platform-count">
                    {formatCompact(platform.count)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Top keywords"
          span="pixel-col-4"
          demo={usingDemoKeywords}
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
          <table className="pixel-table">
            <thead>
              <tr>
                <th scope="col">Keyword</th>
                <th scope="col" className="is-numeric">
                  Pos.
                </th>
                <th scope="col" className="is-numeric">
                  Vol.
                </th>
              </tr>
            </thead>
            <tbody>
              {(usingDemoKeywords
                ? DEMO.keywords.map((entry) => ({
                    id: entry.keyword,
                    keyword: entry.keyword,
                    position: entry.position as number | null,
                    volume: entry.volume as number | null,
                  }))
                : keywordRows.slice(0, 5).map((entry) => ({
                    id: entry.id,
                    keyword: entry.keyword,
                    position: entry.position ?? null,
                    volume: entry.volume ?? entry.impressions ?? null,
                  }))
              ).map((row) => (
                <tr key={row.id}>
                  <td>{row.keyword}</td>
                  <td className="is-numeric">
                    {row.position === null ? "—" : row.position}
                  </td>
                  <td className="is-numeric">{formatCompact(row.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/keywords" className="pixel-panel-action">
            View all keywords →
          </Link>
        </Panel>

        <Panel
          title="Competitor insights"
          span="pixel-col-4"
          demo={usingDemoCompetitors}
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
          <table className="pixel-table">
            <thead>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col" className="is-numeric">
                  Visibility
                </th>
                <th scope="col" className="is-numeric">
                  Traffic
                </th>
              </tr>
            </thead>
            <tbody>
              <tr data-self="true">
                <td>you ({site?.name?.toLowerCase() ?? "this site"})</td>
                <td className="is-numeric">{formatScore(visibility)}</td>
                <td className="is-numeric">{formatCompact(traffic)}</td>
              </tr>
              {(usingDemoCompetitors
                ? DEMO.competitors.map((entry) => ({
                    id: entry.domain,
                    domain: entry.domain,
                    visibility: entry.visibility as number | null,
                    traffic: entry.traffic as number | null,
                  }))
                : competitorRows.slice(0, 4).map((entry) => ({
                    id: entry.id,
                    domain: entry.domain,
                    visibility: entry.technicalHealth ?? null,
                    traffic: null as number | null,
                  }))
              ).map((row) => (
                <tr key={row.id}>
                  <td>{row.domain}</td>
                  <td className="is-numeric">{formatScore(row.visibility)}</td>
                  <td className="is-numeric">{formatCompact(row.traffic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/competitors" className="pixel-panel-action">
            View competitors →
          </Link>
        </Panel>

        <Panel
          title="Content intel feed"
          span="pixel-col-4"
          demo={usingDemoFeed}
          mark={
            <PixelSprite
              src="/pixel/panel/feed.png"
              fallback={panelGlyphs.feed}
              size={22}
            />
          }
        >
          <div className="pixel-feed">
            {usingDemoFeed
              ? DEMO.feed.map((item) => (
                  <article className="pixel-feed-item" key={item.id}>
                    <PixelSprite
                      src={`/pixel/feed/${item.glyph}.png`}
                      fallback={feedGlyphs[item.glyph]}
                      size={28}
                    />
                    <div className="pixel-feed-body">
                      <h3 className="pixel-feed-title">{item.title}</h3>
                      <div className="pixel-feed-meta">
                        <span>◉ {formatCompact(item.views)}</span>
                        <span>▣ {item.comments}</span>
                        <span>⚯ {item.links}</span>
                      </div>
                    </div>
                    <span className="pixel-tag" data-tone={item.tone}>
                      {item.tag}
                    </span>
                  </article>
                ))
              : gapTerms.slice(0, 3).map((gap) => (
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
                          ◉ {gap.referencesCovering} competitors covering
                        </span>
                      </div>
                    </div>
                    <span className="pixel-tag" data-tone="hot">
                      Content gap
                    </span>
                  </article>
                ))}
          </div>
          <Link to="/content" className="pixel-panel-action" data-accent="pink">
            View content feed →
          </Link>
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
