import type { RunDetail } from "@golem-intel/sdk";

interface RunTimelineProps {
  run: RunDetail;
}

export function RunTimeline({ run }: RunTimelineProps): React.JSX.Element {
  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LIVE DAG</p>
          <h2 id="timeline-title">Run execution</h2>
        </div>
        <span className={`run-status status-${run.status}`}>{run.status}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(run.progress * 100)}
        aria-label="Run progress"
      >
        <span style={{ width: `${Math.round(run.progress * 100)}%` }} />
      </div>
      <ol className="timeline">
        {run.events.map((event) => (
          <li key={event.id} className={`event-${event.level}`}>
            <span className="timeline-node" aria-hidden="true" />
            <div>
              <span className="event-stage">{event.stage}</span>
              <p>{event.message}</p>
              <time dateTime={event.recorded_at}>
                {new Date(event.recorded_at).toLocaleTimeString()}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

