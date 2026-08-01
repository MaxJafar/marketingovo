import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIntelClient } from "../api/client-context.js";

// Evidence search. This is the workspace the product exists for: every claim a
// run makes should be traceable back to a committed observation, and this is
// where that trace starts.
export function EvidencePage(): React.JSX.Element {
  const client = useIntelClient();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const results = useQuery({
    queryKey: ["search", query],
    queryFn: () => client.search(query),
    enabled: query.trim().length > 0,
  });

  return (
    <section aria-labelledby="evidence-heading">
      <h1 id="evidence-heading">Datasets &amp; evidence</h1>
      <p>
        Search committed evidence. Results come from stored observations, not
        from a model: an empty result means nothing was collected, not that
        nothing exists.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft);
        }}
      >
        <label htmlFor="evidence-query">Search committed evidence</label>
        <input
          id="evidence-query"
          name="q"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Entity, metric, or source"
        />
        <button type="submit" disabled={draft.trim().length === 0}>
          Search
        </button>
      </form>

      {query.trim().length === 0 ? (
        <p>Enter a term to search stored evidence.</p>
      ) : results.isPending ? (
        <p role="status">Searching committed evidence…</p>
      ) : results.isError ? (
        <p role="alert">
          Evidence search is unavailable:{" "}
          {String((results.error as Error).message)}
        </p>
      ) : (results.data ?? []).length === 0 ? (
        <p>
          No committed evidence matches “{query}”. Nothing was collected for
          that term — this is not a statement that it does not exist.
        </p>
      ) : (
        <ul className="evidence-results">
          {(results.data ?? []).map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <article>
                <h2>{result.label}</h2>
                <p>{result.excerpt}</p>
                <dl>
                  <dt>Kind</dt>
                  <dd>{result.kind}</dd>
                  <dt>Identifier</dt>
                  <dd>
                    <code>{result.id}</code>
                  </dd>
                  <dt>Confidence</dt>
                  <dd>
                    {typeof result.confidence === "number"
                      ? result.confidence.toFixed(2)
                      : "unavailable"}
                  </dd>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
