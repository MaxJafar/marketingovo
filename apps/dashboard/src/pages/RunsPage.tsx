import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntelClient } from "../api/client-context.js";

// Run history. Every run is an immutable record of what was collected, so this
// view never recomputes anything: it shows the stored state and the actions the
// daemon actually supports.
export function RunsPage(): React.JSX.Element {
  const client = useIntelClient();
  const queryClient = useQueryClient();

  const runs = useQuery({
    queryKey: ["runs"],
    queryFn: () => client.runs.list(),
    refetchInterval: 5000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["runs"] });
  };
  const cancel = useMutation({
    mutationFn: (runId: string) => client.runs.cancel(runId),
    onSuccess: invalidate,
  });
  const replay = useMutation({
    mutationFn: (runId: string) => client.runs.replay(runId),
    onSuccess: invalidate,
  });

  if (runs.isPending) {
    return <p role="status">Loading run history…</p>;
  }
  if (runs.isError) {
    return (
      <p role="alert">
        Run history is unavailable: {String((runs.error as Error).message)}
      </p>
    );
  }

  const items = runs.data ?? [];

  return (
    <section aria-labelledby="runs-heading">
      <h1 id="runs-heading">Reports &amp; runs</h1>
      <p>
        Every run is immutable. A completed run keeps the evidence it collected
        even when a later run of the same targets disagrees.
      </p>

      {items.length === 0 ? (
        <p>
          No runs yet. Start a comparison from the Research workspace; it will
          appear here while it is still executing.
        </p>
      ) : (
        <table>
          <caption className="visually-hidden">
            Run history, newest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Workflow</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((run) => {
              const terminal = ["succeeded", "partial", "failed", "cancelled"];
              const isTerminal = terminal.includes(run.status);
              return (
                <tr key={run.id}>
                  <th scope="row">
                    <code>{run.id}</code>
                  </th>
                  <td>{run.workflow}</td>
                  <td>
                    <span className={`run-status run-status-${run.status}`}>
                      {run.status}
                    </span>
                    {run.status === "partial" ? (
                      <small>
                        {" "}
                        — some sources were unavailable; confidence is reduced
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {run.created_at ? (
                      <time dateTime={run.created_at}>{run.created_at}</time>
                    ) : (
                      <span aria-label="unavailable">—</span>
                    )}
                  </td>
                  <td>
                    {isTerminal ? (
                      <button
                        type="button"
                        onClick={() => replay.mutate(run.id)}
                        disabled={replay.isPending}
                      >
                        Replay
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => cancel.mutate(run.id)}
                        disabled={cancel.isPending}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
