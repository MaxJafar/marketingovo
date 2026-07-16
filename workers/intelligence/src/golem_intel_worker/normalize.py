from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import polars as pl
import pyarrow as pa
from pydantic import ValidationError

from .constants import MAX_INPUT_ROWS, MAX_LINE_BYTES
from .errors import WorkerError
from .models import Observation
from .schema import OBSERVATION_FIELD_NAMES, OBSERVATION_SCHEMA


def _safe_validation_summary(error: ValidationError) -> str:
    summaries: list[str] = []
    for item in error.errors(include_url=False, include_context=False, include_input=False)[:5]:
        location = ".".join(str(part) for part in item["loc"]) or "record"
        summaries.append(f"{location}: {item['type']}")
    suffix = "; ".join(summaries)
    return suffix or "record validation failed"


def _parse_timestamp(value: object, *, field: str, line_number: int) -> datetime:
    if not isinstance(value, str):
        raise WorkerError(
            "invalid_observation", f"Observation line {line_number} has no string {field}."
        )
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise WorkerError(
            "invalid_observation", f"Observation line {line_number} has invalid {field}."
        ) from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise WorkerError(
            "invalid_observation", f"Observation line {line_number} has timezone-free {field}."
        )
    return parsed.astimezone(UTC)


def _enrich_legacy_fixture(raw: object, *, input_sha256: str, line_number: int) -> object:
    if not isinstance(raw, dict):
        return raw
    connector = raw.get("connector_version")
    missing_provenance = any(
        field not in raw
        for field in (
            "valid_from",
            "artifact_hash",
            "extraction_pointer",
            "freshness_seconds",
            "availability",
            "coverage",
            "acquisition_mode",
            "retention_until",
            "rights_state",
        )
    )
    if not missing_provenance:
        return raw
    if not isinstance(connector, str) or not connector.startswith("fixture."):
        raise WorkerError(
            "invalid_observation",
            f"Observation line {line_number} omits v1 provenance fields and is not a fixture.",
        )
    observed_at = _parse_timestamp(
        raw.get("observed_at"), field="observed_at", line_number=line_number
    )
    recorded_at = _parse_timestamp(
        raw.get("recorded_at"), field="recorded_at", line_number=line_number
    )
    enriched = dict(raw)
    enriched.setdefault("valid_from", observed_at.isoformat())
    enriched.setdefault("valid_to", None)
    enriched.setdefault("artifact_hash", input_sha256)
    enriched.setdefault("extraction_pointer", f"ndjson:{line_number}")
    enriched.setdefault(
        "freshness_seconds", max(0, int((recorded_at - observed_at).total_seconds()))
    )
    enriched.setdefault("availability", "available")
    enriched.setdefault("coverage", 1.0)
    enriched.setdefault("acquisition_mode", "fixture")
    # Synthetic golden evidence must remain policy-eligible throughout the
    # Phase 1 acceptance window. Production connectors supply their own
    # purpose-specific retention deadline instead of inheriting this fixture.
    enriched.setdefault("retention_until", (recorded_at + timedelta(days=365)).isoformat())
    enriched.setdefault("rights_state", "permitted")
    return enriched


def parse_observations(
    payload: bytes, target_ids: list[str], input_sha256: str
) -> list[Observation]:
    targets = set(target_ids)
    observations: list[Observation] = []
    seen_ids: set[str] = set()
    discovered_targets: set[str] = set()

    for line_number, raw_line in enumerate(payload.splitlines(), start=1):
        if not raw_line.strip():
            continue
        if len(raw_line) > MAX_LINE_BYTES:
            raise WorkerError(
                "invalid_observation",
                f"Observation line {line_number} exceeds the {MAX_LINE_BYTES}-byte limit.",
            )
        if len(seen_ids) >= MAX_INPUT_ROWS:
            raise WorkerError(
                "input_too_large", f"Input exceeds the {MAX_INPUT_ROWS}-observation limit."
            )
        try:
            raw = _enrich_legacy_fixture(
                json.loads(raw_line), input_sha256=input_sha256, line_number=line_number
            )
            observation = Observation.model_validate(raw)
        except ValidationError as exc:
            summary = _safe_validation_summary(exc)
            raise WorkerError(
                "invalid_observation",
                f"Observation line {line_number} failed validation ({summary}).",
            ) from exc
        except (json.JSONDecodeError, TypeError) as exc:
            raise WorkerError(
                "invalid_observation", f"Observation line {line_number} is not valid JSON."
            ) from exc
        if observation.observation_id in seen_ids:
            raise WorkerError(
                "duplicate_observation",
                f"Duplicate observation_id {observation.observation_id!r} at line {line_number}.",
            )
        seen_ids.add(observation.observation_id)
        if observation.entity_id in targets:
            observations.append(observation)
            discovered_targets.add(observation.entity_id)

    missing = [target for target in target_ids if target not in discovered_targets]
    if missing:
        raise WorkerError(
            "insufficient_evidence",
            "No evidence was provided for target(s): " + ", ".join(missing) + ".",
        )
    if not observations:
        raise WorkerError("insufficient_evidence", "No selected observations were provided.")
    return observations


def normalize_table(observations: list[Observation]) -> pa.Table:
    rows = [
        {name: getattr(observation, name) for name in OBSERVATION_FIELD_NAMES}
        for observation in observations
    ]
    # Polars owns the normalization/sort boundary; Arrow's explicit cast below
    # prevents Polars' large_utf8 preference from leaking across the contract.
    frame = pl.DataFrame(rows, strict=True).select(OBSERVATION_FIELD_NAMES)
    frame = frame.sort(["entity_id", "observed_at", "observation_id"])
    table = frame.to_arrow().cast(OBSERVATION_SCHEMA, safe=True)
    if table.schema != OBSERVATION_SCHEMA:
        raise WorkerError("schema_mismatch", "Normalized Arrow schema does not match v1.")
    return table
