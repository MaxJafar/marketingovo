from __future__ import annotations

import io
import os
import select
import struct
import sys
import threading
from pathlib import Path
from types import ModuleType
from typing import BinaryIO

from pydantic import ValidationError

from .constants import (
    CSV_INPUT_SCHEMA_ID,
    CSV_PARSER_VERSION,
    FIXTURE_INPUT_SCHEMA_ID,
    METRIC_CATALOG_VERSION,
    SIMULATION_MODES,
)
from .errors import WorkerError
from .events import EventEmitter
from .models import AnalysisRequest, AnalysisResult
from .pipeline import (
    failure_result,
    install_signal_handlers,
    persist_failure_if_safe,
    request_cancellation,
    reset_cancellation,
    run_analysis,
)

PROTOCOL_VERSION = 1
MAX_CONTROL_MESSAGE_BYTES = 4 * 1024 * 1024


def load_worker_pb2() -> ModuleType:
    """Load generated bindings directly from the repository contract output."""
    try:
        from agentintel.v1 import worker_pb2  # type: ignore[import-not-found]

        return worker_pb2
    except ModuleNotFoundError:
        repository_root = Path(__file__).resolve().parents[4]
        generated_root = Path(
            os.environ.get("AGENTINTEL_GEN_PYTHON", repository_root / "gen/python")
        ).resolve()
        if not (generated_root / "agentintel/v1/worker_pb2.py").is_file():
            raise WorkerError(
                "protocol_bindings_unavailable",
                "Generated Python worker bindings are unavailable; run `buf generate`.",
            ) from None
        sys.path.insert(0, str(generated_root))
        from agentintel.v1 import worker_pb2  # type: ignore[import-not-found,no-redef]

        return worker_pb2


def _read_exact(stream: BinaryIO, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining:
        chunk = stream.read(remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def read_delimited(stream: BinaryIO, message_type: type) -> object | None:
    header = _read_exact(stream, 4)
    if not header:
        return None
    if len(header) != 4:
        raise WorkerError("protocol_truncated", "Truncated Protobuf frame header.")
    (size,) = struct.unpack(">I", header)
    if size == 0 or size > MAX_CONTROL_MESSAGE_BYTES:
        raise WorkerError(
            "protocol_frame_invalid",
            f"Control frame size {size} is outside the permitted range.",
        )
    payload = _read_exact(stream, size)
    if len(payload) != size:
        raise WorkerError("protocol_truncated", "Truncated Protobuf frame payload.")
    message = message_type()
    try:
        message.ParseFromString(payload)
    except Exception as exc:
        raise WorkerError("protocol_decode_failed", "Could not decode Protobuf frame.") from exc
    return message


def write_delimited(stream: BinaryIO, message: object, lock: threading.Lock | None = None) -> None:
    payload = message.SerializeToString(deterministic=True)
    if not payload or len(payload) > MAX_CONTROL_MESSAGE_BYTES:
        raise WorkerError("protocol_frame_invalid", "Outbound control frame has invalid size.")
    frame = struct.pack(">I", len(payload)) + payload

    def write_frame() -> None:
        remaining = memoryview(frame)
        while remaining:
            written = stream.write(remaining)
            if written is None or written <= 0:
                raise WorkerError("protocol_write_failed", "Could not write control frame.")
            remaining = remaining[written:]
        stream.flush()

    if lock is None:
        write_frame()
        return
    with lock:
        write_frame()


def _analysis_request(start: object) -> AnalysisRequest:
    if start.input_schema_id not in (FIXTURE_INPUT_SCHEMA_ID, CSV_INPUT_SCHEMA_ID):
        raise WorkerError(
            "schema_mismatch",
            f"Unsupported input schema {start.input_schema_id!r}; "
            f"expected {FIXTURE_INPUT_SCHEMA_ID} or {CSV_INPUT_SCHEMA_ID}.",
        )
    pb2 = load_worker_pb2()
    workflows = {
        pb2.ANALYSIS_WORKFLOW_COMPARE: "compare",
        pb2.ANALYSIS_WORKFLOW_RESEARCH: "research",
    }
    workflow = workflows.get(start.workflow)
    if workflow is None:
        raise WorkerError("invalid_arguments", "A supported analysis workflow is required.")
    simulate = start.options.get("simulate", "none")
    if simulate not in SIMULATION_MODES:
        raise WorkerError("invalid_arguments", f"Unsupported simulation mode {simulate!r}.")
    import_values: dict[str, str | None] = {
        "dataset_id": None,
        "validated_at": None,
        "input_parser_version": None,
        "metric_catalog_version": None,
    }
    has_import_context = start.HasField("import_context")
    if start.input_schema_id == CSV_INPUT_SCHEMA_ID:
        if not has_import_context:
            raise WorkerError("invalid_arguments", "CSV analysis requires import context.")
        context = start.import_context
        from .normalize import parse_authority_timestamp

        parse_authority_timestamp(context.validated_at)
        if context.input_parser_version != CSV_PARSER_VERSION:
            raise WorkerError(
                "replay_version_unavailable", "The requested CSV parser version is unavailable."
            )
        if context.metric_catalog_version != METRIC_CATALOG_VERSION:
            raise WorkerError(
                "replay_version_unavailable", "The requested metric catalog version is unavailable."
            )
        import_values = {
            "dataset_id": context.dataset_id,
            "validated_at": context.validated_at,
            "input_parser_version": context.input_parser_version,
            "metric_catalog_version": context.metric_catalog_version,
        }
    elif has_import_context:
        raise WorkerError("invalid_arguments", "Fixture analysis must not include import context.")
    try:
        return AnalysisRequest(
            run_id=start.run_id,
            project_id=start.project_id or "local",
            workspace_path=Path(start.workspace_path),
            input_path=Path(start.input_path),
            input_sha256=start.input_sha256,
            input_schema_id=start.input_schema_id,
            output_directory=Path(start.output_directory),
            target_ids=list(start.target_ids),
            workflow=workflow,
            research_question=start.research_question,
            source_budget=start.source_budget,
            simulate=simulate,
            **import_values,
        )
    except ValidationError as exc:
        raise WorkerError("invalid_arguments", f"Invalid StartAnalysis message: {exc}") from exc


def _result_envelope(pb2: ModuleType, result: AnalysisResult) -> object:
    protocol_result = pb2.AnalysisResult(
        run_id=result.run_id,
        succeeded=result.succeeded,
        error_code=result.error_code,
        error_message=result.error_message,
        report_relative_path=result.report_relative_path,
        report_sha256=result.report_sha256,
        model_version=result.model_version,
        worker_version=result.worker_version,
    )
    for artifact in result.artifacts:
        protocol_result.artifacts.add(
            relative_path=artifact.relative_path,
            media_type=artifact.media_type,
            sha256=artifact.sha256,
            size_bytes=artifact.size_bytes,
            row_count=artifact.row_count,
            schema_id=artifact.schema_id,
            minimum_observed_at=artifact.minimum_observed_at or "",
            maximum_observed_at=artifact.maximum_observed_at or "",
            data_class=artifact.data_class,
        )
    return pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        analysis_result=protocol_result,
    )


def _stream_ready(stream: BinaryIO) -> bool:
    if isinstance(stream, io.BytesIO):
        return stream.tell() < len(stream.getbuffer())
    try:
        descriptor = stream.fileno()
        readable, _writable, _exceptional = select.select([descriptor], [], [], 0)
    except (AttributeError, OSError, TypeError, ValueError):
        return False
    return bool(readable)


def _cancellation_probe(stream: BinaryIO, pb2: ModuleType, run_id: str) -> None:
    while _stream_ready(stream):
        try:
            envelope = read_delimited(stream, pb2.WorkerEnvelope)
        except WorkerError:
            request_cancellation(0, None)
            return
        if envelope is None:
            return
        if envelope.protocol_version != PROTOCOL_VERSION:
            request_cancellation(0, None)
            return
        kind = envelope.WhichOneof("message")
        if kind == "cancel_analysis" and envelope.cancel_analysis.run_id == run_id:
            request_cancellation(0, None)
            return


def run_protocol(
    input_stream: BinaryIO | None = None, output_stream: BinaryIO | None = None
) -> int:
    pb2 = load_worker_pb2()
    # Read production control frames from FileIO directly. BufferedReader may
    # read ahead past StartAnalysis and hide an already-arrived CancelAnalysis
    # frame from select(2), because the kernel pipe then appears empty.
    source = input_stream if input_stream is not None else sys.stdin.buffer.raw
    sink = output_stream if output_stream is not None else sys.stdout.buffer
    write_lock = threading.Lock()
    install_signal_handlers()

    try:
        envelope = read_delimited(source, pb2.WorkerEnvelope)
        if envelope is None:
            return 0
        if envelope.protocol_version != PROTOCOL_VERSION:
            raise WorkerError(
                "protocol_version_mismatch",
                f"Unsupported worker protocol version {envelope.protocol_version}.",
            )
        msg_type = envelope.WhichOneof("message")
        if msg_type not in ("start_analysis", "validate_import"):
            raise WorkerError(
                "protocol_message_invalid", "First message must be StartAnalysis or ValidateImport."
            )

        if msg_type == "validate_import":
            from .imports import validate_csv_import

            result = validate_csv_import(envelope.validate_import, pb2)
            write_delimited(
                sink,
                pb2.WorkerEnvelope(
                    protocol_version=PROTOCOL_VERSION, import_validation_result=result
                ),
                write_lock,
            )
            return 0

        request = _analysis_request(envelope.start_analysis)
    except WorkerError:
        # Without a trusted run ID there is no valid AnalysisResult correlation.
        return 2

    def event_sink(event: dict[str, object]) -> None:
        worker_event = pb2.WorkerEvent(**event)
        response = pb2.WorkerEnvelope(
            protocol_version=PROTOCOL_VERSION,
            worker_event=worker_event,
        )
        write_delimited(sink, response, write_lock)

    reset_cancellation()
    emitter = EventEmitter(request.run_id, sink=event_sink)
    try:
        result = run_analysis(
            request,
            emitter,
            reset_cancel=False,
            cancellation_probe=lambda: _cancellation_probe(source, pb2, request.run_id),
        )
        exit_code = 0
    except WorkerError as error:
        emitter.emit("worker.failed", error.message, 1.0, level="error")
        result = failure_result(request.run_id, error)
        persist_failure_if_safe(request, result)
        exit_code = error.exit_code
    except Exception as exc:  # pragma: no cover - final protocol containment
        error = WorkerError(
            "internal_error", f"Unexpected intelligence worker failure: {type(exc).__name__}."
        )
        emitter.emit("worker.failed", error.message, 1.0, level="error")
        result = failure_result(request.run_id, error)
        persist_failure_if_safe(request, result)
        exit_code = 1
    write_delimited(sink, _result_envelope(pb2, result), write_lock)
    return exit_code
