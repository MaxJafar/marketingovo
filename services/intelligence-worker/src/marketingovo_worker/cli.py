from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pydantic import ValidationError

from . import __version__
from .constants import SIMULATION_MODES
from .errors import WorkerError
from .events import EventEmitter
from .io import canonical_json_bytes
from .models import AnalysisRequest
from .pipeline import (
    failure_result,
    install_signal_handlers,
    persist_failure_if_safe,
    reset_cancellation,
    run_analysis,
)
from .protocol import run_protocol


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="marketingovo-worker")
    parser.add_argument("--version", action="version", version=__version__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("protocol", help="serve one length-delimited Protobuf analysis session")
    trends = commands.add_parser(
        "trends",
        help=(
            "research Google Trends interest for up to five keywords over "
            "pytrends (the one network-enabled adapter; operator-invoked only)"
        ),
    )
    trends.add_argument("--keyword", dest="keywords", action="append", required=True)
    trends.add_argument("--timeframe", default="today 12-m")
    trends.add_argument("--geo", default="")
    analyze = commands.add_parser("analyze", help="normalize and analyze one bounded spool")
    analyze.add_argument("--run-id", required=True)
    analyze.add_argument("--project-id", default="local")
    analyze.add_argument("--workspace-path", type=Path, default=Path.cwd())
    analyze.add_argument("--input", dest="input_path", required=True, type=Path)
    analyze.add_argument("--input-sha256", required=True)
    analyze.add_argument("--input-schema-id", default="marketingovo.fixture-observations.v1")
    analyze.add_argument("--output-dir", dest="output_directory", required=True, type=Path)
    analyze.add_argument("--target-id", dest="target_ids", action="append", default=[])
    analyze.add_argument(
        "--target-ids",
        dest="target_ids_csv",
        help="comma-separated compatibility form; --target-id is preferred",
    )
    analyze.add_argument("--simulate", choices=sorted(SIMULATION_MODES), default="none")
    analyze.add_argument("--workflow", choices=("compare", "research"), default="compare")
    analyze.add_argument("--question", dest="research_question", default="")
    analyze.add_argument("--source-budget", type=int, default=0)
    return parser


def _request(args: argparse.Namespace) -> AnalysisRequest:
    target_ids = list(args.target_ids)
    if args.target_ids_csv:
        target_ids.extend(part for part in args.target_ids_csv.split(",") if part)
    return AnalysisRequest(
        run_id=args.run_id,
        project_id=args.project_id,
        workspace_path=args.workspace_path,
        input_path=args.input_path,
        input_sha256=args.input_sha256,
        input_schema_id=args.input_schema_id,
        output_directory=args.output_directory,
        target_ids=target_ids,
        workflow=args.workflow,
        research_question=args.research_question,
        source_budget=args.source_budget,
        simulate=args.simulate,
    )


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "protocol":
        return run_protocol()
    if args.command == "trends":
        from datetime import UTC, datetime

        from .trends import run_trends_research

        try:
            research = run_trends_research(
                args.keywords,
                timeframe=args.timeframe,
                geo=args.geo,
                generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            )
        except ValueError as exc:
            sys.stderr.write(f"{exc}\n")
            return 2
        sys.stdout.buffer.write(canonical_json_bytes(research.model_dump(mode="json")))
        sys.stdout.buffer.flush()
        # Reachability is not correctness: an entirely-unavailable result still
        # exits 0, because the stated reasons are the honest answer.
        return 0
    run_id = getattr(args, "run_id", "unknown")
    try:
        request = _request(args)
    except ValidationError as exc:
        error = WorkerError("invalid_arguments", f"Invalid worker request: {exc}", exit_code=2)
        result = failure_result(run_id, error)
        sys.stdout.buffer.write(canonical_json_bytes(result.model_dump(mode="json")))
        return error.exit_code

    emitter = EventEmitter(request.run_id)
    install_signal_handlers()
    reset_cancellation()
    try:
        result = run_analysis(request, emitter, reset_cancel=False)
        exit_code = 0
    except WorkerError as error:
        emitter.emit("worker.failed", error.message, 1.0, level="error")
        result = failure_result(request.run_id, error)
        persist_failure_if_safe(request, result)
        exit_code = error.exit_code
    except Exception as exc:  # pragma: no cover - last-resort protocol guard
        error = WorkerError(
            "internal_error",
            f"Unexpected intelligence worker failure: {type(exc).__name__}.",
        )
        emitter.emit("worker.failed", error.message, 1.0, level="error")
        result = failure_result(request.run_id, error)
        persist_failure_if_safe(request, result)
        exit_code = error.exit_code
    sys.stdout.buffer.write(canonical_json_bytes(result.model_dump(mode="json", exclude_none=True)))
    sys.stdout.buffer.flush()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
