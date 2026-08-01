from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pyarrow.ipc as ipc
import pyarrow.parquet as pq
import pytest

from agentintel_worker.constants import FIXTURE_INPUT_SCHEMA_ID
from agentintel_worker.events import EventEmitter
from agentintel_worker.io import sha256_file
from agentintel_worker.models import AnalysisRequest
from agentintel_worker.pipeline import run_analysis
from agentintel_worker.schema import OBSERVATION_SCHEMA


def _request(
    workspace: Path,
    fixture_path: Path,
    fixture_sha256: str,
    target_ids: list[str],
    output_name: str,
    *,
    simulate: str = "none",
) -> AnalysisRequest:
    return AnalysisRequest(
        input_schema_id=FIXTURE_INPUT_SCHEMA_ID,
        run_id="golden-run-001",
        project_id="test",
        workspace_path=workspace,
        input_path=fixture_path,
        input_sha256=fixture_sha256,
        output_directory=workspace / output_name,
        target_ids=target_ids,
        simulate=simulate,
    )


def test_golden_pipeline_emits_exact_artifacts_and_metrics(
    repository_root: Path,
    fixture_path: Path,
    fixture_sha256: str,
    target_ids: list[str],
) -> None:
    output = repository_root / ".test-output-golden"
    request = _request(repository_root, fixture_path, fixture_sha256, target_ids, output.name)
    result = run_analysis(request, EventEmitter(request.run_id))
    try:
        assert result.succeeded
        assert [artifact.relative_path for artifact in result.artifacts] == [
            "normalized.arrow",
            "observations.parquet",
            "report.json",
        ]
        assert all(artifact.row_count in {3, 24} for artifact in result.artifacts)
        for artifact in result.artifacts:
            path = output / artifact.relative_path
            assert path.stat().st_size == artifact.size_bytes
            assert sha256_file(path) == artifact.sha256

        with ipc.open_file(output / "normalized.arrow") as reader:
            arrow_table = reader.read_all()
        parquet_table = pq.read_table(output / "observations.parquet")
        assert arrow_table.schema == OBSERVATION_SCHEMA
        assert parquet_table.schema == OBSERVATION_SCHEMA
        assert arrow_table.equals(parquet_table)
        assert set(arrow_table.column("artifact_hash").to_pylist()) == {fixture_sha256}
        assert arrow_table.column("extraction_pointer")[0].as_py().startswith("ndjson:")
        assert set(arrow_table.column("freshness_seconds").to_pylist()) == {300}
        assert set(arrow_table.column("availability").to_pylist()) == {"available"}
        assert set(arrow_table.column("coverage").to_pylist()) == {1.0}
        assert set(arrow_table.column("acquisition_mode").to_pylist()) == {"fixture"}
        assert set(arrow_table.column("rights_state").to_pylist()) == {"permitted"}
        assert min(arrow_table.column("retention_until").to_pylist()).year == 2027

        report = json.loads((output / "report.json").read_text())
        findings = {finding["entity_id"]: finding for finding in report["targets"]}
        assert findings["northstar-labs"]["follower_delta"] == 600
        assert findings["orbit-coffee"]["follower_delta"] == 240
        assert findings["vertex-studio"]["follower_delta"] == -80
        assert findings["northstar-labs"]["median_engagement_rate"] == pytest.approx(0.0533203848)
        assert findings["orbit-coffee"]["median_engagement_rate"] == pytest.approx(0.0267326733)
        assert findings["vertex-studio"]["median_engagement_rate"] == pytest.approx(0.019383378)
        assert findings["northstar-labs"]["posting_cadence_per_week"] == pytest.approx(14 / 11)
        assert findings["northstar-labs"]["content_format_mix"] == {
            "live": 0.25,
            "short": 0.25,
            "video": 0.5,
        }
        assert findings["orbit-coffee"]["content_format_mix"] == {
            "short": 0.75,
            "video": 0.25,
        }
        assert any(
            "customer retention" in warning for warning in findings["vertex-studio"]["warnings"]
        )
        assert report["generated_at"] == "2026-06-24T12:05:00.000000Z"
        assert report["workflow"] == "compare"
        assert len(report["research_plan"]) == 3
        assert report["derivation"] == {
            "worker_version": "0.1.0",
            "model_version": "competitive-pulse-baseline@0.1.0",
            "connector_version": "fixture.competitive-pulse@1.0.0",
            "parser_version": "agentintel-go-arrow-parquet.v1",
        }
        assert "customer retention" in report["summary"]
        assert len(findings["northstar-labs"]["citations"]) == 6
    finally:
        for child in output.iterdir():
            child.unlink()
        output.rmdir()


def test_report_is_deterministic_across_replay(
    repository_root: Path,
    fixture_path: Path,
    fixture_sha256: str,
    target_ids: list[str],
) -> None:
    first = repository_root / ".test-output-replay-a"
    second = repository_root / ".test-output-replay-b"
    first_request = _request(repository_root, fixture_path, fixture_sha256, target_ids, first.name)
    second_request = _request(
        repository_root, fixture_path, fixture_sha256, target_ids, second.name
    )
    try:
        first_result = run_analysis(first_request, EventEmitter(first_request.run_id))
        second_result = run_analysis(second_request, EventEmitter(second_request.run_id))
        assert first_result.report_sha256 == second_result.report_sha256
        assert (first / "report.json").read_bytes() == (second / "report.json").read_bytes()
    finally:
        for directory in (first, second):
            if directory.exists():
                for child in directory.iterdir():
                    child.unlink()
                directory.rmdir()


def test_corruption_simulation_makes_descriptor_stale(
    repository_root: Path,
    fixture_path: Path,
    fixture_sha256: str,
    target_ids: list[str],
) -> None:
    output = repository_root / ".test-output-corrupt"
    request = _request(
        repository_root,
        fixture_path,
        fixture_sha256,
        target_ids,
        output.name,
        simulate="corrupt_artifact",
    )
    try:
        result = run_analysis(request, EventEmitter(request.run_id))
        descriptor = next(
            artifact
            for artifact in result.artifacts
            if artifact.relative_path == "observations.parquet"
        )
        assert sha256_file(output / descriptor.relative_path) != descriptor.sha256
        persisted = json.loads((output / "artifact-result.json").read_text())
        persisted_descriptor = next(
            artifact
            for artifact in persisted["artifacts"]
            if artifact["relative_path"] == "observations.parquet"
        )
        assert persisted_descriptor["sha256"] == descriptor.sha256
    finally:
        for child in output.iterdir():
            child.unlink()
        output.rmdir()


def test_denominator_definitions_are_not_pooled(
    tmp_path: Path, fixture_path: Path, target_ids: list[str]
) -> None:
    rows = [json.loads(line) for line in fixture_path.read_text().splitlines() if line.strip()]
    for row in rows:
        if row["entity_id"] == "northstar-labs" and row["observation_id"] == "obs-north-post-04":
            row["metric_definition_version"] = "engagement-by-views.v1"
            row["numerator"] = 590.0
            row["denominator"] = 100000.0
            row["value"] = 0.0059
    input_path = tmp_path / "observations.ndjson"
    input_path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    request = _request(tmp_path, input_path, digest, target_ids, "out")
    result = run_analysis(request, EventEmitter(request.run_id))
    report = json.loads((tmp_path / "out/report.json").read_text())
    north = next(target for target in report["targets"] if target["entity_id"] == "northstar-labs")
    assert north["median_engagement_rate"] == pytest.approx(0.0509803922)
    assert any("values were not pooled" in warning for warning in north["warnings"])
    assert report["contradictions"]
    assert result.succeeded


def test_inconsistent_source_rate_is_preserved_but_not_used_for_analytics(
    tmp_path: Path, fixture_path: Path, target_ids: list[str]
) -> None:
    rows = [json.loads(line) for line in fixture_path.read_text().splitlines() if line.strip()]
    changed_observation = "obs-north-post-02"
    for row in rows:
        if row["observation_id"] == changed_observation:
            row["value"] = 0.99
    input_path = tmp_path / "observations.ndjson"
    input_path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    request = _request(tmp_path, input_path, digest, target_ids, "out")

    run_analysis(request, EventEmitter(request.run_id))
    report = json.loads((tmp_path / "out/report.json").read_text())
    north = next(target for target in report["targets"] if target["entity_id"] == "northstar-labs")

    assert north["median_engagement_rate"] == pytest.approx(0.0533203848)
    assert any(
        changed_observation in contradiction and "analytics use the derived rate" in contradiction
        for contradiction in report["contradictions"]
    )


def test_unavailable_evidence_is_preserved_but_not_used(
    tmp_path: Path, fixture_path: Path, target_ids: list[str]
) -> None:
    rows = [json.loads(line) for line in fixture_path.read_text().splitlines() if line.strip()]
    for row in rows:
        if row["observation_id"] == "obs-north-followers-01":
            row["availability"] = "unavailable"
    input_path = tmp_path / "observations.ndjson"
    input_path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    request = _request(tmp_path, input_path, digest, target_ids, "out")
    result = run_analysis(request, EventEmitter(request.run_id))
    report = json.loads((tmp_path / "out/report.json").read_text())
    north = next(target for target in report["targets"] if target["entity_id"] == "northstar-labs")
    assert north["follower_delta"] == 400
    assert any("excluded from metrics" in item for item in report["limitations"])
    assert (
        next(
            artifact
            for artifact in result.artifacts
            if artifact.relative_path == "normalized.arrow"
        ).row_count
        == 24
    )


def test_same_definition_on_different_platforms_is_not_ranked(
    tmp_path: Path, fixture_path: Path, target_ids: list[str]
) -> None:
    rows = [json.loads(line) for line in fixture_path.read_text().splitlines() if line.strip()]
    for row in rows:
        if row["entity_id"] == "orbit-coffee":
            row["platform"] = "instagram"
    input_path = tmp_path / "observations.ndjson"
    input_path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    request = _request(tmp_path, input_path, digest, target_ids, "out")
    run_analysis(request, EventEmitter(request.run_id))
    report = json.loads((tmp_path / "out/report.json").read_text())
    assert "not ranked because platforms" in report["summary"]
    assert any("different engagement platforms" in item for item in report["contradictions"])
