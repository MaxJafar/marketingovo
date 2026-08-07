import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useIntegrations } from "../api/queries";

/**
 * Social research.
 *
 * Marketingovo has no social listening collector, and this page says so
 * plainly instead of drawing sample charts. What IS measured lives elsewhere:
 * the content calendar records exactly what was published where, and the
 * cross-channel report counts those sends with their availability stated.
 * A chart of invented mentions would poison both.
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
              {connected.length === 1 ? "" : "s"} connected for publishing.
              Listening — mentions, sentiment, engagement — has no collector
              yet, so nothing of that kind is measured or shown.
            </p>
          ) : (
            <p className="pixel-hero-sub">
              No social source is connected, and social listening has no
              collector yet — so this page shows no mention or sentiment figures
              at all rather than inventing them.{" "}
              <Link to="/integrations" className="pixel-linklike">
                connect a source
              </Link>
            </p>
          )}
        </div>
      </section>

      <div className="pixel-grid">
        <section className="pixel-panel pixel-col-6">
          <div className="pixel-panel-head">
            <h2>What is measured today</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">
              Publishing is measured end to end: every post staged in the
              calendar keeps an immutable record of the exact request sent to
              each platform, and the cross-channel report counts published,
              refused, and indeterminate sends per platform.
            </p>
            <div className="pixel-row-actions" style={{ marginTop: 12 }}>
              <Link
                to="/calendar"
                className="pixel-button pixel-button-primary"
              >
                Open the calendar →
              </Link>
              <Link to="/report" className="pixel-button">
                See it in the report →
              </Link>
            </div>
          </div>
        </section>

        <section className="pixel-panel pixel-col-6">
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
