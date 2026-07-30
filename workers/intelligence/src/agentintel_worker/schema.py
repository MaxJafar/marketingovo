from __future__ import annotations

import pyarrow as pa

from .constants import OBSERVATION_SCHEMA_ID

UTC_MICROSECOND_TIMESTAMP = pa.timestamp("us", tz="UTC")

OBSERVATION_SCHEMA = pa.schema(
    [
        pa.field("observation_id", pa.string(), nullable=False),
        pa.field("entity_id", pa.string(), nullable=False),
        pa.field("entity_name", pa.string(), nullable=False),
        pa.field("platform", pa.string(), nullable=False),
        pa.field("content_id", pa.string(), nullable=True),
        pa.field("dimension", pa.string(), nullable=True),
        pa.field("metric", pa.string(), nullable=False),
        pa.field("metric_definition_version", pa.string(), nullable=False),
        pa.field("numerator", pa.float64(), nullable=True),
        pa.field("denominator", pa.float64(), nullable=True),
        pa.field("value", pa.float64(), nullable=False),
        pa.field("unit", pa.string(), nullable=False),
        pa.field("published_at", UTC_MICROSECOND_TIMESTAMP, nullable=True),
        pa.field("observed_at", UTC_MICROSECOND_TIMESTAMP, nullable=False),
        pa.field("recorded_at", UTC_MICROSECOND_TIMESTAMP, nullable=False),
        pa.field("valid_from", UTC_MICROSECOND_TIMESTAMP, nullable=False),
        pa.field("valid_to", UTC_MICROSECOND_TIMESTAMP, nullable=True),
        pa.field("source_url", pa.string(), nullable=False),
        pa.field("native_id", pa.string(), nullable=False),
        pa.field("connector_version", pa.string(), nullable=False),
        pa.field("classification", pa.string(), nullable=False),
        pa.field("confidence", pa.float64(), nullable=False),
        pa.field("artifact_hash", pa.string(), nullable=False),
        pa.field("extraction_pointer", pa.string(), nullable=False),
        pa.field("freshness_seconds", pa.int64(), nullable=False),
        pa.field("availability", pa.string(), nullable=False),
        pa.field("coverage", pa.float64(), nullable=False),
        pa.field("acquisition_mode", pa.string(), nullable=False),
        pa.field("data_class", pa.string(), nullable=False),
        pa.field("permitted_purpose", pa.string(), nullable=False),
        pa.field("retention_until", UTC_MICROSECOND_TIMESTAMP, nullable=False),
        pa.field("rights_state", pa.string(), nullable=False),
    ],
    metadata={b"golem.schema_id": OBSERVATION_SCHEMA_ID.encode("ascii")},
)

OBSERVATION_FIELD_NAMES = tuple(field.name for field in OBSERVATION_SCHEMA)
