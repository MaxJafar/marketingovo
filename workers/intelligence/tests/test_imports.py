from __future__ import annotations

import hashlib
import io
import json
import struct
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pyarrow.ipc as ipc

from agentintel_worker.constants import (
    CSV_INPUT_SCHEMA_ID,
    CSV_PARSER_VERSION,
    METRIC_CATALOG_VERSION,
)
from agentintel_worker.events import EventEmitter
from agentintel_worker.imports import validate_csv_import
from agentintel_worker.models import AnalysisRequest
from agentintel_worker.normalize import parse_csv_import
from agentintel_worker.pipeline import run_analysis
from agentintel_worker.protocol import (
    PROTOCOL_VERSION,
    _analysis_request,
    load_worker_pb2,
    read_delimited,
    run_protocol,
)
from agentintel_worker.schema import OBSERVATION_SCHEMA

VALIDATED_AT = "2026-07-16T12:00:00Z"


def _golden(repository_root: Path) -> bytes:
    return (
        repository_root / "fixtures/competitive-pulse-import-v1/competitive-pulse.csv"
    ).read_bytes()


def _request(path: Path, payload: bytes, *, digest: str | None = None) -> SimpleNamespace:
    path.write_bytes(payload)
    return SimpleNamespace(
        request_id="preview-1",
        input_path=str(path),
        input_sha256=digest or hashlib.sha256(payload).hexdigest(),
        input_schema_id=CSV_INPUT_SCHEMA_ID,
        validated_at=VALIDATED_AT,
    )


def _diagnostic_codes(result: object) -> list[str]:
    return [item.code for item in result.diagnostics]


def test_golden_preview_is_valid_complete_and_sorted(tmp_path: Path, repository_root: Path) -> None:
    payload = _golden(repository_root)
    pb2 = load_worker_pb2()
    result = validate_csv_import(_request(tmp_path / "golden.csv", payload), pb2)

    assert result.valid
    assert result.input.sha256 == hashlib.sha256(payload).hexdigest()
    assert result.input.size_bytes == 5659
    assert result.input.row_count == 18
    assert result.platform == "youtube"
    assert result.file_policy.retention_days == 90
    assert [target.target_id for target in result.targets] == [
        "northstar-labs",
        "orbit-coffee",
        "vertex-studio",
    ]
    assert all(target.row_count == 6 for target in result.targets)
    assert all(
        set(target.metric_availability)
        == {
            "followers.delta",
            "public-engagement-by-followers.median",
            "posting-cadence",
            "content-format-mix",
        }
        for target in result.targets
    )
    assert not result.diagnostics


def test_validate_import_protocol_and_import_context(tmp_path: Path, repository_root: Path) -> None:
    payload = _golden(repository_root)
    input_path = tmp_path / "golden.csv"
    input_path.write_bytes(payload)
    digest = hashlib.sha256(payload).hexdigest()
    pb2 = load_worker_pb2()
    request = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        validate_import=pb2.ValidateImport(
            request_id="preview-protocol",
            input_path=str(input_path),
            input_sha256=digest,
            input_schema_id=CSV_INPUT_SCHEMA_ID,
            validated_at=VALIDATED_AT,
        ),
    )
    serialized = request.SerializeToString(deterministic=True)
    sink = io.BytesIO()
    source = io.BytesIO(struct.pack(">I", len(serialized)) + serialized)
    assert run_protocol(source, sink) == 0
    sink.seek(0)
    envelope = read_delimited(sink, pb2.WorkerEnvelope)
    assert envelope is not None
    assert envelope.WhichOneof("message") == "import_validation_result"
    assert envelope.import_validation_result.valid

    start = pb2.StartAnalysis(
        run_id="import-protocol",
        workspace_path=str(tmp_path),
        input_path=str(input_path),
        input_sha256=digest,
        input_schema_id=CSV_INPUT_SCHEMA_ID,
        output_directory=str(tmp_path / "out"),
        target_ids=["northstar-labs", "orbit-coffee"],
        workflow=pb2.ANALYSIS_WORKFLOW_COMPARE,
        import_context=pb2.ImportContext(
            dataset_id="dataset-1",
            validated_at=VALIDATED_AT,
            input_parser_version=CSV_PARSER_VERSION,
            metric_catalog_version=METRIC_CATALOG_VERSION,
        ),
    )
    analysis_request = _analysis_request(start)
    assert analysis_request.dataset_id == "dataset-1"
    assert analysis_request.validated_at == VALIDATED_AT


def test_preview_binds_hash_and_validation_time(tmp_path: Path, repository_root: Path) -> None:
    payload = _golden(repository_root)
    pb2 = load_worker_pb2()
    mismatch = validate_csv_import(_request(tmp_path / "hash.csv", payload, digest="0" * 64), pb2)
    assert not mismatch.valid
    assert _diagnostic_codes(mismatch) == ["input_hash_mismatch"]

    request = _request(tmp_path / "time.csv", payload)
    request.validated_at = "2026-07-16T12:00:00.1Z"
    invalid_time = validate_csv_import(request, pb2)
    assert not invalid_time.valid
    assert _diagnostic_codes(invalid_time) == ["validated_at_invalid"]


def test_header_formula_missing_and_source_policy_fail_closed(
    tmp_path: Path, repository_root: Path
) -> None:
    payload = _golden(repository_root)
    pb2 = load_worker_pb2()

    lines = payload.decode().splitlines()
    reversed_payload = (
        ",".join(reversed(lines[0].split(","))) + "\n" + "\n".join(lines[1:]) + "\n"
    ).encode()
    reversed_result = validate_csv_import(
        _request(tmp_path / "reversed.csv", reversed_payload), pb2
    )
    assert not reversed_result.valid
    assert _diagnostic_codes(reversed_result) == ["csv_column_order"]

    unsafe = payload.decode().replace("Northstar Labs", "=FORMULA", 1)
    unsafe = unsafe.replace("https://example.invalid/northstar-labs", "file:///etc/passwd", 1)
    unsafe = unsafe.replace(
        ",1,1,public,competitive_research,90,permitted",
        ",,1,public,competitive_research,90,permitted",
        1,
    )
    unsafe_result = validate_csv_import(_request(tmp_path / "unsafe.csv", unsafe.encode()), pb2)
    codes = _diagnostic_codes(unsafe_result)
    assert not unsafe_result.valid
    assert "field_formula_prefix" in codes
    assert "source_url_scheme" in codes
    assert "field_required" in codes
    assert "=FORMULA" not in str(unsafe_result)
    assert "file:///etc/passwd" not in str(unsafe_result)


def test_lexical_and_duplicate_cases_have_stable_coordinates(
    tmp_path: Path, repository_root: Path
) -> None:
    payload = _golden(repository_root)
    pb2 = load_worker_pb2()
    cases = [
        (b"\xff", "invalid_utf8"),
        (b"\xef\xbb\xbf" + payload, "utf8_bom_forbidden"),
        (payload.replace(b"Northstar Labs", b'"Northstar\nLabs"', 1), "csv_embedded_newline"),
    ]
    for index, (candidate, expected) in enumerate(cases):
        result = validate_csv_import(_request(tmp_path / f"lexical-{index}.csv", candidate), pb2)
        assert not result.valid
        assert _diagnostic_codes(result) == [expected]

    lines = payload.decode().splitlines()
    extended = ((lines[0] + ",vendor_extension\n") + "\n".join(lines[1:]) + "\n").encode()
    extension_result = validate_csv_import(_request(tmp_path / "extension.csv", extended), pb2)
    assert _diagnostic_codes(extension_result) == ["csv_unknown_column"]

    duplicate_id = payload.replace(b"obs-north-followers-02", b"obs-north-followers-01", 1)
    duplicate_result = validate_csv_import(
        _request(tmp_path / "duplicate-id.csv", duplicate_id), pb2
    )
    duplicate_diagnostic = next(
        item for item in duplicate_result.diagnostics if item.code == "duplicate_observation_id"
    )
    assert duplicate_diagnostic.record_number == 3
    assert duplicate_diagnostic.column == "observation_id"

    copied_row = lines[1].replace("obs-north-followers-01", "obs-north-followers-copy", 1)
    duplicate_observation = (payload.decode() + copied_row + "\n").encode()
    fingerprint_result = validate_csv_import(
        _request(tmp_path / "duplicate-observation.csv", duplicate_observation), pb2
    )
    assert "duplicate_observation" in _diagnostic_codes(fingerprint_result)


def test_absent_metric_rows_remain_missing_not_zero(repository_root: Path) -> None:
    payload = _golden(repository_root)
    lines = payload.decode().splitlines()
    without_north_engagement = (
        lines[0]
        + "\n"
        + "\n".join(
            line
            for line in lines[1:]
            if not line.startswith("agentintel.competitive-pulse-import.v1,obs-north-engagement")
        )
        + "\n"
    ).encode()
    from agentintel_worker.normalize import parse_authority_timestamp

    parsed = parse_csv_import(
        without_north_engagement,
        input_sha256=hashlib.sha256(without_north_engagement).hexdigest(),
        validated_at=parse_authority_timestamp(VALIDATED_AT),
    )
    assert parsed.valid
    assert (
        parsed.metric_availability["northstar-labs"]["public-engagement-by-followers.median"]
        == "missing"
    )
    assert not any(
        row.entity_id == "northstar-labs" and row.metric == "engagement_rate"
        for row in parsed.observations
    )


def test_source_reference_conformance_cases(repository_root: Path) -> None:
    fixture = json.loads(
        (
            repository_root / "fixtures/competitive-pulse-import-v1/source-url-policy.json"
        ).read_text()
    )
    from agentintel_worker.normalize import validate_source_url

    for case in fixture["cases"]:
        diagnostic = validate_source_url(case["source_url"], record=2)
        assert (diagnostic is None) is case["valid"], case["id"]
        if diagnostic is not None:
            assert diagnostic.code == case["diagnostic_code"], case["id"]


def test_record_boundaries_are_terminal_and_bounded(tmp_path: Path, repository_root: Path) -> None:
    header = _golden(repository_root).splitlines()[0]
    payload = b"\n".join([header, *([b"x"] * 10_001)]) + b"\n"
    parsed = parse_csv_import(
        payload,
        input_sha256=hashlib.sha256(payload).hexdigest(),
        validated_at=datetime(2026, 7, 16, 12, tzinfo=UTC),
    )
    assert not parsed.valid
    assert parsed.row_count == 10_001
    assert [(item.code, item.record_number) for item in parsed.diagnostics] == [
        ("csv_record_limit_exceeded", 10_002)
    ]

    malformed_tail = b"\n".join([header, *([b"x"] * 10_000), b"x\xff"]) + b"\n"
    terminal = parse_csv_import(
        malformed_tail,
        input_sha256=hashlib.sha256(malformed_tail).hexdigest(),
        validated_at=datetime(2026, 7, 16, 12, tzinfo=UTC),
    )
    assert terminal.row_count == 10_001
    assert [(item.code, item.record_number, item.column) for item in terminal.diagnostics] == [
        ("csv_record_limit_exceeded", 10_002, None)
    ]

    pb2 = load_worker_pb2()
    protocol_result = validate_csv_import(
        _request(tmp_path / "invalid-after-limit.csv", malformed_tail), pb2
    )
    assert not protocol_result.valid
    assert protocol_result.input.row_count == 10_001
    assert [
        (item.code, item.record_number, item.HasField("column"))
        for item in protocol_result.diagnostics
    ] == [("csv_record_limit_exceeded", 10_002, False)]

    oversize = header + b"\n" + (b"x" * 65_537) + b"\n"
    parsed_oversize = parse_csv_import(
        oversize,
        input_sha256=hashlib.sha256(oversize).hexdigest(),
        validated_at=datetime(2026, 7, 16, 12, tzinfo=UTC),
    )
    assert [(item.code, item.record_number) for item in parsed_oversize.diagnostics] == [
        ("csv_record_too_large", 2)
    ]


def test_out_of_order_is_normalized_and_follower_conflict_is_retained(
    repository_root: Path,
) -> None:
    payload = _golden(repository_root)
    digest = hashlib.sha256(payload).hexdigest()
    from agentintel_worker.normalize import parse_authority_timestamp

    ordered = parse_csv_import(
        payload,
        input_sha256=digest,
        validated_at=parse_authority_timestamp(VALIDATED_AT),
    )
    lines = payload.decode().splitlines()
    reordered_payload = (lines[0] + "\n" + "\n".join(reversed(lines[1:])) + "\n").encode()
    reordered = parse_csv_import(
        reordered_payload,
        input_sha256=hashlib.sha256(reordered_payload).hexdigest(),
        validated_at=parse_authority_timestamp(VALIDATED_AT),
    )
    assert [row.observation_id for row in ordered.observations] == [
        row.observation_id for row in reordered.observations
    ]

    conflicting = (
        payload.decode()
        .replace(
            "2026-06-22T12:00:00Z,2026-06-22T12:05:00Z,https://example.invalid/northstar-labs",
            "2026-06-01T12:00:00Z,2026-06-01T12:05:00Z,https://example.invalid/northstar-labs",
            1,
        )
        .encode()
    )
    conflict = parse_csv_import(
        conflicting,
        input_sha256=hashlib.sha256(conflicting).hexdigest(),
        validated_at=parse_authority_timestamp(VALIDATED_AT),
    )
    assert conflict.valid
    assert conflict.metric_availability["northstar-labs"]["followers.delta"] == "contradictory"
    assert "observation_value_conflict" in [item.code for item in conflict.diagnostics]
    assert len([row for row in conflict.observations if row.entity_id == "northstar-labs"]) == 6


def test_import_analysis_emits_authority_valid_artifacts_and_report_v2(
    tmp_path: Path, repository_root: Path
) -> None:
    payload = _golden(repository_root)
    input_path = tmp_path / "golden.csv"
    input_path.write_bytes(payload)
    digest = hashlib.sha256(payload).hexdigest()
    request = AnalysisRequest(
        run_id="import-run",
        workspace_path=tmp_path,
        input_path=input_path,
        input_sha256=digest,
        input_schema_id=CSV_INPUT_SCHEMA_ID,
        output_directory=tmp_path / "out",
        target_ids=["vertex-studio", "northstar-labs", "orbit-coffee"],
        workflow="compare",
        dataset_id="dataset_00000000000000000000000001",
        validated_at=VALIDATED_AT,
        input_parser_version=CSV_PARSER_VERSION,
        metric_catalog_version=METRIC_CATALOG_VERSION,
    )
    result = run_analysis(request, EventEmitter(request.run_id))
    assert result.succeeded
    assert [artifact.schema_id for artifact in result.artifacts] == [
        "agentintel.observations.v1",
        "agentintel.observations.v1",
        "agentintel.comparison-report.v2",
    ]
    with ipc.open_file(tmp_path / "out/normalized.arrow") as reader:
        table = reader.read_all()
    assert table.schema == OBSERVATION_SCHEMA
    assert table.num_rows == 18
    rows = table.to_pylist()
    assert [row["observation_id"] for row in rows] == [
        row["observation_id"]
        for row in sorted(
            rows, key=lambda row: (row["entity_id"], row["observed_at"], row["observation_id"])
        )
    ]
    assert all(row["artifact_hash"] == digest for row in rows)
    assert all(row["connector_version"] == "local.competitive-pulse-import@1.0.0" for row in rows)
    assert all(row["retention_until"].isoformat() == "2026-10-14T12:00:00+00:00" for row in rows)

    report = json.loads((tmp_path / "out/report.json").read_text())
    assert report["schema_version"] == "agentintel.comparison-report.v2"
    assert report["derivation"]["parser_version"] == CSV_PARSER_VERSION
    assert [target["target_id"] for target in report["targets"]] == [
        "northstar-labs",
        "orbit-coffee",
        "vertex-studio",
    ]
    assert all(
        [metric["id"] for metric in target["metrics"]]
        == [
            "followers.delta",
            "public-engagement-by-followers.median",
            "posting-cadence",
            "content-format-mix",
        ]
        for target in report["targets"]
    )
    referenced = {
        observation_id
        for target in report["targets"]
        for metric in target["metrics"]
        for observation_id in metric["evidence_observation_ids"]
    }
    referenced.update(
        observation_id
        for comparison in report["comparisons"]
        for observation_id in comparison["evidence_observation_ids"]
    )
    referenced.update(
        observation_id
        for contradiction in report["contradictions"]
        for observation_id in contradiction["observation_ids"]
    )
    assert set(report["evidence"]) == referenced
    assert all(len(evidence) == 32 for evidence in report["evidence"].values())
