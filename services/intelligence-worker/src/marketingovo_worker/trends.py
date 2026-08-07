"""Google Trends research over pytrends.

This is the one network-enabled adapter in this package, and it runs only
when the operator invokes ``marketingovo-worker trends`` themselves. The
``protocol`` and ``analyze`` paths keep their charter — no network, no
credentials — and this module is deliberately not reachable from either.

pytrends wraps the public Google Trends UI endpoints, which are not an
official API. That is the same ToS-grey ground the product's TypeScript
trends integration stands on, and it is stated here rather than hidden.
No credential is involved; nothing personal is collected; the only egress
is to Google Trends for the exact keywords the operator supplied.

The output discipline matches the rest of the product: a keyword Google
returned nothing for is ``no-data`` with its reason, never a row of zeros
presented as measurement, and a transport failure is ``unavailable`` with
the error text — the caller can always tell silence from a measured zero.

The momentum/slope/verdict vocabulary deliberately mirrors
``packages/core/src/integrations/trends.ts`` (halves comparison, slope per
month, the same thresholds), so a marketer reading both surfaces reads one
language.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Literal, Protocol

from pydantic import BaseModel, Field

TRENDS_SCHEMA_VERSION = "marketingovo.trends-research.v1"
TRENDS_POLICY = (
    "pytrends reads the public Google Trends UI endpoints, which are not an "
    "official API. Figures are Google's 0-100 relative interest, not search "
    "volumes, and a blocked or throttled request is reported as unavailable "
    "rather than as a zero."
)

MAX_KEYWORDS = 5


class TrendsPoint(BaseModel):
    """One interest reading: an ISO date and Google's 0-100 relative value."""

    date: str
    value: int = Field(ge=0, le=100)


class KeywordTrend(BaseModel):
    keyword: str
    state: Literal["available", "no-data", "unavailable"]
    """Stated whenever the state is not ``available``. Empty when it is."""
    reason: str = ""
    points: list[TrendsPoint] = Field(default_factory=list)
    average: float | None = None
    momentum: float | None = None
    slope_per_month: float | None = None
    verdict: Literal["growing", "steady", "declining"] | None = None
    related_top: list[str] = Field(default_factory=list)
    related_rising: list[str] = Field(default_factory=list)


class TrendsResearch(BaseModel):
    schema_version: Literal["marketingovo.trends-research.v1"] = TRENDS_SCHEMA_VERSION
    generated_at: str
    timeframe: str
    geo: str
    source: str
    policy: str = TRENDS_POLICY
    keywords: list[KeywordTrend]


class TrendsTransport(Protocol):
    """The slice of pytrends this module uses, injectable for tests."""

    def interest_over_time(
        self, keyword: str, timeframe: str, geo: str
    ) -> Sequence[tuple[str, int]]:
        """(ISO date, 0-100 value) rows, sparse fill rows already dropped."""
        ...

    def related_queries(
        self, keyword: str, timeframe: str, geo: str
    ) -> tuple[Sequence[str], Sequence[str]]:
        """(top, rising) related query strings, best-effort."""
        ...


class PytrendsTransport:
    """The real transport. Imports pytrends lazily so its absence is a
    stated reason in the output rather than a crash at startup."""

    def __init__(self) -> None:
        # Deliberately lazy: pytrends' absence must become a stated reason.
        from pytrends.request import TrendReq

        self._client = TrendReq(hl="en-US", tz=0)

    def interest_over_time(
        self, keyword: str, timeframe: str, geo: str
    ) -> Sequence[tuple[str, int]]:
        self._client.build_payload([keyword], timeframe=timeframe, geo=geo)
        frame = self._client.interest_over_time()
        if frame is None or frame.empty or keyword not in frame:
            return []
        rows: list[tuple[str, int]] = []
        partial = frame["isPartial"] if "isPartial" in frame else None
        for index, value in frame[keyword].items():
            # The still-filling current bucket is dropped for the same reason
            # reports end yesterday: Google restates it.
            if partial is not None and bool(partial.loc[index]):
                continue
            rows.append((index.date().isoformat(), int(value)))
        return rows

    def related_queries(
        self, keyword: str, timeframe: str, geo: str
    ) -> tuple[Sequence[str], Sequence[str]]:
        self._client.build_payload([keyword], timeframe=timeframe, geo=geo)
        related = self._client.related_queries() or {}
        entry = related.get(keyword) or {}

        def column(name: str) -> list[str]:
            frame = entry.get(name)
            if frame is None or getattr(frame, "empty", True):
                return []
            return [str(query) for query in frame["query"].head(10)]

        return column("top"), column("rising")


def _linear_slope(points: Sequence[TrendsPoint]) -> float:
    """Least-squares slope in value per point index; callers scale to months."""
    n = len(points)
    if n < 2:
        return 0.0
    xs = list(range(n))
    ys = [point.value for point in points]
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys, strict=True))
    denominator = sum((x - x_mean) ** 2 for x in xs)
    return numerator / denominator if denominator > 0 else 0.0


def _analyze(keyword: str, rows: Sequence[tuple[str, int]]) -> KeywordTrend:
    if len(rows) == 0:
        return KeywordTrend(
            keyword=keyword,
            state="no-data",
            reason=(
                "Google Trends returned no interest readings for this keyword "
                "in the requested window. That is an absence, not a zero."
            ),
        )
    points = [TrendsPoint(date=date, value=value) for date, value in rows]
    measured = [point for point in points if point.value > 0]
    if len(measured) == 0:
        return KeywordTrend(
            keyword=keyword,
            state="no-data",
            reason=(
                "Every reading in the window was Google's sparse-region fill. "
                "Interest below Google's reporting threshold is not measurable "
                "from this endpoint."
            ),
            points=points,
        )

    average = sum(point.value for point in measured) / len(measured)
    half = len(measured) // 2
    prior = measured[:half]
    recent = measured[half:]
    prior_avg = sum(p.value for p in prior) / len(prior) if prior else 0.0
    recent_avg = sum(p.value for p in recent) / len(recent) if recent else 0.0
    momentum = (recent_avg - prior_avg) / prior_avg if prior_avg > 0 else 0.0
    # Weekly buckets are the norm for the default timeframe, so one point is
    # roughly one week; scale the per-point slope to a per-month figure the
    # way the TypeScript integration scales per-day to 30 days.
    slope_per_month = _linear_slope(measured) * 4.33

    verdict: Literal["growing", "steady", "declining"] = "steady"
    if momentum > 0.2 or slope_per_month > 1:
        verdict = "growing"
    elif momentum < -0.2 or slope_per_month < -1:
        verdict = "declining"

    return KeywordTrend(
        keyword=keyword,
        state="available",
        points=points,
        average=round(average, 2),
        momentum=round(momentum, 4),
        slope_per_month=round(slope_per_month, 3),
        verdict=verdict,
    )


def run_trends_research(
    keywords: Sequence[str],
    *,
    timeframe: str = "today 12-m",
    geo: str = "",
    generated_at: str,
    transport_factory: Callable[[], TrendsTransport] | None = None,
) -> TrendsResearch:
    """Research up to five keywords, degrading per keyword with a reason."""
    cleaned = [keyword.strip() for keyword in keywords if keyword.strip()]
    if len(cleaned) == 0:
        raise ValueError("trends research needs at least one keyword")
    if len(cleaned) > MAX_KEYWORDS:
        raise ValueError(f"trends research accepts at most {MAX_KEYWORDS} keywords")

    transport: TrendsTransport | None = None
    transport_error = ""
    try:
        transport = (transport_factory or PytrendsTransport)()
        source = "pytrends"
    except Exception as exc:  # absence must become a stated reason
        transport_error = f"pytrends is not usable here: {exc}"
        source = "pytrends (unavailable)"

    results: list[KeywordTrend] = []
    for keyword in cleaned:
        if transport is None:
            results.append(
                KeywordTrend(keyword=keyword, state="unavailable", reason=transport_error)
            )
            continue
        try:
            rows = transport.interest_over_time(keyword, timeframe, geo)
        except Exception as exc:  # a throttle is a reason, not a crash
            results.append(
                KeywordTrend(
                    keyword=keyword,
                    state="unavailable",
                    reason=f"Google Trends request failed: {exc}",
                )
            )
            continue
        analyzed = _analyze(keyword, rows)
        if analyzed.state == "available":
            try:
                top, rising = transport.related_queries(keyword, timeframe, geo)
                analyzed.related_top = list(top)
                analyzed.related_rising = list(rising)
            except Exception:  # related queries are best-effort
                analyzed.related_top = []
                analyzed.related_rising = []
        results.append(analyzed)

    return TrendsResearch(
        generated_at=generated_at,
        timeframe=timeframe,
        geo=geo,
        source=source,
        keywords=results,
    )
