"""Unit tests for Conviction 2.0 explainability (no DB or network)."""

import pytest

from app.services.conviction_score import (
    CONVICTION_MODEL_VERSION,
    WEIGHTS,
    build_factor_breakdown,
    compute_conviction_score,
    explain_conviction_score,
)

pytestmark = pytest.mark.unit


def _quote(**kw):
    base = {
        "ticker": "TEST", "price": 500, "change_pct": 2.5, "change_pct_1m": 5.0,
        "change_pct_3m": 12.0, "volume": 1_500_000, "avg_volume": 1_000_000,
        "week_52_high": 600, "week_52_low": 400,
    }
    return {**base, **kw}


def _fund(**kw):
    base = {
        "pe_ratio": 18, "pb_ratio": 2.5, "revenue_growth": 22, "roe": 0.20,
        "debt_equity": 0.3, "dividend_yield": 0.02, "beta": 1.0, "free_cash_flow": 200,
    }
    return {**base, **kw}


def test_explain_has_breakdown_for_every_factor():
    out = explain_conviction_score(_quote(), _fund())
    assert out["model_version"] == CONVICTION_MODEL_VERSION
    assert len(out["breakdown"]) == len(WEIGHTS)
    for row in out["breakdown"]:
        assert {
            "key", "label", "input", "weight_pct", "score",
            "contribution_points", "delta_vs_neutral", "signal",
        } <= row.keys()
        assert row["signal"] in ("positive", "neutral", "negative")


def test_contributions_sum_to_score():
    quote, fund = _quote(), _fund()
    breakdown = explain_conviction_score(quote, fund)["breakdown"]
    total = sum(r["contribution_points"] for r in breakdown)
    # Sum of per-factor contributions ≈ the (pre-clamp) score, within rounding.
    assert total == pytest.approx(compute_conviction_score(quote, fund)["score"], abs=0.2)


def test_weight_pcts_sum_to_100():
    breakdown = build_factor_breakdown(
        compute_conviction_score(_quote(), _fund())["factors"], _quote(), _fund()
    )
    assert sum(r["weight_pct"] for r in breakdown) == pytest.approx(100.0, abs=0.5)


def test_breakdown_sorted_by_contribution_desc():
    contribs = [r["contribution_points"] for r in explain_conviction_score(_quote(), _fund())["breakdown"]]
    assert contribs == sorted(contribs, reverse=True)


def test_strong_factor_is_a_driver_weak_is_a_drag():
    out = explain_conviction_score(
        _quote(change_pct_1m=-20, change_pct_3m=-25, volume=100_000, avg_volume=1_000_000),
        _fund(pe_ratio=8, roe=0.32, debt_equity=0.05),
    )
    assert out["drivers"], "expected at least one driver"
    drag_labels = {d["label"].lower() for d in out["drags"]}
    assert drag_labels, "expected at least one drag"
    assert any("momentum" in lbl for lbl in drag_labels)


def test_freshness_reflects_data_presence():
    live = explain_conviction_score(_quote(), _fund())["freshness"]
    assert live["quote"]["status"] == "live"
    assert live["fundamentals"]["status"] == "live"

    dead = explain_conviction_score(_quote(price=0), {"pe_ratio": None, "roe": None})["freshness"]
    assert dead["quote"]["status"] == "unavailable"
    assert dead["fundamentals"]["status"] == "unavailable"


def test_track_record_scaffold_is_honest():
    tr = explain_conviction_score(_quote(), _fund())["track_record"]
    assert tr["available"] is False  # we never fabricate hit-rates
    assert tr["horizons_days"] == [30, 90, 180]
