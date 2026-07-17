from __future__ import annotations

MODEL_VERSION = "competitive-pulse-baseline@0.1.0"
WORKER_VERSION = "0.1.0"
PARSER_VERSION = "golem-go-arrow-parquet.v1"
CSV_PARSER_VERSION = "golem-python-competitive-pulse-csv@1.0.0"
METRIC_CATALOG_VERSION = "competitive-pulse.v1"
CSV_CONNECTOR_VERSION = "local.competitive-pulse-import@1.0.0"
FIXTURE_INPUT_SCHEMA_ID = "golem.fixture-observations.v1"
CSV_INPUT_SCHEMA_ID = "golem.competitive-pulse-import.v1"
OBSERVATION_SCHEMA_ID = "golem.observations.v1"
REPORT_SCHEMA_ID = "golem.comparison-report.v1"
CSV_REPORT_SCHEMA_ID = "golem.comparison-report.v2"

MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_INPUT_ROWS = 1_000_000
MAX_LINE_BYTES = 2 * 1024 * 1024
MAX_TARGETS = 50

MAX_CSV_BYTES = 8 * 1024 * 1024
MAX_CSV_RECORDS = 10_000
MAX_CSV_RECORD_BYTES = 65_536
MAX_CSV_FIELD_SCALARS = 4_096
MAX_IMPORT_DIAGNOSTICS = 100

SIMULATION_MODES = frozenset({"none", "slow", "source_failure", "corrupt_artifact"})
