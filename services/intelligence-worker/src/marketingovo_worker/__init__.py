"""Marketingovo bounded intelligence worker."""

from .constants import (
    FIXTURE_INPUT_SCHEMA_ID,
    MODEL_VERSION,
    OBSERVATION_SCHEMA_ID,
    PARSER_VERSION,
    REPORT_SCHEMA_ID,
    WORKER_VERSION,
)

__all__ = [
    "FIXTURE_INPUT_SCHEMA_ID",
    "MODEL_VERSION",
    "OBSERVATION_SCHEMA_ID",
    "PARSER_VERSION",
    "REPORT_SCHEMA_ID",
    "WORKER_VERSION",
]

__version__ = WORKER_VERSION
