from __future__ import annotations

import csv
import io
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from urllib.parse import unquote_to_bytes, urlsplit

import polars as pl
import pyarrow as pa
from pydantic import ValidationError

from .constants import (
    CSV_CONNECTOR_VERSION,
    CSV_INPUT_SCHEMA_ID,
    MAX_CSV_FIELD_SCALARS,
    MAX_CSV_RECORD_BYTES,
    MAX_CSV_RECORDS,
    MAX_IMPORT_DIAGNOSTICS,
    MAX_INPUT_ROWS,
    MAX_LINE_BYTES,
)
from .errors import WorkerError
from .models import Observation
from .schema import OBSERVATION_FIELD_NAMES, OBSERVATION_SCHEMA

CSV_COLUMNS = (
    "schema_version",
    "observation_id",
    "target_id",
    "target_name",
    "platform",
    "metric",
    "value",
    "numerator",
    "denominator",
    "content_id",
    "content_format",
    "published_at",
    "observed_at",
    "recorded_at",
    "source_url",
    "native_id",
    "confidence",
    "coverage",
    "data_class",
    "permitted_purpose",
    "retention_days",
    "rights_state",
)
METRIC_IDS = (
    "followers.delta",
    "public-engagement-by-followers.median",
    "posting-cadence",
    "content-format-mix",
)
METRIC_DEFINITIONS = {
    "followers": ("followers.v1", "followers"),
    "content_published": ("content-observation.v1", "content"),
    "engagement_rate": ("public-engagement-by-followers.v1", "ratio"),
}
CONTENT_FORMATS = {"video", "short", "image", "carousel", "text", "live", "audio", "unknown"}
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
TARGET_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
PLATFORM_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
CONTENT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$")
INTEGER_RE = re.compile(r"^(?:0|[1-9][0-9]*)$")
DECIMAL_RE = re.compile(r"^(?:0(?:\.[0-9]{1,6})?|1(?:\.0{1,6})?)$")
TIMESTAMP_RE = re.compile(
    r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$"
)
HOST_LABEL_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")
CONTROL_RE = re.compile("[\x00-\x1f\x7f-\x9f]")
MAX_SAFE_INTEGER = 9_007_199_254_740_991


@dataclass(frozen=True)
class ImportDiagnostic:
    severity: str
    code: str
    message: str
    record_number: int | None = None
    column: str | None = None


@dataclass(frozen=True)
class ImportParseResult:
    observations: list[Observation]
    diagnostics: list[ImportDiagnostic]
    diagnostics_truncated: bool
    row_count: int | None
    platform: str | None
    retention_days: int | None
    target_names: dict[str, str]
    target_row_counts: dict[str, int]
    metric_availability: dict[str, dict[str, str]]

    @property
    def valid(self) -> bool:
        return not any(item.severity == "error" for item in self.diagnostics)


def _safe_validation_summary(error: ValidationError) -> str:
    summaries: list[str] = []
    for item in error.errors(include_url=False, include_context=False, include_input=False)[:5]:
        location = ".".join(str(part) for part in item["loc"]) or "record"
        summaries.append(f"{location}: {item['type']}")
    return "; ".join(summaries) or "record validation failed"


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
    provenance = (
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
    if all(field in raw for field in provenance):
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
    enriched.setdefault("retention_until", (recorded_at + timedelta(days=365)).isoformat())
    enriched.setdefault("rights_state", "permitted")
    return enriched


def parse_authority_timestamp(value: str) -> datetime:
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", value):
        raise WorkerError("validated_at_invalid", "Authority validation time is invalid.")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    except ValueError as exc:
        raise WorkerError("validated_at_invalid", "Authority validation time is invalid.") from exc


def _diagnostic(
    code: str, *, record: int | None = None, column: str | None = None, severity: str = "error"
) -> ImportDiagnostic:
    messages = {
        "invalid_utf8": "The input is not valid UTF-8.",
        "utf8_bom_forbidden": "A UTF-8 byte-order mark is not permitted.",
        "csv_syntax": "The CSV record does not use the required grammar.",
        "csv_embedded_newline": "Quoted fields must not contain record endings.",
        "csv_empty_record": "Blank CSV records are not permitted.",
        "csv_record_too_large": "The CSV record exceeds 65536 encoded bytes.",
        "csv_record_limit_exceeded": "The CSV contains more than 10000 data records.",
        "csv_header_missing": "The required CSV header is missing.",
        "csv_duplicate_header": "The CSV header contains a duplicate column.",
        "csv_missing_column": "The CSV header is missing a required column.",
        "csv_unknown_column": "The CSV header contains an unsupported column.",
        "csv_column_order": "The CSV columns are not in the required order.",
        "field_required": f"A required {column or 'field'} value is missing.",
        "field_must_be_empty": f"The {column or 'field'} value must be empty for this metric.",
        "field_whitespace": "The field must not contain surrounding whitespace.",
        "field_control_character": "The field contains a forbidden control character.",
        "field_formula_prefix": "The text field begins with a forbidden formula prefix.",
        "field_too_large": "The field exceeds its maximum decoded length.",
        "field_format": "The field does not match the required format.",
        "field_out_of_range": "The numeric field is outside the permitted range.",
        "field_enum": "The field is not one of the permitted values.",
        "timestamp_format": "The timestamp must use the required UTC format.",
        "timestamp_order": "The row timestamps are not in the permitted order.",
        "timestamp_in_future": "The recorded time is later than the permitted validation window.",
        "source_url_invalid": "The source reference is not a permitted ASCII URI.",
        "source_url_control_character": "The source path decodes to a forbidden character.",
        "source_url_scheme": "The source reference must begin with lowercase https://.",
        "source_url_credentials": "The source reference must not contain credentials.",
        "source_url_host_forbidden": "The source host is not permitted by source-reference.v1.",
        "source_url_port_forbidden": "The source reference must not contain an explicit port.",
        "source_url_query_forbidden": "The source reference must not contain a query.",
        "source_url_fragment_forbidden": "The source reference must not contain a fragment.",
        "schema_version_unsupported": "The row schema version is not supported.",
        "metric_field_combination": "The metric fields do not form a permitted combination.",
        "content_reference_missing": "The engagement row has no matching content record.",
        "content_reference_mismatch": "The engagement row conflicts with its content record.",
        "policy_data_class_forbidden": "Only public data is permitted.",
        "policy_purpose_forbidden": "Only competitive_research is permitted.",
        "policy_rights_forbidden": "Only permitted rights state is accepted.",
        "policy_value_conflict": "A file-scoped policy value changes between records.",
        "duplicate_observation_id": "The observation ID appeared earlier in the file.",
        "duplicate_observation": "An exact observation appeared earlier in the file.",
        "duplicate_content_metric": "A target/content metric appeared earlier in the file.",
        "target_count_out_of_range": "The CSV must contain observations for 2 to 5 targets.",
        "target_name_conflict": "A target ID maps to more than one target name.",
        "platform_count_out_of_range": "The CSV must contain exactly one platform.",
        "observation_value_conflict": "Follower observations disagree at one target and timestamp.",
        "metric_missing": "No qualifying evidence exists for this output metric.",
        "metric_insufficient": "The metric has evidence but not the minimum required population.",
        "metric_contradictory": "Unresolved follower evidence prevents this metric calculation.",
        "short_cadence_window": "Posting cadence uses the fixed one-week minimum window.",
        "partial_metric_coverage": "Conflicting evidence reduces the metric population.",
    }
    return ImportDiagnostic(severity, code, messages[code], record, column)


def _split_records(text: str) -> tuple[list[str], ImportDiagnostic | None]:
    records = text.split("\n", MAX_CSV_RECORDS + 1)
    ended_with_newline = text.endswith("\n")
    overflow = len(records) == MAX_CSV_RECORDS + 2 and bool(records[-1])
    if ended_with_newline and not overflow:
        records.pop()
    inspected_records = records[: MAX_CSV_RECORDS + 1] if overflow else records
    for index, record in enumerate(inspected_records):
        record_number = index + 1
        if record.endswith("\r"):
            records[index] = record = record[:-1]
        if "\r" in record:
            quoted = False
            cursor = 0
            while cursor < len(record):
                if record[cursor] == '"':
                    if quoted and cursor + 1 < len(record) and record[cursor + 1] == '"':
                        cursor += 2
                        continue
                    quoted = not quoted
                elif record[cursor] == "\r":
                    code = "csv_embedded_newline" if quoted else "csv_syntax"
                    return records[:index], _diagnostic(code, record=record_number)
                cursor += 1
        unescaped_quotes = record.replace('""', "").count('"')
        if unescaped_quotes % 2:
            code = (
                "csv_embedded_newline"
                if index < len(inspected_records) - 1 or ended_with_newline
                else "csv_syntax"
            )
            return records[:index], _diagnostic(code, record=record_number)
    if overflow:
        return inspected_records, _diagnostic(
            "csv_record_limit_exceeded", record=MAX_CSV_RECORDS + 2
        )
    return inspected_records, None


def _parse_record(
    record: str, record_number: int
) -> tuple[list[str] | None, ImportDiagnostic | None]:
    try:
        values = next(csv.reader(io.StringIO(record, newline=""), strict=True))
    except (csv.Error, StopIteration):
        return None, _diagnostic("csv_syntax", record=record_number)
    return values, None


def _has_control(value: str) -> bool:
    return CONTROL_RE.search(value) is not None


def _field_rules(
    value: str,
    *,
    record: int,
    column: str,
    formula: bool = False,
    limit: int = MAX_CSV_FIELD_SCALARS,
) -> list[ImportDiagnostic]:
    diagnostics: list[ImportDiagnostic] = []
    if not value:
        return diagnostics
    if value[0].isspace() or value[-1].isspace():
        diagnostics.append(_diagnostic("field_whitespace", record=record, column=column))
    if _has_control(value):
        diagnostics.append(_diagnostic("field_control_character", record=record, column=column))
    if formula and value[0] in "=+-@":
        diagnostics.append(_diagnostic("field_formula_prefix", record=record, column=column))
    if len(value) > limit:
        diagnostics.append(_diagnostic("field_too_large", record=record, column=column))
    if not value.isascii() and unicodedata.normalize("NFC", value) != value:
        diagnostics.append(_diagnostic("field_format", record=record, column=column))
    return diagnostics


@lru_cache(maxsize=16_384)
def _source_url_error(value: str) -> str | None:
    try:
        encoded = value.encode("ascii")
    except UnicodeEncodeError:
        return "source_url_invalid"
    if not 1 <= len(encoded) <= 2048 or any(char.isspace() for char in value) or "\\" in value:
        return "source_url_invalid"
    if re.search(r"%(?![0-9A-Fa-f]{2})", value):
        return "source_url_invalid"
    try:
        parsed = urlsplit(value)
        path = unquote_to_bytes(parsed.path).decode("utf-8")
    except (UnicodeDecodeError, ValueError):
        return "source_url_invalid"
    if _has_control(path) or any(char.isspace() for char in path) or "\\" in path:
        return "source_url_control_character"
    if not value.startswith("https://"):
        return "source_url_scheme"
    authority = value[8:].split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    if "@" in authority:
        return "source_url_credentials"
    host = parsed.hostname
    forbidden_host = host is None
    if host is not None:
        if ":" in host or re.fullmatch(r"[0-9.]+", host):
            forbidden_host = True
        else:
            labels = host.split(".")
            forbidden_host = (
                len(labels) < 2
                or host.endswith(".")
                or host.casefold() == "localhost"
                or host.casefold().endswith((".localhost", ".local", ".home.arpa"))
                or any(not HOST_LABEL_RE.fullmatch(label) for label in labels)
            )
    if forbidden_host:
        return "source_url_host_forbidden"
    host_port = authority.rsplit("@", 1)[-1]
    if host_port.startswith("[") or ":" in host_port:
        return "source_url_port_forbidden"
    if "?" in value:
        return "source_url_query_forbidden"
    if "#" in value:
        return "source_url_fragment_forbidden"
    return None


def validate_source_url(
    value: str, *, record: int, column: str = "source_url"
) -> ImportDiagnostic | None:
    code = _source_url_error(value)
    return _diagnostic(code, record=record, column=column) if code is not None else None


def _csv_timestamp(
    value: str, *, record: int, column: str, diagnostics: list[ImportDiagnostic]
) -> datetime | None:
    if not value:
        diagnostics.append(_diagnostic("field_required", record=record, column=column))
        return None
    if not TIMESTAMP_RE.fullmatch(value):
        diagnostics.append(_diagnostic("timestamp_format", record=record, column=column))
        return None
    try:
        return datetime.fromisoformat(value[:-1] + "+00:00").astimezone(UTC)
    except ValueError:
        diagnostics.append(_diagnostic("timestamp_format", record=record, column=column))
        return None


def _integer(
    value: str,
    *,
    record: int,
    column: str,
    diagnostics: list[ImportDiagnostic],
    minimum: int = 0,
    maximum: int = MAX_SAFE_INTEGER,
) -> int | None:
    if not value:
        diagnostics.append(_diagnostic("field_required", record=record, column=column))
        return None
    if not INTEGER_RE.fullmatch(value):
        diagnostics.append(_diagnostic("field_format", record=record, column=column))
        return None
    parsed = int(value)
    if not minimum <= parsed <= maximum:
        diagnostics.append(_diagnostic("field_out_of_range", record=record, column=column))
        return None
    return parsed


def _decimal(
    value: str,
    *,
    record: int,
    column: str,
    diagnostics: list[ImportDiagnostic],
    positive: bool = False,
) -> float | None:
    if not value:
        diagnostics.append(_diagnostic("field_required", record=record, column=column))
        return None
    if not DECIMAL_RE.fullmatch(value):
        diagnostics.append(_diagnostic("field_format", record=record, column=column))
        return None
    parsed = float(value)
    if positive and parsed <= 0:
        diagnostics.append(_diagnostic("field_out_of_range", record=record, column=column))
        return None
    return parsed


def _record_limit_prefix_end(payload: bytes) -> int | None:
    """Return the first byte of data record 10,001 without reading beyond it."""
    record_start = 0
    # Physical record 1 is the header; records 2..10,001 are the allowed data rows.
    for _record_number in range(1, MAX_CSV_RECORDS + 2):
        record_end = payload.find(b"\n", record_start)
        if record_end < 0:
            return None
        record = payload[record_start:record_end]
        if record.endswith(b"\r"):
            record = record[:-1]
        if b"\r" in record or record.replace(b'""', b"").count(b'"') % 2:
            # Let the existing decoder and lexical parser report the earlier error.
            return None
        record_start = record_end + 1
    return record_start if record_start < len(payload) else None


def parse_csv_import(
    payload: bytes,
    *,
    input_sha256: str,
    validated_at: datetime,
    materialize_observations: bool = True,
) -> ImportParseResult:
    diagnostics: list[ImportDiagnostic] = []
    overflow_start = _record_limit_prefix_end(payload)
    if overflow_start is not None:
        try:
            prefix = payload[:overflow_start].decode("utf-8")
        except UnicodeDecodeError:
            return ImportParseResult(
                [], [_diagnostic("invalid_utf8")], False, None, None, None, {}, {}, {}
            )
        if prefix.startswith("\ufeff"):
            return ImportParseResult(
                [], [_diagnostic("utf8_bom_forbidden")], False, None, None, None, {}, {}, {}
            )
        return ImportParseResult(
            [],
            [_diagnostic("csv_record_limit_exceeded", record=MAX_CSV_RECORDS + 2)],
            False,
            MAX_CSV_RECORDS + 1,
            None,
            None,
            {},
            {},
            {},
        )
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        return ImportParseResult(
            [], [_diagnostic("invalid_utf8")], False, None, None, None, {}, {}, {}
        )
    if text.startswith("\ufeff"):
        return ImportParseResult(
            [], [_diagnostic("utf8_bom_forbidden")], False, None, None, None, {}, {}, {}
        )
    records, lexical = _split_records(text)
    if lexical is not None:
        row_count = MAX_CSV_RECORDS + 1 if lexical.code == "csv_record_limit_exceeded" else None
        return ImportParseResult([], [lexical], False, row_count, None, None, {}, {}, {})
    if not records:
        return ImportParseResult(
            [], [_diagnostic("csv_header_missing")], False, 0, None, None, {}, {}, {}
        )
    for number, record in enumerate(records, start=1):
        if not record:
            return ImportParseResult(
                [],
                [_diagnostic("csv_empty_record", record=number)],
                False,
                max(0, len(records) - 1),
                None,
                None,
                {},
                {},
                {},
            )
        if len(record.encode("utf-8")) > MAX_CSV_RECORD_BYTES:
            return ImportParseResult(
                [],
                [_diagnostic("csv_record_too_large", record=number)],
                False,
                max(0, len(records) - 1),
                None,
                None,
                {},
                {},
                {},
            )
    row_count = len(records) - 1
    header, error = _parse_record(records[0], 1)
    if error is not None or header is None:
        return ImportParseResult(
            [],
            [error or _diagnostic("csv_header_missing")],
            False,
            row_count,
            None,
            None,
            {},
            {},
            {},
        )
    if len(header) != len(set(header)):
        diagnostics.append(_diagnostic("csv_duplicate_header", record=1))
    missing = set(CSV_COLUMNS) - set(header)
    unknown = set(header) - set(CSV_COLUMNS)
    if missing:
        diagnostics.append(_diagnostic("csv_missing_column", record=1))
    if unknown:
        diagnostics.append(_diagnostic("csv_unknown_column", record=1))
    if not missing and not unknown and tuple(header) != CSV_COLUMNS:
        diagnostics.append(_diagnostic("csv_column_order", record=1))
    if diagnostics:
        return ImportParseResult([], diagnostics, False, row_count, None, None, {}, {}, {})

    observations: list[Observation] = []
    accepted_rows: list[tuple[int, dict[str, str]]] = []
    metric_rows: defaultdict[str, list[tuple[str, datetime, float]]] = defaultdict(list)
    seen_ids: set[str] = set()
    seen_fingerprints: set[tuple[str, ...]] = set()
    target_names: dict[str, str] = {}
    target_row_counts: defaultdict[str, int] = defaultdict(int)
    platforms: set[str] = set()
    policy_values: set[tuple[str, str, str, str]] = set()
    content_metrics: dict[tuple[str, str, str], tuple[int, dict[str, str]]] = {}

    for record_number, encoded_record in enumerate(records[1:], start=2):
        values, error = _parse_record(encoded_record, record_number)
        if error is not None or values is None or len(values) != len(CSV_COLUMNS):
            diagnostics.append(error or _diagnostic("csv_syntax", record=record_number))
            continue
        raw = dict(zip(CSV_COLUMNS, values, strict=True))
        row_diagnostics: list[ImportDiagnostic] = []
        for column, value in raw.items():
            row_diagnostics.extend(
                _field_rules(
                    value,
                    record=record_number,
                    column=column,
                    formula=column in {"target_name", "native_id"},
                )
            )

        if raw["schema_version"] != CSV_INPUT_SCHEMA_ID:
            row_diagnostics.append(
                _diagnostic(
                    "schema_version_unsupported", record=record_number, column="schema_version"
                )
            )
        if not ID_RE.fullmatch(raw["observation_id"]):
            row_diagnostics.append(
                _diagnostic("field_format", record=record_number, column="observation_id")
            )
        if not TARGET_RE.fullmatch(raw["target_id"]):
            row_diagnostics.append(
                _diagnostic("field_format", record=record_number, column="target_id")
            )
        if not raw["target_name"]:
            row_diagnostics.append(
                _diagnostic("field_required", record=record_number, column="target_name")
            )
        elif len(raw["target_name"]) > 200:
            row_diagnostics.append(
                _diagnostic("field_too_large", record=record_number, column="target_name")
            )
        if not PLATFORM_RE.fullmatch(raw["platform"]):
            row_diagnostics.append(
                _diagnostic("field_format", record=record_number, column="platform")
            )
        if raw["metric"] not in METRIC_DEFINITIONS:
            row_diagnostics.append(_diagnostic("field_enum", record=record_number, column="metric"))
        if not raw["native_id"]:
            row_diagnostics.append(
                _diagnostic("field_required", record=record_number, column="native_id")
            )
        elif len(raw["native_id"]) > 256:
            row_diagnostics.append(
                _diagnostic("field_too_large", record=record_number, column="native_id")
            )

        observed_at = _csv_timestamp(
            raw["observed_at"],
            record=record_number,
            column="observed_at",
            diagnostics=row_diagnostics,
        )
        recorded_at = _csv_timestamp(
            raw["recorded_at"],
            record=record_number,
            column="recorded_at",
            diagnostics=row_diagnostics,
        )
        published_at: datetime | None = None
        if raw["published_at"]:
            published_at = _csv_timestamp(
                raw["published_at"],
                record=record_number,
                column="published_at",
                diagnostics=row_diagnostics,
            )
        if observed_at is not None and recorded_at is not None:
            if recorded_at < observed_at or (
                published_at is not None and published_at > observed_at
            ):
                row_diagnostics.append(_diagnostic("timestamp_order", record=record_number))
            if recorded_at > validated_at + timedelta(minutes=5):
                row_diagnostics.append(_diagnostic("timestamp_in_future", record=record_number))

        if not any(item.column == "source_url" for item in row_diagnostics):
            source_error = validate_source_url(raw["source_url"], record=record_number)
            if source_error is not None:
                row_diagnostics.append(source_error)
        confidence = _decimal(
            raw["confidence"],
            record=record_number,
            column="confidence",
            diagnostics=row_diagnostics,
        )
        coverage = _decimal(
            raw["coverage"],
            record=record_number,
            column="coverage",
            diagnostics=row_diagnostics,
            positive=True,
        )
        retention_days = _integer(
            raw["retention_days"],
            record=record_number,
            column="retention_days",
            diagnostics=row_diagnostics,
            minimum=1,
            maximum=365,
        )
        if raw["data_class"] != "public":
            row_diagnostics.append(
                _diagnostic(
                    "policy_data_class_forbidden", record=record_number, column="data_class"
                )
            )
        if raw["permitted_purpose"] != "competitive_research":
            row_diagnostics.append(
                _diagnostic(
                    "policy_purpose_forbidden", record=record_number, column="permitted_purpose"
                )
            )
        if raw["rights_state"] != "permitted":
            row_diagnostics.append(
                _diagnostic("policy_rights_forbidden", record=record_number, column="rights_state")
            )

        metric = raw["metric"]
        value: int | float | None = None
        numerator: int | None = None
        denominator: int | None = None
        if metric == "followers":
            value = _integer(
                raw["value"], record=record_number, column="value", diagnostics=row_diagnostics
            )
            for column in (
                "numerator",
                "denominator",
                "content_id",
                "content_format",
                "published_at",
            ):
                if raw[column]:
                    row_diagnostics.append(
                        _diagnostic("field_must_be_empty", record=record_number, column=column)
                    )
        elif metric == "content_published":
            if raw["value"] != "1":
                row_diagnostics.append(
                    _diagnostic("metric_field_combination", record=record_number, column="value")
                )
            else:
                value = 1
            for column in ("numerator", "denominator"):
                if raw[column]:
                    row_diagnostics.append(
                        _diagnostic("field_must_be_empty", record=record_number, column=column)
                    )
            for column in ("content_id", "content_format", "published_at"):
                if not raw[column]:
                    row_diagnostics.append(
                        _diagnostic("field_required", record=record_number, column=column)
                    )
        elif metric == "engagement_rate":
            if raw["value"]:
                row_diagnostics.append(
                    _diagnostic("field_must_be_empty", record=record_number, column="value")
                )
            numerator = _integer(
                raw["numerator"],
                record=record_number,
                column="numerator",
                diagnostics=row_diagnostics,
            )
            denominator = _integer(
                raw["denominator"],
                record=record_number,
                column="denominator",
                diagnostics=row_diagnostics,
                minimum=1,
            )
            for column in ("content_id", "content_format", "published_at"):
                if not raw[column]:
                    row_diagnostics.append(
                        _diagnostic("field_required", record=record_number, column=column)
                    )
            if numerator is not None and denominator is not None:
                value = numerator / denominator
        if metric in {"content_published", "engagement_rate"}:
            if raw["content_id"] and not CONTENT_ID_RE.fullmatch(raw["content_id"]):
                row_diagnostics.append(
                    _diagnostic("field_format", record=record_number, column="content_id")
                )
            if raw["content_format"] and raw["content_format"] not in CONTENT_FORMATS:
                row_diagnostics.append(
                    _diagnostic("field_enum", record=record_number, column="content_format")
                )

        fingerprint = tuple(
            raw[column]
            for column in (
                "target_id",
                "metric",
                "native_id",
                "observed_at",
                "source_url",
                "value",
                "numerator",
                "denominator",
                "content_id",
                "content_format",
                "published_at",
            )
        )
        if raw["observation_id"] in seen_ids:
            row_diagnostics.append(
                _diagnostic(
                    "duplicate_observation_id", record=record_number, column="observation_id"
                )
            )
        else:
            seen_ids.add(raw["observation_id"])
        if fingerprint in seen_fingerprints:
            row_diagnostics.append(_diagnostic("duplicate_observation", record=record_number))
        else:
            seen_fingerprints.add(fingerprint)

        diagnostics.extend(row_diagnostics)
        if row_diagnostics:
            continue
        assert observed_at is not None and recorded_at is not None and retention_days is not None
        assert confidence is not None and coverage is not None and value is not None
        if materialize_observations:
            definition, unit = METRIC_DEFINITIONS[metric]
            observations.append(
                Observation.model_validate(
                    {
                        "observation_id": raw["observation_id"],
                        "entity_id": raw["target_id"],
                        "entity_name": raw["target_name"],
                        "platform": raw["platform"],
                        "content_id": raw["content_id"] or None,
                        "dimension": raw["content_format"] or None,
                        "metric": metric,
                        "metric_definition_version": definition,
                        "numerator": float(numerator) if numerator is not None else None,
                        "denominator": float(denominator) if denominator is not None else None,
                        "value": float(value),
                        "unit": unit,
                        "published_at": published_at,
                        "observed_at": observed_at,
                        "recorded_at": recorded_at,
                        "valid_from": observed_at,
                        "valid_to": None,
                        "source_url": raw["source_url"],
                        "native_id": raw["native_id"],
                        "connector_version": CSV_CONNECTOR_VERSION,
                        "classification": (
                            "derived" if metric == "engagement_rate" else "observed"
                        ),
                        "confidence": confidence,
                        "artifact_hash": input_sha256,
                        "extraction_pointer": f"csv:record:{record_number}",
                        "freshness_seconds": int((recorded_at - observed_at).total_seconds()),
                        "availability": "available",
                        "coverage": coverage,
                        "acquisition_mode": "user_import",
                        "data_class": "public",
                        "permitted_purpose": "competitive_research",
                        "retention_until": validated_at + timedelta(days=retention_days),
                        "rights_state": "permitted",
                    }
                )
            )
        accepted_rows.append((record_number, raw))
        metric_rows[raw["target_id"]].append((metric, observed_at, float(value)))
        target_row_counts[raw["target_id"]] += 1
        previous_name = target_names.setdefault(raw["target_id"], raw["target_name"])
        if previous_name != raw["target_name"]:
            diagnostics.append(
                _diagnostic("target_name_conflict", record=record_number, column="target_name")
            )
        platforms.add(raw["platform"])
        policy_values.add(
            (
                raw["platform"],
                raw["data_class"],
                raw["permitted_purpose"],
                raw["retention_days"] + ":" + raw["rights_state"],
            )
        )
        if metric in {"content_published", "engagement_rate"}:
            key = (raw["target_id"], raw["content_id"], metric)
            if key in content_metrics:
                diagnostics.append(_diagnostic("duplicate_content_metric", record=record_number))
            else:
                content_metrics[key] = (record_number, raw)

    if not 2 <= len(target_names) <= 5:
        diagnostics.append(_diagnostic("target_count_out_of_range"))
    if len(platforms) != 1:
        diagnostics.append(_diagnostic("platform_count_out_of_range"))
    if len(policy_values) > 1:
        diagnostics.append(_diagnostic("policy_value_conflict"))
    for (target_id, content_id, metric), (record_number, raw) in sorted(content_metrics.items()):
        if metric != "engagement_rate":
            continue
        content = content_metrics.get((target_id, content_id, "content_published"))
        if content is None:
            diagnostics.append(_diagnostic("content_reference_missing", record=record_number))
        elif (
            content[1]["content_format"] != raw["content_format"]
            or content[1]["published_at"] != raw["published_at"]
        ):
            diagnostics.append(_diagnostic("content_reference_mismatch", record=record_number))

    availability: dict[str, dict[str, str]] = {}
    for target_id in sorted(metric_rows):
        rows = metric_rows[target_id]
        follower_groups: defaultdict[datetime, list[float]] = defaultdict(list)
        for metric, observed_at, value in rows:
            if metric == "followers":
                follower_groups[observed_at].append(value)
        conflicts = 0
        unambiguous = 0
        for _timestamp, group in sorted(follower_groups.items()):
            if len(set(group)) > 1:
                conflicts += 1
                diagnostics.append(_diagnostic("observation_value_conflict", severity="warning"))
            else:
                unambiguous += 1
        if not follower_groups:
            follower_state = "missing"
            diagnostics.append(_diagnostic("metric_missing", severity="warning"))
        elif unambiguous < 2 and conflicts:
            follower_state = "contradictory"
            diagnostics.append(_diagnostic("metric_contradictory", severity="warning"))
        elif unambiguous < 2:
            follower_state = "insufficient"
            diagnostics.append(_diagnostic("metric_insufficient", severity="warning"))
        else:
            follower_state = "available"
            if conflicts:
                diagnostics.append(_diagnostic("partial_metric_coverage", severity="warning"))
        engagement_state = (
            "available"
            if any(metric == "engagement_rate" for metric, _time, _value in rows)
            else "missing"
        )
        content_rows = [row for row in rows if row[0] == "content_published"]
        content_state = "available" if content_rows else "missing"
        if engagement_state == "missing":
            diagnostics.append(_diagnostic("metric_missing", severity="warning"))
        if content_state == "missing":
            diagnostics.extend(
                [
                    _diagnostic("metric_missing", severity="warning"),
                    _diagnostic("metric_missing", severity="warning"),
                ]
            )
        elif max(row[1] for row in rows) - min(row[1] for row in rows) < timedelta(days=7):
            diagnostics.append(_diagnostic("short_cadence_window", severity="warning"))
        availability[target_id] = {
            "followers.delta": follower_state,
            "public-engagement-by-followers.median": engagement_state,
            "posting-cadence": content_state,
            "content-format-mix": content_state,
        }

    column_positions = {name: index for index, name in enumerate(CSV_COLUMNS)}
    diagnostics.sort(
        key=lambda item: (
            item.record_number if item.record_number is not None else 0,
            column_positions.get(item.column or "", len(CSV_COLUMNS)),
            0 if item.severity == "error" else 1,
            item.code,
        )
    )
    truncated = len(diagnostics) > MAX_IMPORT_DIAGNOSTICS
    diagnostics = diagnostics[:MAX_IMPORT_DIAGNOSTICS]
    coherent_retention = None
    if accepted_rows and len({raw["retention_days"] for _, raw in accepted_rows}) == 1:
        coherent_retention = int(accepted_rows[0][1]["retention_days"])
    return ImportParseResult(
        sorted(observations, key=lambda row: (row.entity_id, row.observed_at, row.observation_id)),
        diagnostics,
        truncated,
        row_count,
        next(iter(platforms)) if len(platforms) == 1 else None,
        coherent_retention,
        target_names,
        dict(target_row_counts),
        availability,
    )


def parse_all_observations(
    payload: bytes, input_sha256: str, input_schema_id: str, validated_at: datetime | None = None
) -> list[Observation]:
    if input_schema_id == CSV_INPUT_SCHEMA_ID:
        if validated_at is None:
            raise WorkerError(
                "validated_at_invalid", "CSV analysis requires authority validation time."
            )
        result = parse_csv_import(payload, input_sha256=input_sha256, validated_at=validated_at)
        if not result.valid:
            first = next(item for item in result.diagnostics if item.severity == "error")
            raise WorkerError(first.code, first.message)
        return result.observations

    observations: list[Observation] = []
    seen_ids: set[str] = set()
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
            raise WorkerError(
                "invalid_observation",
                "Observation line "
                f"{line_number} failed validation ({_safe_validation_summary(exc)}).",
            ) from exc
        except (json.JSONDecodeError, TypeError) as exc:
            raise WorkerError(
                "invalid_observation", f"Observation line {line_number} is not valid JSON."
            ) from exc
        if observation.observation_id in seen_ids:
            raise WorkerError(
                "duplicate_observation", f"Duplicate observation_id at line {line_number}."
            )
        seen_ids.add(observation.observation_id)
        observations.append(observation)
    return observations


def parse_observations(
    payload: bytes,
    target_ids: list[str],
    input_sha256: str,
    input_schema_id: str,
    validated_at: datetime | None = None,
) -> list[Observation]:
    all_observations = parse_all_observations(payload, input_sha256, input_schema_id, validated_at)
    targets = set(target_ids)
    observations = [row for row in all_observations if row.entity_id in targets]
    discovered = {row.entity_id for row in observations}
    missing = [target for target in target_ids if target not in discovered]
    if missing:
        raise WorkerError("insufficient_evidence", "One or more selected targets have no evidence.")
    if not observations:
        raise WorkerError("insufficient_evidence", "No selected observations were provided.")
    return observations


def normalize_table(observations: list[Observation]) -> pa.Table:
    rows = [
        {name: getattr(observation, name) for name in OBSERVATION_FIELD_NAMES}
        for observation in observations
    ]
    frame = pl.DataFrame(rows, strict=True).select(OBSERVATION_FIELD_NAMES)
    frame = frame.sort(["entity_id", "observed_at", "observation_id"])
    table = frame.to_arrow().cast(OBSERVATION_SCHEMA, safe=True)
    if table.schema != OBSERVATION_SCHEMA:
        raise WorkerError("schema_mismatch", "Normalized Arrow schema does not match v1.")
    return table
