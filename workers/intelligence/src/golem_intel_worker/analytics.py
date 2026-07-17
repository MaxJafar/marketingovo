from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Any

import duckdb
import pyarrow as pa

from .constants import (
    CSV_CONNECTOR_VERSION,
    CSV_INPUT_SCHEMA_ID,
    CSV_PARSER_VERSION,
    METRIC_CATALOG_VERSION,
    MODEL_VERSION,
    PARSER_VERSION,
    WORKER_VERSION,
)
from .errors import WorkerError
from .models import (
    Citation,
    ComparisonReport,
    Derivation,
    ImportComparisonClaim,
    ImportComparisonReport,
    ImportContradiction,
    ImportDatasetProvenance,
    ImportMetricResult,
    ImportTargetResult,
    MetricDefinition,
    MetricPeriod,
    MetricQuality,
    TargetFinding,
    iso_z,
)


def _definition_parts(value: str) -> tuple[str, str]:
    identifier, separator, version = value.rpartition(".")
    if separator and version.startswith("v") and version[1:].isdigit():
        return identifier, version
    return value, "unspecified"


def _citation(row: tuple[Any, ...]) -> Citation:
    return Citation(
        observation_id=row[0],
        entity_id=row[1],
        source_url=row[2],
        native_id=row[3],
        observed_at=iso_z(row[4]),
        connector_version=row[5],
        confidence=float(row[6]),
    )


def _round(value: float) -> float:
    return round(float(value), 10)


def _detect_contradictions(connection: duckdb.DuckDBPyConnection) -> list[str]:
    contradictions: list[str] = []
    for entity_id, names in connection.execute(
        """
        SELECT entity_id, string_agg(DISTINCT entity_name, ' | ' ORDER BY entity_name)
        FROM reported_observations
        GROUP BY entity_id
        HAVING count(DISTINCT entity_name) > 1
        ORDER BY entity_id
        """
    ).fetchall():
        contradictions.append(f"Entity {entity_id} has conflicting observed names: {names}.")

    for entity_id, metric, observed_at, variants in connection.execute(
        """
        SELECT entity_id, metric, observed_at, count(DISTINCT value)
        FROM reported_observations
        GROUP BY entity_id, metric, observed_at
        HAVING count(DISTINCT value) > 1
        ORDER BY entity_id, metric, observed_at
        """
    ).fetchall():
        contradictions.append(
            f"Entity {entity_id} has {variants} conflicting {metric} values at "
            f"{iso_z(observed_at)}."
        )

    for observation_id, numerator, denominator, value in connection.execute(
        """
        SELECT observation_id, numerator, denominator, value
        FROM reported_observations
        WHERE metric = 'engagement_rate'
          AND numerator IS NOT NULL
          AND denominator IS NOT NULL
          AND abs(value - (numerator / denominator)) > greatest(1e-9, abs(value) * 1e-6)
        ORDER BY observation_id
        """
    ).fetchall():
        computed = numerator / denominator
        contradictions.append(
            f"Observation {observation_id} reports engagement {value:.10g}, but its stated "
            f"numerator/denominator yields {computed:.10g}; analytics use the derived rate while "
            "preserving the contradictory source value as evidence."
        )
    return contradictions


def _selected_series(
    connection: duckdb.DuckDBPyConnection, entity_id: str, metric: str
) -> tuple[str, str, int, list[tuple[str, str, int]]]:
    groups = connection.execute(
        """
        SELECT platform, metric_definition_version, count(*) AS observations
        FROM observations
        WHERE entity_id = ? AND metric = ?
        GROUP BY platform, metric_definition_version
        ORDER BY observations DESC, platform, metric_definition_version
        """,
        [entity_id, metric],
    ).fetchall()
    if not groups:
        raise WorkerError(
            "insufficient_evidence", f"Target {entity_id!r} has no {metric} observations."
        )
    platform, definition, count = groups[0]
    return platform, definition, int(count), groups


def _target_finding(
    connection: duckdb.DuckDBPyConnection, entity_id: str
) -> tuple[TargetFinding, str, str, str, str, list[str]]:
    warnings: list[str] = []
    contradictions: list[str] = []
    names = connection.execute(
        """
        SELECT entity_name, count(*) AS observations
        FROM observations WHERE entity_id = ?
        GROUP BY entity_name ORDER BY observations DESC, entity_name
        """,
        [entity_id],
    ).fetchall()
    entity_name = names[0][0]

    follower_platform, follower_definition, follower_count, follower_groups = _selected_series(
        connection, entity_id, "followers"
    )
    if follower_count < 2:
        raise WorkerError(
            "insufficient_evidence",
            f"Target {entity_id!r} needs at least two comparable follower observations.",
        )
    if len(follower_groups) > 1:
        alternatives = ", ".join(
            f"{platform}/{definition} ({count})" for platform, definition, count in follower_groups
        )
        message = (
            f"Target {entity_id} has multiple follower series: {alternatives}. Selected "
            f"{follower_platform}/{follower_definition} by observation count and lexical tie-break."
        )
        warnings.append(message)
        contradictions.append(message)

    follower_rows = connection.execute(
        """
        SELECT observation_id, entity_id, source_url, native_id, observed_at,
               connector_version, confidence, value
        FROM observations
        WHERE entity_id = ? AND metric = 'followers'
          AND platform = ? AND metric_definition_version = ?
        ORDER BY observed_at, observation_id
        """,
        [entity_id, follower_platform, follower_definition],
    ).fetchall()
    if follower_rows[0][4] == follower_rows[-1][4]:
        raise WorkerError(
            "insufficient_evidence",
            f"Target {entity_id!r} needs follower observations at distinct times.",
        )
    follower_delta = float(follower_rows[-1][7] - follower_rows[0][7])
    warnings.append(
        f"Follower change uses only {follower_platform}/{follower_definition}; "
        "other platform or definition series are not combined."
    )
    if follower_delta < 0:
        warnings.append(
            f"Observed public follower count decreased by {abs(follower_delta):g}. "
            "This is follower "
            "change—not customer retention, churn, revenue, or business performance."
        )

    engagement_platform, engagement_definition, engagement_count, engagement_groups = (
        _selected_series(connection, entity_id, "engagement_rate")
    )
    if len(engagement_groups) > 1:
        alternatives = ", ".join(
            f"{platform}/{definition} ({count})"
            for platform, definition, count in engagement_groups
        )
        message = (
            f"Target {entity_id} has multiple engagement denominator series: {alternatives}. "
            f"Selected {engagement_platform}/{engagement_definition}; values were not pooled."
        )
        warnings.append(message)
        contradictions.append(message)

    engagement_rows = connection.execute(
        """
        SELECT observation_id, entity_id, source_url, native_id, observed_at,
               connector_version, confidence, value, content_id, dimension, published_at
        FROM observations
        WHERE entity_id = ? AND metric = 'engagement_rate'
          AND platform = ? AND metric_definition_version = ?
        ORDER BY published_at, observation_id
        """,
        [entity_id, engagement_platform, engagement_definition],
    ).fetchall()
    if not engagement_rows:
        raise WorkerError(
            "insufficient_evidence", f"Target {entity_id!r} has no comparable engagement evidence."
        )
    warnings.append(
        f"Median engagement uses only {engagement_platform}/{engagement_definition}. "
        "Exact numerator and denominator values remain in the cited evidence rows."
    )
    median_engagement = connection.execute(
        """
        SELECT median(value) FROM observations
        WHERE entity_id = ? AND metric = 'engagement_rate'
          AND platform = ? AND metric_definition_version = ?
        """,
        [entity_id, engagement_platform, engagement_definition],
    ).fetchone()[0]

    content_rows = connection.execute(
        """
        SELECT content_id, min(dimension) AS dimension, min(published_at) AS published_at
        FROM observations
        WHERE entity_id = ? AND platform = ? AND content_id IS NOT NULL
          AND published_at IS NOT NULL
        GROUP BY content_id
        ORDER BY content_id
        """,
        [entity_id, engagement_platform],
    ).fetchall()
    if not content_rows:
        raise WorkerError(
            "insufficient_evidence", f"Target {entity_id!r} has no dated content evidence."
        )
    bounds = connection.execute(
        """
        SELECT min(observed_at), max(observed_at)
        FROM observations WHERE entity_id = ? AND platform = ?
        """,
        [entity_id, engagement_platform],
    ).fetchone()
    coverage_seconds = max(0.0, (bounds[1] - bounds[0]).total_seconds())
    coverage_weeks = max(1.0, coverage_seconds / 604_800.0)
    cadence = len(content_rows) / coverage_weeks
    dimensions = Counter((row[1] or "unspecified") for row in content_rows)
    content_mix = {
        dimension: _round(count / len(content_rows))
        for dimension, count in sorted(dimensions.items())
    }

    citation_rows = [follower_rows[0], follower_rows[-1], *engagement_rows]
    citations_by_id = {row[0]: _citation(row[:7]) for row in citation_rows}
    citations = [citations_by_id[key] for key in sorted(citations_by_id)]
    mean_source_confidence = sum(citation.confidence for citation in citations) / len(citations)
    coverage_days = coverage_seconds / 86_400.0
    confidence = (
        0.5 * mean_source_confidence
        + 0.2
        + 0.2 * min(1.0, engagement_count / 4.0)
        + 0.1 * min(1.0, coverage_days / 21.0)
    )

    finding = TargetFinding(
        entity_id=entity_id,
        entity_name=entity_name,
        follower_delta=_round(follower_delta),
        median_engagement_rate=_round(median_engagement),
        posting_cadence_per_week=_round(cadence),
        content_format_mix=content_mix,
        confidence=min(1.0, _round(confidence)),
        warnings=warnings,
        citations=citations,
    )
    return (
        finding,
        follower_platform,
        follower_definition,
        engagement_platform,
        engagement_definition,
        contradictions,
    )


def _metric_definitions(
    follower_definitions: set[str], engagement_definitions: set[str]
) -> list[MetricDefinition]:
    definitions = [
        MetricDefinition(
            id="followers.delta",
            version="v1",
            label="Observed follower change",
            numerator="latest observed follower count minus earliest observed follower count",
            denominator="none",
            period="selected series observation window",
        ),
        MetricDefinition(
            id="posting-cadence",
            version="v1",
            label="Observed posts per week",
            numerator="distinct dated content IDs on the selected platform",
            denominator="observed target coverage in weeks (minimum one week)",
            period="selected target observation window",
        ),
        MetricDefinition(
            id="content-format-mix",
            version="v1",
            label="Observed content-format share",
            numerator="distinct content IDs in the format",
            denominator="all distinct dated content IDs on the selected platform",
            period="selected target observation window",
        ),
    ]
    for definition in sorted(engagement_definitions):
        identifier, version = _definition_parts(definition)
        definitions.append(
            MetricDefinition(
                id=identifier,
                version=version,
                label=f"Median engagement rate ({definition})",
                numerator="source-declared public engagements",
                denominator="source-declared denominator named by the metric definition",
                period="per content observation; median across selected content",
            )
        )
    for definition in sorted(follower_definitions):
        identifier, version = _definition_parts(definition)
        definitions.append(
            MetricDefinition(
                id=identifier,
                version=version,
                label=f"Source follower observation ({definition})",
                numerator="source-reported public follower count",
                denominator="none",
                period="point-in-time observation",
            )
        )
    return definitions


def build_report(
    table: pa.Table,
    run_id: str,
    target_ids: list[str],
    *,
    workflow: str = "compare",
    research_question: str = "",
    source_budget: int = 0,
) -> ComparisonReport:
    connection = duckdb.connect(":memory:")
    excluded_rows = 0
    try:
        connection.register("all_evidence", table)
        connection.execute(
            """
            CREATE TEMP VIEW reported_observations AS
            SELECT * FROM all_evidence
            WHERE availability = 'available'
              AND rights_state = 'permitted'
              AND coverage > 0
              AND classification IN ('observed', 'first_party')
            """
        )
        connection.execute(
            """
            CREATE TEMP VIEW observations AS
            SELECT * EXCLUDE (value),
                   CASE
                     WHEN metric = 'engagement_rate'
                       THEN numerator / denominator
                     ELSE value
                   END AS value
            FROM reported_observations
            """
        )
        eligible_rows = connection.execute("SELECT count(*) FROM observations").fetchone()[0]
        if eligible_rows == 0:
            raise WorkerError(
                "insufficient_evidence",
                "No policy-eligible observed or first-party evidence is available.",
            )
        contradictions = _detect_contradictions(connection)
        excluded_rows = table.num_rows - eligible_rows
        findings: list[TargetFinding] = []
        follower_definitions: set[str] = set()
        engagement_definitions: set[str] = set()
        follower_series: set[tuple[str, str]] = set()
        engagement_series: set[tuple[str, str]] = set()
        for target_id in target_ids:
            (
                finding,
                follower_platform,
                follower_definition,
                engagement_platform,
                engagement_definition,
                target_contradictions,
            ) = _target_finding(connection, target_id)
            findings.append(finding)
            follower_definitions.add(follower_definition)
            engagement_definitions.add(engagement_definition)
            follower_series.add((follower_platform, follower_definition))
            engagement_series.add((engagement_platform, engagement_definition))
            contradictions.extend(target_contradictions)
    finally:
        connection.close()

    if len(follower_series) == 1:
        follower_leader = max(
            findings, key=lambda finding: (finding.follower_delta, finding.entity_id)
        )
        follower_summary = (
            f"{follower_leader.entity_name} had the largest observed follower change "
            f"({follower_leader.follower_delta:+g})."
        )
    else:
        follower_summary = (
            "Follower changes are reported per target but are not ranked because platform or "
            "source metric definitions differ."
        )
        contradictions.append(
            "Targets use different follower platforms or metric definitions; their follower "
            "deltas were not treated as directly comparable."
        )
    if len(engagement_series) == 1:
        engagement_leader = max(
            findings, key=lambda finding: (finding.median_engagement_rate, finding.entity_id)
        )
        engagement_summary = (
            f"{engagement_leader.entity_name} had the highest denominator-specific median "
            f"engagement rate ({engagement_leader.median_engagement_rate:.4f})."
        )
    else:
        engagement_summary = (
            "Engagement medians are reported per target but are not ranked because platforms or "
            "denominator definitions differ."
        )
        contradictions.append(
            "Targets use different engagement platforms or denominator definitions; their rates "
            "were not treated as directly comparable."
        )

    maximum_recorded = max(table.column("recorded_at").to_pylist())
    connector_version = ",".join(sorted(set(table.column("connector_version").to_pylist())))
    evidence_summary = (
        f"Compared {len(findings)} targets across {table.num_rows} validated observations. "
        f"{follower_summary} {engagement_summary} These are descriptive public social metrics, "
        "not customer retention, revenue, or employment-performance measures."
    )
    limitations = [
        (
            "Follower change is an observed platform count difference; it is not customer "
            "retention, churn, revenue, or business performance."
        ),
        (
            "Engagement rates are comparable only within the same platform and exact "
            "metric-definition version."
        ),
        (
            "Missing observations are not interpreted as zero activity, and source-reported "
            "counts may be delayed, rounded, deleted, or revised."
        ),
        (
            "Confidence is a transparent evidence-coverage score, not a calibrated "
            "probability that a claim is true."
        ),
    ]
    if excluded_rows:
        limitations.append(
            f"{excluded_rows} evidence rows were preserved but excluded from metrics by "
            "availability, rights, coverage, or classification policy."
        )
    if workflow == "research":
        title_question = (
            research_question if len(research_question) <= 120 else f"{research_question[:117]}..."
        )
        title = f"Research dossier: {title_question}"
        summary = f"Research question: {research_question} Evidence synthesis: {evidence_summary}"
        plan = [
            (
                "Use the committed fixture connector snapshot as one source; do not perform "
                "unapproved collection or silently expand scope."
            ),
            "Normalize policy-eligible evidence and preserve contradictory source values.",
            "Synthesize denominator-specific findings with observation-level citations.",
        ]
        limitations.append(
            f"This walking-skeleton dossier used 1 of {source_budget} permitted source slots; "
            "it does not imply coverage of sources that were not collected."
        )
        report_question: str | None = research_question
        report_budget: int | None = source_budget
    else:
        title = "Competitive Pulse comparison"
        summary = evidence_summary
        plan = [
            "Use only the committed fixture snapshot for the selected targets.",
            "Normalize policy-eligible observations and preserve source-level contradictions.",
            "Compare only platform- and definition-compatible metric series with citations.",
        ]
        report_question = None
        report_budget = None
    return ComparisonReport(
        run_id=run_id,
        workflow=workflow,
        research_question=report_question,
        source_budget=report_budget,
        research_plan=plan,
        derivation=Derivation(
            worker_version=WORKER_VERSION,
            model_version=MODEL_VERSION,
            connector_version=connector_version,
            parser_version=PARSER_VERSION,
        ),
        generated_at=iso_z(maximum_recorded.astimezone(UTC)),
        title=title,
        summary=summary,
        targets=findings,
        metric_definitions=_metric_definitions(follower_definitions, engagement_definitions),
        contradictions=sorted(set(contradictions)),
        limitations=limitations,
    )


def _metric_quality(rows: list[dict[str, Any]], included: int) -> MetricQuality:
    if not rows:
        return MetricQuality(candidate_count=0, included_count=0, excluded_count=0)
    confidences = [float(row["confidence"]) for row in rows]
    coverage = [float(row["coverage"]) for row in rows]
    return MetricQuality(
        candidate_count=len(rows),
        included_count=included,
        excluded_count=max(0, len(rows) - included),
        min_input_confidence=_round(min(confidences)),
        mean_input_confidence=_round(sum(confidences) / len(confidences)),
        mean_input_coverage=_round(sum(coverage) / len(coverage)),
    )


def _period(rows: list[dict[str, Any]]) -> MetricPeriod | None:
    if not rows:
        return None
    timestamps = [row["observed_at"] for row in rows]
    return MetricPeriod(start=iso_z(min(timestamps)), end=iso_z(max(timestamps)))


def _round_distribution(values: Counter[str]) -> dict[str, float]:
    total = sum(values.values())
    return {key: _round(count / total) for key, count in sorted(values.items())}


def build_import_report(
    table: pa.Table,
    *,
    run_id: str,
    target_ids: list[str],
    dataset_id: str,
    input_sha256: str,
    input_size_bytes: int,
    validated_at: str,
) -> ImportComparisonReport:
    rows = table.to_pylist()
    by_target: dict[str, list[dict[str, Any]]] = {
        target_id: [row for row in rows if row["entity_id"] == target_id]
        for target_id in sorted(target_ids)
    }
    target_results: list[ImportTargetResult] = []
    contradictions: list[ImportContradiction] = []
    evidence_ids: set[str] = set()

    for target_id, target_rows in by_target.items():
        name = sorted({str(row["entity_name"]) for row in target_rows})[0]
        follower_rows = [row for row in target_rows if row["metric"] == "followers"]
        follower_groups: dict[datetime, list[dict[str, Any]]] = defaultdict(list)
        for row in follower_rows:
            follower_groups[row["observed_at"]].append(row)
        unambiguous: list[tuple[datetime, float, list[dict[str, Any]]]] = []
        conflict_rows: list[dict[str, Any]] = []
        for observed_at, group in sorted(follower_groups.items()):
            values = {float(row["value"]) for row in group}
            if len(values) == 1:
                unambiguous.append((observed_at, next(iter(values)), group))
            else:
                group_ids = sorted(str(row["observation_id"]) for row in group)
                conflict_rows.extend(group)
                evidence_ids.update(group_ids)
                contradictions.append(
                    ImportContradiction(
                        code="observation_value_conflict",
                        target_id=target_id,
                        observed_at=iso_z(observed_at),
                        observation_ids=group_ids,
                    )
                )
        follower_limitations = [
            "Observed follower change is not customer retention, churn, revenue, "
            "loyalty, or business performance."
        ]
        if len(unambiguous) >= 2:
            first, last = unambiguous[0], unambiguous[-1]
            follower_value: float | None = _round(last[1] - first[1])
            follower_state = "available"
            follower_evidence = sorted(
                {str(row["observation_id"]) for row in [*first[2], *last[2]]}
            )
            if conflict_rows:
                follower_limitations.append(
                    "Conflicting follower timestamps were retained but excluded from "
                    "the numeric boundary calculation."
                )
        elif follower_rows and conflict_rows:
            follower_value = None
            follower_state = "contradictory"
            follower_evidence = sorted(str(row["observation_id"]) for row in follower_rows)
        elif follower_rows:
            follower_value = None
            follower_state = "insufficient"
            follower_evidence = sorted(str(row["observation_id"]) for row in follower_rows)
        else:
            follower_value = None
            follower_state = "missing"
            follower_evidence = []
        evidence_ids.update(follower_evidence)
        follower_metric = ImportMetricResult(
            id="followers.delta",
            availability=follower_state,
            value=follower_value,
            unit="followers",
            population="Permitted followers.v1 observations grouped by exact observed_at.",
            numerator="Last unambiguous follower count minus first unambiguous follower count.",
            denominator="none",
            period=_period(follower_rows),
            quality=_metric_quality(
                follower_rows,
                sum(len(group) for _time, _value, group in unambiguous),
            ),
            evidence_observation_ids=follower_evidence,
            limitations=follower_limitations,
        )

        engagement_rows = [row for row in target_rows if row["metric"] == "engagement_rate"]
        engagement_ids = sorted(str(row["observation_id"]) for row in engagement_rows)
        evidence_ids.update(engagement_ids)
        rates = sorted(float(row["value"]) for row in engagement_rows)
        if rates:
            middle = len(rates) // 2
            median = rates[middle] if len(rates) % 2 else (rates[middle - 1] + rates[middle]) / 2
            engagement_state = "available"
            engagement_value: float | None = _round(median)
        else:
            engagement_state = "missing"
            engagement_value = None
        engagement_metric = ImportMetricResult(
            id="public-engagement-by-followers.median",
            availability=engagement_state,
            value=engagement_value,
            unit="ratio",
            population="One validated engagement row per distinct content ID.",
            numerator=(
                "Median of per-content public likes-plus-comments divided by paired followers."
            ),
            denominator="Paired positive public follower count for each content observation.",
            period=_period(engagement_rows),
            quality=_metric_quality(engagement_rows, len(engagement_rows)),
            evidence_observation_ids=engagement_ids,
            limitations=[
                "Missing engagement rows are missing evidence and are never interpreted as zero."
            ],
        )

        content_rows = [row for row in target_rows if row["metric"] == "content_published"]
        content_rows.sort(key=lambda row: (str(row["content_id"]), str(row["observation_id"])))
        content_ids = sorted(str(row["observation_id"]) for row in content_rows)
        window_rows: list[dict[str, Any]] = []
        if target_rows:
            first_time = min(row["observed_at"] for row in target_rows)
            last_time = max(row["observed_at"] for row in target_rows)
            window_rows = [
                row for row in target_rows if row["observed_at"] in {first_time, last_time}
            ]
        cadence_ids = sorted(
            {
                *(str(row["observation_id"]) for row in content_rows),
                *(str(row["observation_id"]) for row in window_rows),
            }
        )
        evidence_ids.update(cadence_ids)
        evidence_ids.update(content_ids)
        if content_rows:
            span_seconds = max(
                0.0,
                (
                    max(row["observed_at"] for row in target_rows)
                    - min(row["observed_at"] for row in target_rows)
                ).total_seconds(),
            )
            cadence_value: float | None = _round(
                len(content_rows) / max(1.0, span_seconds / 604_800.0)
            )
            content_state = "available"
            mix_value: dict[str, float] | None = _round_distribution(
                Counter(str(row["dimension"]) for row in content_rows)
            )
            cadence_limitations = (
                ["The observed span is under seven days; cadence uses the fixed one-week minimum."]
                if span_seconds < 604_800
                else []
            )
        else:
            cadence_value = None
            mix_value = None
            content_state = "missing"
            cadence_limitations = [
                "No content observations exist; missing content is not zero activity."
            ]
        cadence_metric = ImportMetricResult(
            id="posting-cadence",
            availability=content_state,
            value=cadence_value,
            unit="posts_per_week",
            population="Distinct validated content_published IDs.",
            numerator="Distinct published content count.",
            denominator="Target observation-coverage window in weeks, with a one-week minimum.",
            period=_period(target_rows),
            quality=_metric_quality(content_rows, len(content_rows)),
            evidence_observation_ids=cadence_ids if content_rows else [],
            limitations=cadence_limitations,
        )
        mix_metric = ImportMetricResult(
            id="content-format-mix",
            availability=content_state,
            value=mix_value,
            unit="distribution",
            population="The distinct content_published rows used for posting cadence.",
            numerator="Content records in each explicit format, including unknown.",
            denominator="All distinct validated content records.",
            period=_period(content_rows),
            quality=_metric_quality(content_rows, len(content_rows)),
            evidence_observation_ids=content_ids,
            limitations=["Unknown formats remain an explicit unknown bucket."],
        )
        target_results.append(
            ImportTargetResult(
                target_id=target_id,
                target_name=name,
                metrics=[follower_metric, engagement_metric, cadence_metric, mix_metric],
            )
        )

    comparisons: list[ImportComparisonClaim] = []
    for metric_id in (
        "followers.delta",
        "public-engagement-by-followers.median",
        "posting-cadence",
    ):
        results = [
            next(metric for metric in target.metrics if metric.id == metric_id)
            for target in target_results
        ]
        if not results or any(metric.availability != "available" for metric in results):
            continue
        numeric = [
            float(metric.value) for metric in results if isinstance(metric.value, int | float)
        ]
        maximum = max(numeric)
        leaders = [
            target
            for target, metric in zip(target_results, results, strict=True)
            if metric.value == maximum
        ]
        if len(leaders) != 1:
            continue
        claim_evidence = sorted(
            {item for metric in results for item in metric.evidence_observation_ids}
        )
        evidence_ids.update(claim_evidence)
        comparisons.append(
            ImportComparisonClaim(
                metric_id=metric_id,
                target_id=leaders[0].target_id,
                compared_target_ids=[target.target_id for target in target_results],
                evidence_observation_ids=claim_evidence,
            )
        )

    rows_by_id = {str(row["observation_id"]): row for row in rows}
    evidence = {
        observation_id: {
            key: (iso_z(value) if isinstance(value, datetime) else value)
            for key, value in rows_by_id[observation_id].items()
        }
        for observation_id in sorted(evidence_ids)
    }
    retention_until = min(row["retention_until"] for row in rows)
    platform = sorted({str(row["platform"]) for row in rows})[0]
    summary = (
        f"Compared {len(target_results)} targets using {len(comparisons)} fully "
        "comparable scalar metric claims."
    )
    return ImportComparisonReport(
        run_id=run_id,
        generated_at=validated_at,
        derivation=Derivation(
            worker_version=WORKER_VERSION,
            model_version=MODEL_VERSION,
            connector_version=CSV_CONNECTOR_VERSION,
            parser_version=CSV_PARSER_VERSION,
        ),
        dataset=ImportDatasetProvenance(
            dataset_id=dataset_id,
            input_sha256=input_sha256,
            input_schema_id=CSV_INPUT_SCHEMA_ID,
            input_size_bytes=input_size_bytes,
            platform=platform,
            validated_at=validated_at,
            retention_until=iso_z(retention_until),
            input_parser_version=CSV_PARSER_VERSION,
            metric_catalog_version=METRIC_CATALOG_VERSION,
        ),
        summary=summary,
        targets=target_results,
        comparisons=comparisons,
        evidence=evidence,
        contradictions=sorted(
            contradictions,
            key=lambda item: (item.target_id, item.observed_at, item.observation_ids),
        ),
        limitations=[
            "Missing evidence is never interpreted as zero.",
            "The report is deterministic descriptive analysis and makes no causal, "
            "revenue, customer-retention, or employment-performance inference.",
            "Source references are inert citations and were not fetched or opened.",
        ],
    )
