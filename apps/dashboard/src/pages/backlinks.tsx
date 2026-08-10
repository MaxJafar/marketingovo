import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useRuns } from "../api/queries";
import { useI18n } from "../i18n";
import { PixelSprite } from "../components/pixel-sprite";
import { navGlyphs } from "../components/pixel-glyphs";

/**
 * Backlinks.
 *
 * Marketingovo crawls the project's own site, so it knows the internal link
 * graph exactly and knows nothing at all about external referring domains. That
 * distinction is the whole page: inventing an off-site backlink count from an
 * on-site crawl would be the most damaging kind of fabrication this product
 * could ship, so the section states the boundary and routes to the graph it can
 * actually prove.
 */

export function BacklinksPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const runs = useRuns(siteId);
  const items = runs.data?.data.items ?? [];
  const latest = items.find(
    (run) => run.status === "completed" || run.status === "partial",
  );

  return (
    <div className="pixel-grid">
      <section className="pixel-panel pixel-col-7">
        <div className="pixel-panel-head">
          <h2>{t.backlinks.internalTitle}</h2>
          <span
            className="pixel-panel-mark"
            style={{ color: "var(--px-cyan)" }}
          >
            <PixelSprite
              src="/pixel/nav/backlinks.png"
              fallback={navGlyphs.backlinks}
              size={22}
            />
          </span>
        </div>
        <div className="pixel-panel-body">
          {runs.isLoading ? (
            <p className="pixel-note">{t.backlinks.lookingForAudit}</p>
          ) : latest ? (
            <>
              <p className="pixel-hero-sub">{t.backlinks.latestAuditBody}</p>
              <Link
                to="/audits/$runId"
                params={{ runId: latest.id }}
                className="pixel-panel-action"
              >
                {t.backlinks.openExplorer}
              </Link>
            </>
          ) : (
            <p className="pixel-note">
              {t.backlinks.noAuditYet}{" "}
              <Link to="/audits" className="pixel-linklike">
                {t.backlinks.openAudits}
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="pixel-panel pixel-col-5">
        <div className="pixel-panel-head">
          <h2>{t.backlinks.externalTitle}</h2>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">{t.backlinks.externalBody}</p>
          <p className="pixel-hero-sub" style={{ marginTop: 12 }}>
            {t.backlinks.agentBodyBefore}{" "}
            <code>{t.backlinks.agentExample}</code>
            {t.backlinks.agentBodyAfter}
          </p>
        </div>
      </section>
    </div>
  );
}
