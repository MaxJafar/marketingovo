import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useIntegrations } from "../api/queries";
import { PixelSprite } from "../components/pixel-sprite";
import { panelGlyphs, socialGlyphs } from "../components/pixel-glyphs";
import { PixelLineChart, SparkBars } from "../components/pixel-charts";
import { DEMO, formatCompact } from "../lib/intel";

/**
 * Social research.
 *
 * Marketingovo has no social connector yet, and this page says so rather than
 * dressing the sample set up as measurement. The charts are here because the
 * shape of the answer is worth showing before the data source exists — but
 * every one of them carries a demo flag, and the first thing the page states is
 * which sources are actually connected.
 */

const SOCIAL_CONNECTOR_HINT = [
  "twitter",
  "x",
  "instagram",
  "tiktok",
  "reddit",
  "social",
];

export function SocialResearchPage() {
  const { siteId } = useSite();
  const integrations = useIntegrations(siteId);
  const items = integrations.data?.data.items ?? [];
  const socialSources = items.filter((integration) =>
    SOCIAL_CONNECTOR_HINT.some(
      (hint) =>
        integration.id.toLowerCase().includes(hint) ||
        integration.name.toLowerCase().includes(hint),
    ),
  );
  const connected = socialSources.filter(
    (integration) => integration.status === "connected",
  );

  return (
    <>
      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>Source status</h2>
        </div>
        <div className="pixel-panel-body">
          {connected.length > 0 ? (
            <p className="pixel-hero-sub">
              {connected.length} social source
              {connected.length === 1 ? "" : "s"} connected. Mention volumes
              below still come from the sample set until the collector ships.
            </p>
          ) : (
            <p className="pixel-hero-sub">
              No social source is connected, so nothing on this page is measured
              from your accounts. Everything below is a labelled sample.{" "}
              <Link to="/integrations" className="pixel-linklike">
                connect a source
              </Link>
            </p>
          )}
        </div>
      </section>

      <div className="pixel-grid">
        <section className="pixel-panel pixel-col-8">
          <div className="pixel-panel-head">
            <h2>Mentions trend</h2>
            <span className="pixel-panel-mark">
              <span className="pixel-demo-flag">demo</span>
              <PixelSprite
                src="/pixel/panel/chat.png"
                fallback={panelGlyphs.chat}
                size={22}
              />
            </span>
          </div>
          <div className="pixel-panel-body">
            <PixelLineChart
              title="Sample mentions trend over thirty days"
              series={DEMO.mentionsSeries.map((entry) => ({
                ...entry,
                points: [...entry.points],
              }))}
              xLabels={[...DEMO.mentionsAxis]}
              height={220}
            />
            <div className="pixel-feed-meta" style={{ marginTop: 12 }}>
              {DEMO.mentionsSeries.map((entry) => (
                <span key={entry.id}>
                  <span style={{ color: entry.colour }}>■</span> {entry.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="pixel-panel pixel-col-4">
          <div className="pixel-panel-head">
            <h2>By platform</h2>
            <span className="pixel-panel-mark">
              <span className="pixel-demo-flag">demo</span>
            </span>
          </div>
          <div className="pixel-panel-body">
            <div className="pixel-platforms">
              {DEMO.platforms.map((platform) => (
                <div className="pixel-platform" key={platform.id}>
                  <PixelSprite
                    src={`/pixel/social/${platform.id}.png`}
                    fallback={socialGlyphs[platform.id]}
                    size={20}
                  />
                  <span className="pixel-platform-name">{platform.name}</span>
                  <SparkBars
                    values={[...DEMO.mentionsSpark]}
                    accent="cyan"
                    width={52}
                    height={18}
                  />
                  <span className="pixel-platform-count">
                    {formatCompact(platform.count)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pixel-panel pixel-col-12">
          <div className="pixel-panel-head">
            <h2>Ask the agent</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">
              Social listening is not yet a Marketingovo collector. An attached
              agent can still research this for you from its own tools — try
              asking it in the terminal below, for example{" "}
              <code>
                summarise what people said about us on Reddit this month
              </code>
              .
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
