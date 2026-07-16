from __future__ import annotations

import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qsl, urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .constants import MODEL_VERSION, REPORT_SCHEMA_ID, WORKER_VERSION


def iso_z(value: datetime) -> str:
    normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="microseconds").replace("+00:00", "Z")


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observation_id: str = Field(min_length=1, max_length=500)
    entity_id: str = Field(min_length=1, max_length=500)
    entity_name: str = Field(min_length=1, max_length=1000)
    platform: str = Field(min_length=1, max_length=200)
    content_id: str | None = Field(default=None, max_length=1000)
    dimension: str | None = Field(default=None, max_length=200)
    metric: str = Field(min_length=1, max_length=200)
    metric_definition_version: str = Field(min_length=1, max_length=300)
    numerator: float | None
    denominator: float | None
    value: float
    unit: str = Field(min_length=1, max_length=100)
    published_at: datetime | None
    observed_at: datetime
    recorded_at: datetime
    valid_from: datetime
    valid_to: datetime | None = None
    source_url: str = Field(min_length=1, max_length=4096)
    native_id: str = Field(min_length=1, max_length=1000)
    connector_version: str = Field(min_length=1, max_length=500)
    classification: Literal["observed", "derived", "estimated", "first_party"]
    confidence: float = Field(ge=0.0, le=1.0)
    artifact_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    extraction_pointer: str = Field(min_length=1, max_length=1000)
    freshness_seconds: int = Field(ge=0)
    availability: Literal["available", "unavailable", "stale", "failed"]
    coverage: float = Field(ge=0.0, le=1.0)
    acquisition_mode: Literal[
        "public_web",
        "official_api",
        "authorized_account",
        "licensed_provider",
        "user_import",
        "fixture",
    ]
    data_class: Literal["public", "first_party", "licensed_business_contact", "restricted"]
    permitted_purpose: str = Field(min_length=1, max_length=500)
    retention_until: datetime
    rights_state: Literal[
        "permitted", "pending_review", "restricted", "suppressed", "expired", "revoked"
    ]

    @field_validator(
        "observation_id",
        "entity_id",
        "entity_name",
        "platform",
        "metric",
        "metric_definition_version",
        "unit",
        "native_id",
        "connector_version",
        "artifact_hash",
        "extraction_pointer",
        "availability",
        "acquisition_mode",
        "permitted_purpose",
        "rights_state",
    )
    @classmethod
    def no_surrounding_whitespace(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("must not contain surrounding whitespace")
        return value

    @field_validator("source_url")
    @classmethod
    def valid_source_reference(cls, value: str) -> str:
        if value != value.strip() or any(ord(character) < 32 for character in value):
            raise ValueError("must be a clean URI reference")
        parsed = urlsplit(value)
        if parsed.scheme and parsed.scheme.lower() not in {"http", "https", "file", "urn"}:
            raise ValueError("uses an unsupported URI scheme")
        if parsed.username or parsed.password:
            raise ValueError("must not embed credentials")
        sensitive_query_names = {
            "access_token",
            "api_key",
            "apikey",
            "auth",
            "authorization",
            "key",
            "secret",
            "sig",
            "signature",
            "token",
        }
        if any(
            name.casefold() in sensitive_query_names
            for name, _value in parse_qsl(parsed.query, keep_blank_values=True)
        ):
            raise ValueError("must not contain credential-bearing query parameters")
        return value

    @field_validator("numerator", "denominator", "value", "confidence", "coverage")
    @classmethod
    def finite_number(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("must be finite")
        return value

    @field_validator("numerator", "denominator", "value", "confidence", "coverage", mode="before")
    @classmethod
    def numeric_json_types_only(cls, value: object) -> object:
        if isinstance(value, str | bool):
            raise ValueError("must be a JSON number")
        return value

    @field_validator("freshness_seconds", mode="before")
    @classmethod
    def integer_json_type_only(cls, value: object) -> object:
        if isinstance(value, str | bool | float):
            raise ValueError("must be a JSON integer")
        return value

    @field_validator(
        "published_at",
        "observed_at",
        "recorded_at",
        "valid_from",
        "valid_to",
        "retention_until",
    )
    @classmethod
    def timezone_required(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("must include a timezone")
        return value.astimezone(UTC) if value is not None else None

    @model_validator(mode="after")
    def evidence_invariants(self) -> Observation:
        if self.recorded_at < self.observed_at:
            raise ValueError("recorded_at must not precede observed_at")
        if self.valid_to is not None and self.valid_to < self.valid_from:
            raise ValueError("valid_to must not precede valid_from")
        if self.retention_until < self.recorded_at:
            raise ValueError("retention_until must not precede recorded_at")
        if self.metric == "followers" and self.value < 0:
            raise ValueError("follower count must not be negative")
        if self.metric == "engagement_rate":
            if self.numerator is None or self.denominator is None:
                raise ValueError("engagement_rate requires numerator and denominator")
            if self.numerator < 0 or self.denominator <= 0:
                raise ValueError(
                    "engagement numerator must be non-negative and denominator positive"
                )
            if self.content_id is None or self.published_at is None:
                raise ValueError("engagement_rate requires content_id and published_at")
        return self


class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observation_id: str
    entity_id: str
    source_url: str
    native_id: str
    observed_at: str
    connector_version: str
    confidence: float = Field(ge=0, le=1)


class MetricDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    version: str
    label: str
    numerator: str
    denominator: str
    period: str


class TargetFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entity_id: str
    entity_name: str
    follower_delta: float
    median_engagement_rate: float
    posting_cadence_per_week: float
    content_format_mix: dict[str, float]
    confidence: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(min_length=1)


class Derivation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_version: str = Field(min_length=1)
    model_version: str = Field(min_length=1)
    connector_version: str = Field(min_length=1)
    parser_version: str = Field(min_length=1)


class ComparisonReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["golem.comparison-report.v1"] = REPORT_SCHEMA_ID
    run_id: str
    workflow: Literal["compare", "research"]
    research_question: str | None = None
    source_budget: int | None = Field(default=None, ge=1, le=100)
    research_plan: list[str] = Field(default_factory=list)
    derivation: Derivation
    generated_at: str
    title: str
    summary: str
    targets: list[TargetFinding] = Field(min_length=1)
    metric_definitions: list[MetricDefinition]
    contradictions: list[str]
    limitations: list[str]

    @model_validator(mode="after")
    def workflow_fields_are_coherent(self) -> ComparisonReport:
        if self.workflow == "compare":
            if self.research_question is not None or self.source_budget is not None:
                raise ValueError("comparison reports must not contain research parameters")
        elif self.research_question is None or self.source_budget is None:
            raise ValueError("research reports require a question and source budget")
        return self


class ArtifactDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relative_path: str
    media_type: str
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    size_bytes: int = Field(ge=0)
    row_count: int = Field(ge=0)
    schema_id: str
    minimum_observed_at: str | None = None
    maximum_observed_at: str | None = None
    data_class: Literal["public", "first_party", "licensed_business_contact", "restricted"]

    @field_validator("relative_path")
    @classmethod
    def relative_artifact_path(cls, value: str) -> str:
        path = Path(value)
        if path.is_absolute() or ".." in path.parts or value.startswith("/"):
            raise ValueError("artifact path must be relative and contained")
        return value


class AnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    succeeded: bool
    error_code: str = ""
    error_message: str = ""
    artifacts: list[ArtifactDescriptor] = Field(default_factory=list)
    report_relative_path: str = ""
    report_sha256: str = ""
    model_version: str = MODEL_VERSION
    worker_version: str = WORKER_VERSION


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    run_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$")
    project_id: str = Field(default="local", min_length=1, max_length=100)
    workspace_path: Path
    input_path: Path
    input_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    output_directory: Path
    target_ids: list[str] = Field(min_length=1, max_length=50)
    workflow: Literal["compare", "research"] = "compare"
    research_question: str = Field(default="", max_length=2000)
    source_budget: int = Field(default=0, ge=0, le=100)
    simulate: Literal["none", "source_failure", "corrupt_artifact", "slow"] = "none"

    @field_validator("target_ids")
    @classmethod
    def unique_bounded_targets(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("target IDs must be unique")
        if any(not value or value != value.strip() or len(value) > 100 for value in values):
            raise ValueError("target IDs must be non-empty, trimmed, and at most 100 characters")
        return values

    @field_validator("research_question")
    @classmethod
    def clean_research_question(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("research question must not contain surrounding whitespace")
        return value

    @model_validator(mode="after")
    def workflow_parameters_are_coherent(self) -> AnalysisRequest:
        if self.workflow == "compare":
            if self.research_question or self.source_budget != 0:
                raise ValueError("compare workflow cannot include research parameters")
        elif len(self.research_question) < 3 or not 1 <= self.source_budget <= 100:
            raise ValueError(
                "research workflow requires a 3-2000 character question and source budget 1-100"
            )
        return self
