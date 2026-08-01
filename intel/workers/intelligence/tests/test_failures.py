from __future__ import annotations

import hashlib
import json
import os
import signal
import subprocess
import sys
import threading
from pathlib import Path

import pytest

from agentintel_worker.constants import FIXTURE_INPUT_SCHEMA_ID
from agentintel_worker.errors import WorkerError
from agentintel_worker.events import EventEmitter
from agentintel_worker.models import AnalysisRequest
from agentintel_worker.pipeline import run_analysis


def _request(
    workspace: Path,
    input_path: Path,
    digest: str,
    target_ids: list[str],
    *,
    simulate: str = "none",
) -> AnalysisRequest:
    return AnalysisRequest(
        input_schema_id=FIXTURE_INPUT_SCHEMA_ID,
        run_id="failure-test",
        workspace_path=workspace,
        input_path=input_path,
        input_sha256=digest,
        output_directory=workspace / "out",
        target_ids=target_ids,
        simulate=simulate,
    )


def test_hash_mismatch_fails_closed(
    repository_root: Path, fixture_path: Path, target_ids: list[str]
) -> None:
    request = _request(repository_root, fixture_path, "0" * 64, target_ids)
    with pytest.raises(WorkerError, match="SHA-256 mismatch") as caught:
        run_analysis(request, EventEmitter(request.run_id))
    assert caught.value.code == "input_hash_mismatch"


def test_input_must_be_beneath_workspace(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str, target_ids: list[str]
) -> None:
    request = _request(tmp_path, fixture_path, fixture_sha256, target_ids)
    with pytest.raises(WorkerError) as caught:
        run_analysis(request, EventEmitter(request.run_id))
    assert caught.value.code == "path_policy_violation"


def test_input_symlink_is_rejected(
    tmp_path: Path, fixture_path: Path, target_ids: list[str]
) -> None:
    linked_input = tmp_path / "linked.ndjson"
    linked_input.symlink_to(fixture_path)
    digest = hashlib.sha256(fixture_path.read_bytes()).hexdigest()
    request = _request(tmp_path, linked_input, digest, target_ids)
    with pytest.raises(WorkerError) as caught:
        run_analysis(request, EventEmitter(request.run_id))
    assert caught.value.code == "path_policy_violation"


def test_source_failure_produces_no_evidence(
    repository_root: Path,
    fixture_path: Path,
    fixture_sha256: str,
    target_ids: list[str],
) -> None:
    request = _request(
        repository_root,
        fixture_path,
        fixture_sha256,
        target_ids,
        simulate="source_failure",
    )
    with pytest.raises(WorkerError) as caught:
        run_analysis(request, EventEmitter(request.run_id))
    assert caught.value.code == "source_failure"
    assert not list((repository_root / "out").glob("*.arrow"))
    if (repository_root / "out").exists():
        (repository_root / "out").rmdir()


def test_missing_required_metric_is_not_converted_to_zero(
    tmp_path: Path, fixture_path: Path
) -> None:
    fixture_rows = [
        json.loads(line) for line in fixture_path.read_text().splitlines() if line.strip()
    ]
    rows = [
        row
        for row in fixture_rows
        if not (row["entity_id"] == "northstar-labs" and row["metric"] == "followers")
    ]
    input_path = tmp_path / "missing-followers.ndjson"
    input_path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    request = _request(tmp_path, input_path, digest, ["northstar-labs"])
    with pytest.raises(WorkerError) as caught:
        run_analysis(request, EventEmitter(request.run_id))
    assert caught.value.code == "insufficient_evidence"
    assert "no followers observations" in caught.value.message


def test_validation_error_does_not_echo_secret_query_value(
    tmp_path: Path, fixture_path: Path
) -> None:
    first = next(line for line in fixture_path.read_text().splitlines() if line.strip())
    row = json.loads(first)
    row["source_url"] = "https://example.invalid/source?access_token=do-not-log-me"
    input_path = tmp_path / "secret-url.ndjson"
    input_path.write_text(json.dumps(row) + "\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    request = _request(tmp_path, input_path, digest, [row["entity_id"]])
    with pytest.raises(WorkerError) as caught:
        run_analysis(request, EventEmitter(request.run_id))
    assert caught.value.code == "invalid_observation"
    assert "do-not-log-me" not in caught.value.message


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX signal semantics are required")
@pytest.mark.best_effort
def test_slow_cli_handles_termination_as_cancellation(
    tmp_path: Path, fixture_path: Path, fixture_sha256: str
) -> None:
    command = [
        sys.executable,
        "-m",
        "agentintel_worker",
        "analyze",
        "--run-id",
        "cancel-test",
        "--workspace-path",
        str(tmp_path),
        "--input",
        str(tmp_path / "observations.ndjson"),
        "--input-sha256",
        fixture_sha256,
        "--output-dir",
        str(tmp_path / "out"),
        "--target-id",
        "northstar-labs",
        "--simulate",
        "slow",
    ]
    copied = tmp_path / "observations.ndjson"
    copied.write_bytes(fixture_path.read_bytes())
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    # Best-effort, and excluded from the default gate. Production never sends
    # SIGTERM to the worker: the Go supervisor cancels with Process.Kill(), which
    # cannot be blocked or lost, and that path is covered by
    # TestManagerCancelsSlowRun. This test asserts graceful SIGTERM handling,
    # which is a nicety nothing depends on, and it becomes unresponsive roughly
    # one run in six when the full suite runs. The measurements and the open
    # question are recorded in docs/status.md; run it with -m best_effort.
    #
    # stderr must be drained continuously. The worker flushes a progress event per
    # checkpoint, and a parent that reads one line and then stops reading until
    # communicate() lets the pipe fill. A child blocked in write(2) cannot run its
    # Python signal handler until that write returns, so the cancellation is never
    # observed and the test hangs — intermittently, depending on timing. Draining
    # in a thread removes that race entirely.
    stderr_lines: list[str] = []
    first_event = threading.Event()

    def drain() -> None:
        assert process.stderr is not None
        for line in process.stderr:
            stderr_lines.append(line)
            if "worker.validating" in line:
                first_event.set()

    drainer = threading.Thread(target=drain, daemon=True)
    drainer.start()
    try:
        # Wait until the worker emits its validation event, proving handlers are installed.
        assert first_event.wait(30), "worker never reported validation"
        os.kill(process.pid, signal.SIGTERM)
        stdout, _stderr = process.communicate(timeout=30)
    finally:
        if process.poll() is None:
            process.kill()
    result = json.loads(stdout)
    assert process.returncode == 130
    assert result["succeeded"] is False
    assert result["error_code"] == "cancelled"
