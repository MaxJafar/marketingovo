from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta

import pyarrow as pa
from hypothesis import given
from hypothesis import strategies as st

from marketingovo_worker.constants import FIXTURE_INPUT_SCHEMA_ID
from marketingovo_worker.normalize import normalize_table, parse_observations
from marketingovo_worker.schema import OBSERVATION_SCHEMA


@given(
    values=st.lists(
        st.floats(min_value=0, max_value=1_000_000, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=30,
        unique=True,
    )
)
def test_normalization_is_stably_sorted_and_schema_exact(values: list[float]) -> None:
    base = datetime(2026, 1, 1, tzinfo=UTC)
    rows = []
    for index, value in enumerate(reversed(values)):
        observed = base + timedelta(seconds=index)
        rows.append(
            {
                "observation_id": f"obs-{index:03d}",
                "entity_id": "entity-one",
                "entity_name": "Entity One",
                "platform": "fixture",
                "content_id": None,
                "dimension": None,
                "metric": "followers",
                "metric_definition_version": "followers.v1",
                "numerator": None,
                "denominator": None,
                "value": value,
                "unit": "followers",
                "published_at": None,
                "observed_at": observed.isoformat(),
                "recorded_at": (observed + timedelta(seconds=1)).isoformat(),
                "source_url": "https://example.invalid/entity-one",
                "native_id": f"native-{index:03d}",
                "connector_version": "fixture.property@1.0.0",
                "classification": "observed",
                "confidence": 1.0,
                "data_class": "public",
                "permitted_purpose": "competitive_research",
            }
        )
    payload = ("\n".join(json.dumps(row) for row in rows) + "\n").encode()
    digest = hashlib.sha256(payload).hexdigest()
    observations = parse_observations(payload, ["entity-one"], digest, FIXTURE_INPUT_SCHEMA_ID)
    table = normalize_table(observations)
    assert table.schema == OBSERVATION_SCHEMA
    observed_times = table.column("observed_at").to_pylist()
    assert observed_times == sorted(observed_times)
    assert pa.compute.all(pa.compute.is_finite(table.column("value"))).as_py()
