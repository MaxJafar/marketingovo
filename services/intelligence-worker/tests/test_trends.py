"""The trends module's honesty rules, exercised without any network.

Every test injects a fake transport: the module's job is what it claims from
whatever pytrends returns, and that is testable deterministically. The real
transport is exercised only by an operator running the command themselves.
"""

from __future__ import annotations

import json

from marketingovo_worker.cli import main
from marketingovo_worker.trends import run_trends_research

GENERATED_AT = "2026-08-07T00:00:00+00:00"


class FakeTransport:
    def __init__(
        self,
        rows: dict[str, list[tuple[str, int]]],
        related: dict[str, tuple[list[str], list[str]]] | None = None,
        raises: dict[str, Exception] | None = None,
    ) -> None:
        self.rows = rows
        self.related = related or {}
        self.raises = raises or {}

    def interest_over_time(self, keyword: str, timeframe: str, geo: str):
        if keyword in self.raises:
            raise self.raises[keyword]
        return self.rows.get(keyword, [])

    def related_queries(self, keyword: str, timeframe: str, geo: str):
        return self.related.get(keyword, ([], []))


def weekly(values: list[int]) -> list[tuple[str, int]]:
    return [
        (f"2026-{4 + index // 4:02d}-{1 + (index % 4) * 7:02d}", value)
        for index, value in enumerate(values)
    ]


def test_growing_interest_is_analyzed_with_the_shared_vocabulary() -> None:
    transport = FakeTransport(
        rows={"pixel art": weekly([10, 12, 11, 14, 30, 34, 38, 44])},
        related={"pixel art": (["pixel art editor"], ["pixel art ai"])},
    )
    research = run_trends_research(
        ["pixel art"],
        generated_at=GENERATED_AT,
        transport_factory=lambda: transport,
    )
    [trend] = research.keywords
    assert trend.state == "available"
    assert trend.verdict == "growing"
    assert trend.momentum is not None and trend.momentum > 0.2
    assert trend.average is not None and trend.average > 0
    assert trend.related_top == ["pixel art editor"]
    assert trend.related_rising == ["pixel art ai"]
    assert research.schema_version == "marketingovo.trends-research.v1"
    assert "not an official API" in research.policy


def test_no_readings_is_no_data_with_a_reason_never_zeros() -> None:
    research = run_trends_research(
        ["obscure term"],
        generated_at=GENERATED_AT,
        transport_factory=lambda: FakeTransport(rows={}),
    )
    [trend] = research.keywords
    assert trend.state == "no-data"
    assert "absence, not a zero" in trend.reason
    assert trend.average is None
    assert trend.verdict is None


def test_all_sparse_fill_is_below_threshold_not_zero_interest() -> None:
    research = run_trends_research(
        ["tiny niche"],
        generated_at=GENERATED_AT,
        transport_factory=lambda: FakeTransport(rows={"tiny niche": weekly([0, 0, 0, 0])}),
    )
    [trend] = research.keywords
    assert trend.state == "no-data"
    assert "reporting threshold" in trend.reason


def test_a_throttled_request_degrades_per_keyword() -> None:
    transport = FakeTransport(
        rows={"healthy": weekly([20, 22, 24, 26])},
        raises={"blocked": RuntimeError("429 from Google")},
    )
    research = run_trends_research(
        ["healthy", "blocked"],
        generated_at=GENERATED_AT,
        transport_factory=lambda: transport,
    )
    by_keyword = {trend.keyword: trend for trend in research.keywords}
    assert by_keyword["healthy"].state == "available"
    assert by_keyword["blocked"].state == "unavailable"
    assert "429" in by_keyword["blocked"].reason


def test_a_missing_pytrends_install_is_a_stated_reason() -> None:
    def unavailable() -> FakeTransport:
        raise ModuleNotFoundError("No module named 'pytrends'")

    research = run_trends_research(
        ["anything"],
        generated_at=GENERATED_AT,
        transport_factory=unavailable,
    )
    [trend] = research.keywords
    assert trend.state == "unavailable"
    assert "pytrends is not usable here" in trend.reason
    assert research.source == "pytrends (unavailable)"


def test_keyword_budget_is_enforced() -> None:
    try:
        run_trends_research(
            ["a", "b", "c", "d", "e", "f"],
            generated_at=GENERATED_AT,
            transport_factory=lambda: FakeTransport(rows={}),
        )
    except ValueError as exc:
        assert "at most 5" in str(exc)
    else:
        raise AssertionError("six keywords should be refused")


def test_cli_emits_canonical_json_and_exits_zero(capsysbinary, monkeypatch) -> None:
    # The CLI reaches for the real pytrends transport. Tests never open the
    # network, so the transport is forced to refuse — and the refusal must
    # surface as stated reasons in valid JSON with exit 0, because on an
    # offline machine the reasons are the honest answer.
    from marketingovo_worker import trends as trends_module

    def refuse(self: object) -> None:
        raise RuntimeError("tests do not open the network")

    monkeypatch.setattr(trends_module.PytrendsTransport, "__init__", refuse)
    exit_code = main(["trends", "--keyword", "pixel art"])
    captured = capsysbinary.readouterr()
    payload = json.loads(captured.out)
    assert exit_code == 0
    assert payload["schema_version"] == "marketingovo.trends-research.v1"
    assert payload["keywords"][0]["keyword"] == "pixel art"
    assert payload["keywords"][0]["state"] == "unavailable"
    assert "tests do not open the network" in payload["keywords"][0]["reason"]
