from __future__ import annotations

MODEL_VERSION = "competitive-pulse-baseline@0.1.0"
WORKER_VERSION = "0.1.0"
PARSER_VERSION = "golem-go-arrow-parquet.v1"
FIXTURE_INPUT_SCHEMA_ID = "golem.fixture-observations.v1"
OBSERVATION_SCHEMA_ID = "golem.observations.v1"
REPORT_SCHEMA_ID = "golem.comparison-report.v1"

MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_INPUT_ROWS = 1_000_000
MAX_LINE_BYTES = 2 * 1024 * 1024
MAX_TARGETS = 50

SIMULATION_MODES = frozenset({"none", "slow", "source_failure", "corrupt_artifact"})
