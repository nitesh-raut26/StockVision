"""AI conviction score engine (1–10 scale) for Indian stocks."""

import asyncio
from typing import Any
# Market-data reads go through the provider seam (app/services/market_data).
from app.services.market_data import get_market_data_provider

_md = get_market_data_provider()
get_quote = _md.get_quote
get_fundamentals = _md.get_fundamentals


# Weight map for each factor (totals ~40 weighted inputs → normalized to 10)
WEIGHTS = {
    "pe_attractiveness": 0.12,
    "pb_attractiveness": 0.08,
    "revenue_growth": 0.12,
    "roe": 0.10,
    "debt_equity": 0.10,
    "dividend_yield": 0.05,
    "price_momentum_1m": 0.08,
    "price_momentum_3m": 0.08,
    "volume_signal": 0.06,
    "beta_risk": 0.06,
    "week_52_position": 0.08,
    "free_cash_flow": 0.07,
}


def _score_pe(pe: float | None) -> float:
    if pe is None or pe <= 0:
        return 0.4
    if pe < 10:
        return 1.0
    if pe < 15:
        return 0.9
    if pe < 20:
        return 0.8
    if pe < 30:
        return 0.65
    if pe < 50:
        return 0.4
    return 0.2


def _score_pb(pb: float | None) -> float:
    if pb is None or pb <= 0:
        return 0.4
    if pb < 1:
        return 1.0
    if pb < 2:
        return 0.85
    if pb < 4:
        return 0.65
    if pb < 8:
        return 0.4
    return 0.2


def _score_revenue_growth(g: float | None) -> float:
    if g is None:
        return 0.4
    if g > 30:
        return 1.0
    if g > 20:
        return 0.85
    if g > 10:
        return 0.7
    if g > 0:
        return 0.55
    return 0.2


def _score_roe(roe: float | None) -> float:
    if roe is None:
        return 0.4
    roe_pct = roe * 100
    if roe_pct > 25:
        return 1.0
    if roe_pct > 18:
        return 0.85
    if roe_pct > 12:
        return 0.7
    if roe_pct > 5:
        return 0.5
    return 0.2


def _score_debt_equity(de: float | None) -> float:
    if de is None:
        return 0.5
    if de < 0.3:
        return 1.0
    if de < 0.7:
        return 0.85
    if de < 1.5:
        return 0.65
    if de < 3.0:
        return 0.4
    return 0.2


def _score_dividend(dy: float | None) -> float:
    if dy is None or dy <= 0:
        return 0.4
    if dy > 0.04:
        return 1.0
    if dy > 0.02:
        return 0.75
    return 0.55


def _score_momentum(change_pct: float) -> float:
    """Score price momentum. Works for any period (1m, 3m) — caller provides correct value."""
    if change_pct > 15:
        return 0.9
    if change_pct > 8:
        return 0.75
    if change_pct > 2:
        return 0.65
    if change_pct > 0:
        return 0.55
    if change_pct > -5:
        return 0.4
    if change_pct > -15:
        return 0.3
    return 0.2


def _score_52w_position(price: float, low: float | None, high: float | None) -> float:
    if low is None or high is None or high == low:
        return 0.5
    pos = (price - low) / (high - low)
    # Sweet spot: 40-70% of 52w range
    if 0.4 <= pos <= 0.7:
        return 0.9
    if 0.2 <= pos < 0.4:
        return 0.75
    if 0.7 < pos <= 0.85:
        return 0.7
    if pos < 0.2:
        return 0.5  # near 52w low — risk
    return 0.4  # near 52w high


def _score_beta(beta: float | None) -> float:
    if beta is None:
        return 0.5
    if 0.7 <= beta <= 1.2:
        return 0.85
    if 0.4 <= beta < 0.7:
        return 0.7
    if 1.2 < beta <= 1.6:
        return 0.6
    return 0.4


def _score_volume(volume: float | None, avg_volume: float | None) -> float:
    """Score volume relative to the stock's own average — avoids large-cap bias."""
    if volume is None or volume <= 0:
        return 0.4
    if avg_volume and avg_volume > 0:
        ratio = volume / avg_volume
        if ratio > 3.0:
            return 0.9   # breakout volume
        if ratio > 1.5:
            return 0.75
        if ratio > 0.8:
            return 0.6
        return 0.35      # below-average volume — weak conviction
    # Fallback: absolute threshold for stocks without avg_volume data
    if volume > 2_000_000:
        return 0.75
    if volume > 500_000:
        return 0.6
    return 0.4


def _score_fcf(fcf: float | None) -> float:
    if fcf is None:
        return 0.4
    if fcf > 0:
        return 0.85
    return 0.2


def compute_conviction_score(quote: dict, fundamentals: dict) -> dict[str, Any]:
    """Compute a weighted conviction score from quote and fundamental data."""
    factor_scores = {
        "pe_attractiveness": _score_pe(fundamentals.get("pe_ratio")),
        "pb_attractiveness": _score_pb(fundamentals.get("pb_ratio")),
        "revenue_growth": _score_revenue_growth(fundamentals.get("revenue_growth")),
        "roe": _score_roe(fundamentals.get("roe")),
        "debt_equity": _score_debt_equity(fundamentals.get("debt_equity")),
        "dividend_yield": _score_dividend(fundamentals.get("dividend_yield")),
        "price_momentum_1m": _score_momentum(quote.get("change_pct_1m") or quote.get("change_pct", 0)),
        "price_momentum_3m": _score_momentum(quote.get("change_pct_3m") or quote.get("change_pct", 0)),
        "volume_signal": _score_volume(quote.get("volume"), quote.get("avg_volume")),
        "beta_risk": _score_beta(fundamentals.get("beta")),
        "week_52_position": _score_52w_position(
            quote.get("price", 0),
            quote.get("week_52_low"),
            quote.get("week_52_high"),
        ),
        "free_cash_flow": _score_fcf(fundamentals.get("free_cash_flow")),
    }

    raw = sum(WEIGHTS[k] * v for k, v in factor_scores.items())
    total_weight = sum(WEIGHTS.values())
    score = round((raw / total_weight) * 10, 1)
    score = max(1.0, min(10.0, score))

    # Determine risk label
    if score >= 7.5:
        risk = "Low"
    elif score >= 5.0:
        risk = "Medium"
    else:
        risk = "High"

    return {
        "ticker": quote.get("ticker", ""),
        "score": score,
        "risk": risk,
        "factors": factor_scores,
        "rationale": _build_rationale(factor_scores, fundamentals, score),
    }


def _build_rationale(factors: dict, fundamentals: dict, score: float) -> str:
    parts = []
    if factors["pe_attractiveness"] >= 0.8:
        parts.append(f"attractive valuation (P/E {fundamentals.get('pe_ratio', 'N/A')})")
    if factors["revenue_growth"] >= 0.8:
        parts.append(f"strong revenue growth ({fundamentals.get('revenue_growth', 0):.1f}%)")
    if factors["roe"] >= 0.8:
        roe_pct = (fundamentals.get("roe") or 0) * 100
        parts.append(f"high ROE ({roe_pct:.1f}%)")
    if factors["debt_equity"] >= 0.85:
        parts.append("debt-free balance sheet")
    if factors["free_cash_flow"] >= 0.8:
        parts.append("positive free cash flow")
    if not parts:
        parts.append("mixed fundamentals with moderate risk profile")

    return f"Score {score}/10 — " + ", ".join(parts) + "."


# ── Conviction 2.0: explainability ───────────────────────────────────────────
CONVICTION_MODEL_VERSION = "2.0-explainable"

FACTOR_LABELS = {
    "pe_attractiveness": "P/E valuation",
    "pb_attractiveness": "P/B valuation",
    "revenue_growth": "Revenue growth",
    "roe": "Return on equity",
    "debt_equity": "Debt / equity",
    "dividend_yield": "Dividend yield",
    "price_momentum_1m": "1-month momentum",
    "price_momentum_3m": "3-month momentum",
    "volume_signal": "Volume signal",
    "beta_risk": "Beta (volatility)",
    "week_52_position": "52-week position",
    "free_cash_flow": "Free cash flow",
}

_NEUTRAL = 0.5  # a factor score of 0.5 neither helps nor hurts conviction


def _factor_signal(score: float) -> str:
    if score >= 0.65:
        return "positive"
    if score <= 0.45:
        return "negative"
    return "neutral"


def _input_display(key: str, quote: dict, fundamentals: dict) -> str | None:
    """Human-readable input value behind each factor (for 'show your work')."""
    f, q = fundamentals, quote

    def fmt(value, suffix="", scale=1.0, dp=1):
        return None if value is None else f"{value * scale:.{dp}f}{suffix}"

    if key == "pe_attractiveness":
        return fmt(f.get("pe_ratio"), "x")
    if key == "pb_attractiveness":
        return fmt(f.get("pb_ratio"), "x")
    if key == "revenue_growth":
        return fmt(f.get("revenue_growth"), "%")
    if key == "roe":
        return fmt(f.get("roe"), "%", 100)
    if key == "debt_equity":
        return fmt(f.get("debt_equity"), "")
    if key == "dividend_yield":
        return fmt(f.get("dividend_yield"), "%", 100)
    if key == "price_momentum_1m":
        v = q.get("change_pct_1m")
        return fmt(v if v is not None else q.get("change_pct"), "%")
    if key == "price_momentum_3m":
        v = q.get("change_pct_3m")
        return fmt(v if v is not None else q.get("change_pct"), "%")
    if key == "volume_signal":
        vol, avg = q.get("volume"), q.get("avg_volume")
        if vol and avg:
            return f"{vol / avg:.1f}x avg"
        return fmt(vol, "", 1, 0)
    if key == "beta_risk":
        return fmt(f.get("beta"), "")
    if key == "week_52_position":
        p, lo, hi = q.get("price"), q.get("week_52_low"), q.get("week_52_high")
        if p and lo is not None and hi and hi != lo:
            return f"{(p - lo) / (hi - lo) * 100:.0f}% of 52w range"
        return None
    if key == "free_cash_flow":
        v = f.get("free_cash_flow")
        return None if v is None else ("positive" if v > 0 else "negative")
    return None


def build_factor_breakdown(factor_scores: dict, quote: dict, fundamentals: dict) -> list[dict]:
    """Per-factor attribution: how many of the 10 points each factor contributes,
    and how far above/below a neutral baseline it pushes the score."""
    total_weight = sum(WEIGHTS.values()) or 1.0
    rows = []
    for key, score in factor_scores.items():
        weight = WEIGHTS[key]
        rows.append({
            "key": key,
            "label": FACTOR_LABELS.get(key, key),
            "input": _input_display(key, quote, fundamentals),
            "weight_pct": round(weight / total_weight * 100, 1),
            "score": round(score, 2),
            "contribution_points": round(weight * score / total_weight * 10, 2),
            "delta_vs_neutral": round(weight * (score - _NEUTRAL) / total_weight * 10, 2),
            "signal": _factor_signal(score),
        })
    rows.sort(key=lambda r: r["contribution_points"], reverse=True)
    return rows


def _data_freshness(quote: dict, fundamentals: dict) -> dict:
    from datetime import datetime, timezone
    has_quote = bool(quote.get("price"))
    has_fund = fundamentals.get("pe_ratio") is not None or fundamentals.get("roe") is not None
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "quote": {"status": "live" if has_quote else "unavailable", "max_staleness_seconds": 300},
        "fundamentals": {"status": "live" if has_fund else "unavailable", "max_staleness_seconds": 3600},
    }


def explain_conviction_score(quote: dict, fundamentals: dict) -> dict[str, Any]:
    """Conviction 2.0 — the score plus a full, auditable explanation: per-factor
    attribution, top drivers/drags, data freshness, and the model version.
    Labelled quantitative research (not investment advice)."""
    base = compute_conviction_score(quote, fundamentals)
    breakdown = build_factor_breakdown(base["factors"], quote, fundamentals)
    drivers = [r for r in breakdown if r["signal"] == "positive"][:3]
    drags = sorted(
        (r for r in breakdown if r["signal"] == "negative"),
        key=lambda r: r["delta_vs_neutral"],
    )[:3]
    return {
        **base,
        "model_version": CONVICTION_MODEL_VERSION,
        "breakdown": breakdown,
        "drivers": [
            {"label": r["label"], "input": r["input"], "contribution_points": r["contribution_points"]}
            for r in drivers
        ],
        "drags": [
            {"label": r["label"], "input": r["input"], "delta_vs_neutral": r["delta_vs_neutral"]}
            for r in drags
        ],
        "freshness": _data_freshness(quote, fundamentals),
        "track_record": {
            "available": False,
            "note": (
                "Historical hit-rate by sector/horizon populates once the "
                "conviction_outcomes backtest harness is live (STOCKVISION_STRATEGY.md §6.1)."
            ),
            "horizons_days": [30, 90, 180],
        },
        "disclaimer": "Quantitative research signal, not investment advice.",
    }


async def get_conviction_score(ticker: str) -> dict[str, Any]:
    """Async entry point: fetch data and compute score."""
    quote, fundamentals = await asyncio.gather(
        get_quote(ticker),
        get_fundamentals(ticker),
    )
    result = compute_conviction_score(quote, fundamentals)
    from datetime import datetime, timezone
    result["last_updated"] = datetime.now(timezone.utc).isoformat()
    return result


async def get_conviction_explanation(ticker: str) -> dict[str, Any]:
    """Async entry point for Conviction 2.0 — fetch data, return the full payload."""
    quote, fundamentals = await asyncio.gather(
        get_quote(ticker),
        get_fundamentals(ticker),
    )
    return explain_conviction_score(quote, fundamentals)
