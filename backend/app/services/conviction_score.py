"""AI conviction score engine (1–10 scale) for Indian stocks."""

import asyncio
from typing import Any
from app.services.data_fetcher import get_quote, get_fundamentals


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
