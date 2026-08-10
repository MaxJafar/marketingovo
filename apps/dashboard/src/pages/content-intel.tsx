import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useCompetitors, useKeywords } from "../api/queries";
import { PixelSprite } from "../components/pixel-sprite";
import { feedGlyphs, panelGlyphs } from "../components/pixel-glyphs";
import { formatCompact } from "../lib/intel";
import { fmt, useI18n } from "../i18n";

/**
 * Content intel.
 *
 * Unlike social research, this page is entirely measured: content gaps come
 * from comparing the project's own pages against its tracked competitors, and
 * clusters come from the keyword workspace. So there is no demo path here —
 * when there is nothing to show, it says what to run to get some.
 */

export function ContentIntelPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const competitors = useCompetitors(siteId);
  const keywords = useKeywords(siteId);

  const gaps = competitors.data?.data.contentGapTerms ?? [];
  const clusters = keywords.data?.data.clusters ?? [];
  const loading = competitors.isLoading || keywords.isLoading;

  return (
    <div className="pixel-grid">
      <section className="pixel-panel pixel-col-7">
        <div className="pixel-panel-head">
          <h2>{t.contentIntel.gaps.title}</h2>
          <span className="pixel-panel-mark">
            <PixelSprite
              src="/pixel/panel/feed.png"
              fallback={panelGlyphs.feed}
              size={22}
            />
          </span>
        </div>
        <div className="pixel-panel-body">
          {loading ? (
            <p className="pixel-note">{t.contentIntel.gaps.loading}</p>
          ) : gaps.length === 0 ? (
            <p className="pixel-note">
              {t.contentIntel.gaps.empty}{" "}
              <Link to="/competitors" className="pixel-linklike">
                {t.contentIntel.gaps.emptyLink}
              </Link>
            </p>
          ) : (
            <div className="pixel-feed">
              {gaps.slice(0, 12).map((gap) => (
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
                        ◉{" "}
                        {fmt(
                          gap.referencesCovering === 1
                            ? t.contentIntel.gaps.coveredSingular
                            : t.contentIntel.gaps.coveredPlural,
                          { count: gap.referencesCovering },
                        )}
                      </span>
                      {gap.referenceDensity !== null &&
                      gap.referenceDensity !== undefined ? (
                        <span>
                          ▣{" "}
                          {fmt(t.contentIntel.gaps.density, {
                            value: gap.referenceDensity.toFixed(2),
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="pixel-tag" data-tone="hot">
                    {t.contentIntel.gaps.tag}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pixel-panel pixel-col-5">
        <div className="pixel-panel-head">
          <h2>{t.contentIntel.clusters.title}</h2>
        </div>
        <div className="pixel-panel-body">
          {loading ? (
            <p className="pixel-note">{t.contentIntel.clusters.loading}</p>
          ) : clusters.length === 0 ? (
            <p className="pixel-note">
              {t.contentIntel.clusters.empty}{" "}
              <Link to="/keywords" className="pixel-linklike">
                {t.contentIntel.clusters.emptyLink}
              </Link>
            </p>
          ) : (
            <table className="pixel-table">
              <thead>
                <tr>
                  <th scope="col">{t.contentIntel.clusters.cluster}</th>
                  <th scope="col" className="is-numeric">
                    {t.contentIntel.clusters.keywords}
                  </th>
                  <th scope="col" className="is-numeric">
                    {t.contentIntel.clusters.coverage}
                  </th>
                </tr>
              </thead>
              <tbody>
                {clusters.slice(0, 10).map((cluster) => (
                  <tr key={cluster.id}>
                    <td>{cluster.name}</td>
                    <td className="is-numeric">
                      {formatCompact(cluster.keywords)}
                    </td>
                    <td className="is-numeric">
                      {cluster.contentCoverage === null ||
                      cluster.contentCoverage === undefined
                        ? "—"
                        : `${Math.round(cluster.contentCoverage)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
