from __future__ import annotations

from collections import Counter
from datetime import UTC
from typing import Any

import duckdb
import pyarrow as pa

from .constants import MODEL_VERSION, PARSER_VERSION, WORKER_VERSION
from .errors import WorkerError
from .models import (
    Citation,
    ComparisonReport,
    Derivation,
    MetricDefinition,
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
    connector_version = ",".join(
        sorted(set(table.column("connector_version").to_pylist()))
    )
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
            research_question
            if len(research_question) <= 120
            else f"{research_question[:117]}..."
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
