from __future__ import annotations

import json
import sys
from collections.abc import Callable
from datetime import UTC, datetime

EventSink = Callable[[dict[str, object]], None]


class EventEmitter:
    def __init__(self, run_id: str, sink: EventSink | None = None) -> None:
        self.run_id = run_id
        self.sequence = 0
        self.sink = sink

    def emit(self, stage: str, message: str, progress: float, *, level: str = "info") -> None:
        self.sequence += 1
        event = {
            "run_id": self.run_id,
            "sequence": self.sequence,
            "stage": stage,
            "level": level,
            "message": message,
            "progress": min(1.0, max(0.0, progress)),
            "recorded_at": datetime.now(UTC)
            .isoformat(timespec="microseconds")
            .replace("+00:00", "Z"),
        }
        if self.sink is not None:
            self.sink(event)
        else:
            sys.stderr.write(json.dumps(event, sort_keys=True, separators=(",", ":")) + "\n")
            sys.stderr.flush()
