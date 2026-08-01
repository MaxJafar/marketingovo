from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

from .constants import CSV_INPUT_SCHEMA_ID, MAX_CSV_BYTES
from .errors import WorkerError
from .normalize import ImportDiagnostic, parse_authority_timestamp, parse_csv_import


def _protocol_diagnostic(pb2: Any, diagnostic: ImportDiagnostic) -> Any:
    values: dict[str, Any] = {
        "severity": (
            pb2.IMPORT_DIAGNOSTIC_SEVERITY_ERROR
            if diagnostic.severity == "error"
            else pb2.IMPORT_DIAGNOSTIC_SEVERITY_WARNING
        ),
        "code": diagnostic.code,
        "message": diagnostic.message,
    }
    if diagnostic.record_number is not None:
        values["record_number"] = diagnostic.record_number
    if diagnostic.column is not None:
        values["column"] = diagnostic.column
    return pb2.ImportDiagnostic(**values)


def _failure(request_id: str, pb2: Any, code: str, message: str) -> Any:
    return pb2.ImportValidationResult(
        request_id=request_id,
        valid=False,
        diagnostics=[
            pb2.ImportDiagnostic(
                severity=pb2.IMPORT_DIAGNOSTIC_SEVERITY_ERROR,
                code=code,
                message=message,
            )
        ],
    )


def validate_csv_import(request: Any, pb2: Any) -> Any:
    if request.input_schema_id != CSV_INPUT_SCHEMA_ID:
        return _failure(
            request.request_id,
            pb2,
            "schema_version_unsupported",
            "The requested input schema is not supported.",
        )
    if not re.fullmatch(r"[a-f0-9]{64}", request.input_sha256):
        return _failure(
            request.request_id,
            pb2,
            "input_hash_invalid",
            "The expected input SHA-256 is invalid.",
        )
    try:
        validated_at = parse_authority_timestamp(request.validated_at)
    except WorkerError as error:
        return _failure(request.request_id, pb2, error.code, error.message)

    try:
        with Path(request.input_path).open("rb") as source:
            payload = source.read(MAX_CSV_BYTES + 1)
    except OSError:
        return _failure(
            request.request_id,
            pb2,
            "input_read_failed",
            "The private import snapshot could not be read.",
        )
    if len(payload) > MAX_CSV_BYTES:
        return _failure(
            request.request_id,
            pb2,
            "input_too_large",
            "The input exceeds the permitted byte limit.",
        )
    if hashlib.sha256(payload).hexdigest() != request.input_sha256:
        return _failure(
            request.request_id,
            pb2,
            "input_hash_mismatch",
            "The private import snapshot does not match its expected SHA-256.",
        )

    parsed = parse_csv_import(
        payload,
        input_sha256=request.input_sha256,
        validated_at=validated_at,
        materialize_observations=False,
    )
    input_values: dict[str, Any] = {
        "schema_id": request.input_schema_id,
        "sha256": request.input_sha256,
        "size_bytes": len(payload),
    }
    if parsed.row_count is not None:
        input_values["row_count"] = parsed.row_count

    result_values: dict[str, Any] = {
        "request_id": request.request_id,
        "valid": parsed.valid,
        "input": pb2.ImportInputSummary(**input_values),
        "diagnostics": [_protocol_diagnostic(pb2, item) for item in parsed.diagnostics],
        "diagnostics_truncated": parsed.diagnostics_truncated,
    }
    if parsed.valid:
        availability_values = {
            "missing": pb2.IMPORT_METRIC_AVAILABILITY_MISSING,
            "insufficient": pb2.IMPORT_METRIC_AVAILABILITY_INSUFFICIENT,
            "contradictory": pb2.IMPORT_METRIC_AVAILABILITY_CONTRADICTORY,
            "available": pb2.IMPORT_METRIC_AVAILABILITY_AVAILABLE,
        }
        assert parsed.platform is not None and parsed.retention_days is not None
        result_values["file_policy"] = pb2.ImportFilePolicySummary(
            target_scope="brand",
            data_class="public",
            permitted_purpose="competitive_research",
            retention_days=parsed.retention_days,
            rights_state="permitted",
        )
        result_values["platform"] = parsed.platform
        result_values["targets"] = [
            pb2.ImportTargetSummary(
                target_id=target_id,
                target_name=parsed.target_names[target_id],
                row_count=parsed.target_row_counts[target_id],
                metric_availability={
                    metric_id: availability_values[state]
                    for metric_id, state in parsed.metric_availability[target_id].items()
                },
            )
            for target_id in sorted(parsed.target_names)
        ]
    return pb2.ImportValidationResult(**result_values)
