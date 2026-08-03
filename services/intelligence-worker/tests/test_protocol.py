from __future__ import annotations

import io
import struct
import subprocess
import sys
import time
from pathlib import Path

import pytest

from marketingovo_worker.errors import WorkerError
from marketingovo_worker.protocol import (
    PROTOCOL_VERSION,
    _analysis_request,
    load_worker_pb2,
    read_delimited,
    run_protocol,
    write_delimited,
)


def _framed(message: object) -> bytes:
    payload = message.SerializeToString(deterministic=True)
    return struct.pack(">I", len(payload)) + payload


def test_delimited_codec_round_trip() -> None:
    pb2 = load_worker_pb2()
    envelope = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        cancel_analysis=pb2.CancelAnalysis(run_id="run-1", reason="test"),
    )
    stream = io.BytesIO()
    write_delimited(stream, envelope)
    stream.seek(0)
    decoded = read_delimited(stream, pb2.WorkerEnvelope)
    assert decoded == envelope
    assert read_delimited(stream, pb2.WorkerEnvelope) is None


def test_start_contract_rejects_legacy_schema_and_incoherent_workflow(tmp_path: Path) -> None:
    pb2 = load_worker_pb2()
    baseline = {
        "run_id": "contract-test",
        "workspace_path": str(tmp_path),
        "input_path": str(tmp_path / "input.ndjson"),
        "input_sha256": "a" * 64,
        "output_directory": str(tmp_path / "out"),
        "target_ids": ["northstar-labs"],
        "options": {"simulate": "none"},
    }
    with pytest.raises(WorkerError) as schema_error:
        _analysis_request(
            pb2.StartAnalysis(
                **baseline,
                input_schema_id="marketingovo.observations.v1",
                workflow=pb2.ANALYSIS_WORKFLOW_COMPARE,
            )
        )
    assert schema_error.value.code == "schema_mismatch"

    with pytest.raises(WorkerError) as workflow_error:
        _analysis_request(
            pb2.StartAnalysis(
                **baseline,
                input_schema_id="marketingovo.fixture-observations.v1",
                workflow=pb2.ANALYSIS_WORKFLOW_RESEARCH,
                research_question="What changed?",
                source_budget=0,
            )
        )
    assert workflow_error.value.code == "invalid_arguments"


def test_protocol_emits_events_and_result_parity(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str, target_ids: list[str]
) -> None:
    pb2 = load_worker_pb2()
    copied_input = tmp_path / "observations.ndjson"
    copied_input.write_bytes(fixture_path.read_bytes())
    start = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        start_analysis=pb2.StartAnalysis(
            run_id="protocol-run",
            project_id="test",
            workspace_path=str(tmp_path),
            input_path=str(copied_input),
            input_sha256=fixture_sha256,
            input_schema_id="marketingovo.fixture-observations.v1",
            output_directory=str(tmp_path / "out"),
            target_ids=target_ids,
            options={"simulate": "none"},
            workflow=pb2.ANALYSIS_WORKFLOW_COMPARE,
        ),
    )
    source = io.BytesIO(_framed(start))
    sink = io.BytesIO()
    assert run_protocol(source, sink) == 0
    sink.seek(0)
    messages = []
    while message := read_delimited(sink, pb2.WorkerEnvelope):
        messages.append(message)
    assert [message.protocol_version for message in messages] == [PROTOCOL_VERSION] * len(messages)
    assert any(message.WhichOneof("message") == "worker_event" for message in messages)
    result_envelopes = [
        message for message in messages if message.WhichOneof("message") == "analysis_result"
    ]
    assert len(result_envelopes) == 1
    result = result_envelopes[0].analysis_result
    assert result.succeeded
    assert result.run_id == "protocol-run"
    assert result.report_relative_path == "report.json"
    assert result.worker_version == "0.1.0"
    assert result.model_version == "competitive-pulse-baseline@0.1.0"
    assert len(result.artifacts) == 3
    assert (tmp_path / "out/artifact-result.json").is_file()


def test_protocol_cancel_message_interrupts_slow_analysis(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str
) -> None:
    pb2 = load_worker_pb2()
    copied_input = tmp_path / "observations.ndjson"
    copied_input.write_bytes(fixture_path.read_bytes())
    start = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        start_analysis=pb2.StartAnalysis(
            run_id="protocol-cancel",
            workspace_path=str(tmp_path),
            input_path=str(copied_input),
            input_sha256=fixture_sha256,
            input_schema_id="marketingovo.fixture-observations.v1",
            output_directory=str(tmp_path / "out"),
            target_ids=["northstar-labs"],
            options={"simulate": "slow"},
            workflow=pb2.ANALYSIS_WORKFLOW_COMPARE,
        ),
    )
    process = subprocess.Popen(
        [sys.executable, "-m", "marketingovo_worker", "protocol"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    write_delimited(process.stdin, start)
    first = read_delimited(process.stdout, pb2.WorkerEnvelope)
    assert first is not None and first.WhichOneof("message") == "worker_event"
    cancel = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        cancel_analysis=pb2.CancelAnalysis(run_id="protocol-cancel", reason="test"),
    )
    write_delimited(process.stdin, cancel)

    result = None
    while envelope := read_delimited(process.stdout, pb2.WorkerEnvelope):
        if envelope.WhichOneof("message") == "analysis_result":
            result = envelope.analysis_result
            break
    process.stdin.close()
    assert process.wait(timeout=5) == 130
    assert result is not None
    assert not result.succeeded
    assert result.error_code == "cancelled"
    assert result.artifacts == []


def test_protocol_success_subprocess_exits_cleanly_after_result(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str, target_ids: list[str]
) -> None:
    pb2 = load_worker_pb2()
    copied_input = tmp_path / "observations.ndjson"
    copied_input.write_bytes(fixture_path.read_bytes())
    start = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        start_analysis=pb2.StartAnalysis(
            run_id="protocol-clean-exit",
            workspace_path=str(tmp_path),
            input_path=str(copied_input),
            input_sha256=fixture_sha256,
            input_schema_id="marketingovo.fixture-observations.v1",
            output_directory=str(tmp_path / "out"),
            target_ids=target_ids,
            options={"simulate": "none"},
            workflow=pb2.ANALYSIS_WORKFLOW_COMPARE,
        ),
    )
    process = subprocess.Popen(
        [sys.executable, "-m", "marketingovo_worker", "protocol"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    write_delimited(process.stdin, start)

    result = None
    while envelope := read_delimited(process.stdout, pb2.WorkerEnvelope):
        if envelope.WhichOneof("message") == "analysis_result":
            result = envelope.analysis_result
            break
    assert result is not None and result.succeeded
    process.stdin.close()
    assert process.wait(timeout=5) == 0
    assert process.stderr is not None
    assert process.stderr.read() == b""


def test_protocol_back_to_back_start_cancel_is_fast_and_cancelled(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str
) -> None:
    pb2 = load_worker_pb2()
    copied_input = tmp_path / "observations.ndjson"
    copied_input.write_bytes(fixture_path.read_bytes())
    start = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        start_analysis=pb2.StartAnalysis(
            run_id="protocol-immediate-cancel",
            workspace_path=str(tmp_path),
            input_path=str(copied_input),
            input_sha256=fixture_sha256,
            input_schema_id="marketingovo.fixture-observations.v1",
            output_directory=str(tmp_path / "out"),
            target_ids=["northstar-labs"],
            options={"simulate": "slow"},
            workflow=pb2.ANALYSIS_WORKFLOW_COMPARE,
        ),
    )
    cancel = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        cancel_analysis=pb2.CancelAnalysis(
            run_id="protocol-immediate-cancel", reason="back-to-back regression"
        ),
    )
    process = subprocess.Popen(
        [sys.executable, "-m", "marketingovo_worker", "protocol"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    started_at = time.monotonic()
    write_delimited(process.stdin, start)
    write_delimited(process.stdin, cancel)

    result = None
    while envelope := read_delimited(process.stdout, pb2.WorkerEnvelope):
        if envelope.WhichOneof("message") == "analysis_result":
            result = envelope.analysis_result
            break
    process.stdin.close()
    exit_code = process.wait(timeout=5)
    elapsed = time.monotonic() - started_at
    assert exit_code != 0
    assert elapsed < 3
    assert result is not None
    assert not result.succeeded
    assert result.error_code == "cancelled"
    assert len(result.artifacts) == 0


def test_protocol_research_fields_drive_a_distinct_cited_dossier(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str, target_ids: list[str]
) -> None:
    pb2 = load_worker_pb2()
    copied_input = tmp_path / "observations.ndjson"
    copied_input.write_bytes(fixture_path.read_bytes())
    question = "Which monitored brand gained the most public audience momentum?"
    start = pb2.WorkerEnvelope(
        protocol_version=PROTOCOL_VERSION,
        start_analysis=pb2.StartAnalysis(
            run_id="protocol-research",
            project_id="test",
            workspace_path=str(tmp_path),
            input_path=str(copied_input),
            input_sha256=fixture_sha256,
            input_schema_id="marketingovo.fixture-observations.v1",
            output_directory=str(tmp_path / "out"),
            target_ids=target_ids,
            options={"simulate": "none"},
            workflow=pb2.ANALYSIS_WORKFLOW_RESEARCH,
            research_question=question,
            source_budget=4,
        ),
    )
    sink = io.BytesIO()

    assert run_protocol(io.BytesIO(_framed(start)), sink) == 0

    report = (tmp_path / "out/report.json").read_text()
    assert '"workflow":"research"' in report
    assert f'"research_question":"{question}"' in report
    assert '"source_budget":4' in report
    assert '"title":"Research dossier:' in report
    assert '"research_plan":[' in report
    assert '"derivation":{' in report
