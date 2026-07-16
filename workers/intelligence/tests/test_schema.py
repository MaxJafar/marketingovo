from __future__ import annotations

import json
from pathlib import Path

import pyarrow as pa

from golem_intel_worker.schema import OBSERVATION_SCHEMA


def _arrow_type(name: str) -> pa.DataType:
    if name == "utf8":
        return pa.string()
    if name == "float64":
        return pa.float64()
    if name == "int64":
        return pa.int64()
    if name == "timestamp[us,UTC]":
        return pa.timestamp("us", tz="UTC")
    raise AssertionError(f"Unexpected contract type {name}")


def test_runtime_schema_exactly_matches_contract(repository_root: Path) -> None:
    contract_path = repository_root / "schemas/arrow/observations.schema.json"
    contract = json.loads(contract_path.read_text())
    assert contract["properties"]["schema_id"]["const"] == "golem.observations.v1"
    expected = contract["properties"]["fields"]["prefixItems"]
    assert len(expected) == len(OBSERVATION_SCHEMA) == 32
    for field, expected_wrapper in zip(OBSERVATION_SCHEMA, expected, strict=True):
        expected_field = expected_wrapper["const"]
        assert field.name == expected_field["name"]
        assert field.type == _arrow_type(expected_field["type"])
        assert field.nullable is expected_field["nullable"]
