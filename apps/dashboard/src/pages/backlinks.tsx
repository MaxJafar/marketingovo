import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import { useRuns } from "../api/queries";
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
          <h2>Internal link graph</h2>
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
            <p className="pixel-note">Looking for a completed audit…</p>
          ) : latest ? (
            <>
              <p className="pixel-hero-sub">
                The most recent audit mapped every internal link on the site.
                Open its explorer to trace inlinks and outlinks for any page.
              </p>
              <Link
                to="/audits/$runId"
                params={{ runId: latest.id }}
                className="pixel-panel-action"
              >
                Open link explorer →
              </Link>
            </>
          ) : (
            <p className="pixel-note">
              No completed audit yet. Run one and the internal link graph
              appears here.{" "}
              <Link to="/audits" className="pixel-linklike">
                open audits
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="pixel-panel pixel-col-5">
        <div className="pixel-panel-head">
          <h2>External backlinks</h2>
        </div>
        <div className="pixel-panel-body">
          <p className="pixel-hero-sub">
            Marketingovo crawls your site, not the rest of the web, so it cannot
            measure referring domains on its own. There is no backlink number to
            show here and none is estimated.
          </p>
          <p className="pixel-hero-sub" style={{ marginTop: 12 }}>
            An attached agent can research this with its own tools. Ask it in
            the terminal below — for example{" "}
            <code>which sites linked to our pricing page this quarter</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
