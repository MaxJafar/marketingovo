from __future__ import annotations

import os
import signal
import tempfile
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.ipc as ipc
import pyarrow.parquet as pq

from .analytics import build_import_report, build_report
from .constants import (
    CSV_INPUT_SCHEMA_ID,
    CSV_REPORT_SCHEMA_ID,
    MODEL_VERSION,
    OBSERVATION_SCHEMA_ID,
    REPORT_SCHEMA_ID,
)
from .errors import WorkerCancelled, WorkerError
from .events import EventEmitter
from .io import (
    atomic_write,
    canonical_json_bytes,
    prepare_output_directory,
    read_verified_input,
    sha256_file,
    validate_input_file,
)
from .models import AnalysisRequest, AnalysisResult, ArtifactDescriptor, iso_z
from .normalize import normalize_table, parse_authority_timestamp, parse_observations

_CANCELLED = threading.Event()
CancellationProbe = Callable[[], None]


def request_cancellation(_signal_number: int, _frame: Any) -> None:
    _CANCELLED.set()


def install_signal_handlers() -> None:
    signal.signal(signal.SIGTERM, request_cancellation)
    signal.signal(signal.SIGINT, request_cancellation)


def reset_cancellation() -> None:
    _CANCELLED.clear()


def check_cancelled(probe: CancellationProbe | None = None) -> None:
    if probe is not None:
        probe()
    if _CANCELLED.is_set():
        raise WorkerCancelled()


def _simulate_slow(emitter: EventEmitter, probe: CancellationProbe | None = None) -> None:
    for step in range(50):
        check_cancelled(probe)
        if _CANCELLED.wait(0.1):
            raise WorkerCancelled()
        if step in {9, 24, 39}:
            emitter.emit(
                "simulation.slow",
                "Slow-worker checkpoint reached; cancellation remains responsive.",
                0.05 + (step / 200),
            )


def _atomic_arrow_write(path: Path, table: pa.Table) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        os.chmod(temporary, 0o600)
        with pa.OSFile(str(temporary), "wb") as sink, ipc.new_file(sink, table.schema) as writer:
            writer.write_table(table)
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def _atomic_parquet_write(path: Path, table: pa.Table) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        os.chmod(temporary, 0o600)
        pq.write_table(
            table,
            temporary,
            compression="zstd",
            version="2.6",
            data_page_version="2.0",
            write_statistics=True,
        )
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def _artifact(
    output_directory: Path,
    relative_path: str,
    media_type: str,
    schema_id: str,
    data_class: str,
    *,
    row_count: int,
    minimum_observed_at: str | None = None,
    maximum_observed_at: str | None = None,
) -> ArtifactDescriptor:
    path = output_directory / relative_path
    return ArtifactDescriptor(
        relative_path=relative_path,
        media_type=media_type,
        sha256=sha256_file(path),
        size_bytes=path.stat().st_size,
        row_count=row_count,
        schema_id=schema_id,
        minimum_observed_at=minimum_observed_at,
        maximum_observed_at=maximum_observed_at,
        data_class=data_class,
    )


def _aggregate_data_class(table: pa.Table) -> str:
    precedence = {
        "public": 0,
        "first_party": 1,
        "licensed_business_contact": 2,
        "restricted": 3,
    }
    values = table.column("data_class").to_pylist()
    return max(values, key=lambda value: precedence[value])


def run_analysis(
    request: AnalysisRequest,
    emitter: EventEmitter,
    *,
    reset_cancel: bool = True,
    cancellation_probe: CancellationProbe | None = None,
) -> AnalysisResult:
    if reset_cancel:
        reset_cancellation()
    try:
        workspace = request.workspace_path.resolve(strict=True)
    except OSError as exc:
        raise WorkerError("path_policy_violation", "Workspace path is unavailable.") from exc
    if not workspace.is_dir():
        raise WorkerError("path_policy_violation", "Workspace path must be a directory.")
    input_path = validate_input_file(request.input_path, workspace)
    output_directory = prepare_output_directory(request.output_directory, workspace)

    emitter.emit("worker.validating", "Validating bounded input and SHA-256.", 0.05)
    payload = read_verified_input(input_path, request.input_sha256)
    check_cancelled(cancellation_probe)

    if request.simulate == "source_failure":
        emitter.emit(
            "worker.source_failure",
            "Synthetic source failure requested; no evidence artifacts were produced.",
            0.1,
            level="error",
        )
        raise WorkerError("source_failure", "Synthetic upstream source failure.")
    if request.simulate == "slow":
        _simulate_slow(emitter, cancellation_probe)

    emitter.emit("worker.normalizing", "Parsing and normalizing observations.", 0.25)
    authority_time = (
        parse_authority_timestamp(request.validated_at)
        if request.input_schema_id == CSV_INPUT_SCHEMA_ID and request.validated_at is not None
        else None
    )
    observations = parse_observations(
        payload,
        request.target_ids,
        request.input_sha256.lower(),
        request.input_schema_id,
        authority_time,
    )
    table = normalize_table(observations)
    check_cancelled(cancellation_probe)

    minimum_observed_at = iso_z(min(table.column("observed_at").to_pylist()))
    maximum_observed_at = iso_z(max(table.column("observed_at").to_pylist()))
    data_class = _aggregate_data_class(table)

    emitter.emit("worker.analyzing", "Running denominator-safe DuckDB analytics.", 0.5)
    if request.workflow == "research":
        emitter.emit(
            "worker.research_planning",
            (
                "Planning a bounded research synthesis from committed evidence within "
                f"a {request.source_budget}-source budget."
            ),
            0.45,
        )
    if request.input_schema_id == CSV_INPUT_SCHEMA_ID:
        assert request.dataset_id is not None and request.validated_at is not None
        report = build_import_report(
            table,
            run_id=request.run_id,
            target_ids=request.target_ids,
            dataset_id=request.dataset_id,
            input_sha256=request.input_sha256.lower(),
            input_size_bytes=len(payload),
            validated_at=request.validated_at,
        )
        report_schema_id = CSV_REPORT_SCHEMA_ID
    else:
        report = build_report(
            table,
            request.run_id,
            request.target_ids,
            workflow=request.workflow,
            research_question=request.research_question,
            source_budget=request.source_budget,
        )
        report_schema_id = REPORT_SCHEMA_ID
    check_cancelled(cancellation_probe)

    arrow_path = output_directory / "normalized.arrow"
    parquet_path = output_directory / "observations.parquet"
    report_path = output_directory / "report.json"
    _atomic_arrow_write(arrow_path, table)
    check_cancelled(cancellation_probe)
    _atomic_parquet_write(parquet_path, table)
    check_cancelled(cancellation_probe)
    report_payload = canonical_json_bytes(report.model_dump(mode="json", exclude_none=True))
    atomic_write(report_path, report_payload)
    check_cancelled(cancellation_probe)

    artifacts = [
        _artifact(
            output_directory,
            "normalized.arrow",
            "application/vnd.apache.arrow.file",
            OBSERVATION_SCHEMA_ID,
            data_class,
            row_count=table.num_rows,
            minimum_observed_at=minimum_observed_at,
            maximum_observed_at=maximum_observed_at,
        ),
        _artifact(
            output_directory,
            "observations.parquet",
            "application/vnd.apache.parquet",
            OBSERVATION_SCHEMA_ID,
            data_class,
            row_count=table.num_rows,
            minimum_observed_at=minimum_observed_at,
            maximum_observed_at=maximum_observed_at,
        ),
        _artifact(
            output_directory,
            "report.json",
            "application/json",
            report_schema_id,
            data_class,
            row_count=len(report.targets),
            minimum_observed_at=minimum_observed_at,
            maximum_observed_at=maximum_observed_at,
        ),
    ]
    result = AnalysisResult(
        run_id=request.run_id,
        succeeded=True,
        artifacts=artifacts,
        report_relative_path="report.json",
        report_sha256=sha256_file(report_path),
        model_version=MODEL_VERSION,
    )

    # The descriptor intentionally captures the valid bytes first. Appending a
    # byte afterwards proves the Go authority validates the artifact itself.
    if request.simulate == "corrupt_artifact":
        with parquet_path.open("ab") as output:
            output.write(b"\nGOLEM_CORRUPTION_SIMULATION\n")
            output.flush()
            os.fsync(output.fileno())
        emitter.emit(
            "worker.corrupt_artifact",
            "Synthetic artifact corruption injected after descriptor hashing.",
            0.9,
            level="warning",
        )

    manifest_path = output_directory / "artifact-result.json"
    atomic_write(
        manifest_path,
        canonical_json_bytes(result.model_dump(mode="json", exclude_none=True)),
    )
    emitter.emit("worker.completed", "Analysis artifacts are ready for daemon validation.", 1.0)
    return result


def failure_result(run_id: str, error: WorkerError) -> AnalysisResult:
    return AnalysisResult(
        run_id=run_id,
        succeeded=False,
        error_code=error.code,
        error_message=error.message,
        artifacts=[],
        model_version=MODEL_VERSION,
    )


def persist_failure_if_safe(request: AnalysisRequest, result: AnalysisResult) -> None:
    try:
        output = prepare_output_directory(request.output_directory, request.workspace_path)
        atomic_write(
            output / "artifact-result.json",
            canonical_json_bytes(result.model_dump(mode="json", exclude_none=True)),
        )
    except (OSError, WorkerError):
        # A terminal stdout result is still available. Never bypass containment
        # merely to persist an error manifest.
        return
