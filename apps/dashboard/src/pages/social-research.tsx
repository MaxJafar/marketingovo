import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useIntegrations } from "../api/queries";
import { fmt, useI18n } from "../i18n";

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
  const { t } = useI18n();
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
          <h2>{t.socialResearch.status.title}</h2>
        </div>
        <div className="pixel-panel-body">
          {connected.length > 0 ? (
            <p className="pixel-hero-sub">
              {fmt(
                connected.length === 1
                  ? t.socialResearch.status.connectedSingular
                  : t.socialResearch.status.connectedPlural,
                { count: connected.length },
              )}
            </p>
          ) : (
            <p className="pixel-hero-sub">
              {t.socialResearch.status.none}{" "}
              <Link to="/integrations" className="pixel-linklike">
                {t.socialResearch.status.connectLink}
              </Link>
            </p>
          )}
        </div>
      </section>

      <div className="pixel-grid">
        <section className="pixel-panel pixel-col-6">
          <div className="pixel-panel-head">
            <h2>{t.socialResearch.measured.title}</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">{t.socialResearch.measured.body}</p>
            <div className="pixel-row-actions" style={{ marginTop: 12 }}>
              <Link
                to="/calendar"
                className="pixel-button pixel-button-primary"
              >
                {t.socialResearch.measured.openCalendar}
              </Link>
              <Link to="/report" className="pixel-button">
                {t.socialResearch.measured.openReport}
              </Link>
            </div>
          </div>
        </section>

        <section className="pixel-panel pixel-col-6">
          <div className="pixel-panel-head">
            <h2>{t.socialResearch.agent.title}</h2>
          </div>
          <div className="pixel-panel-body">
            <p className="pixel-hero-sub">
              {t.socialResearch.agent.bodyBefore}{" "}
              <code>{t.socialResearch.agent.examplePrompt}</code>
              {t.socialResearch.agent.bodyAfter}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
