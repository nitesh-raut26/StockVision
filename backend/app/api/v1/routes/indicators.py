"""Technical indicators API.

GET /indicators/{ticker}?period=1y
  Returns all indicators (RSI, MACD, BB, EMA/SMA, ATR, Stochastic,
  Williams%R, CCI, OBV, Supertrend, VWAP) + signals summary.

GET /indicators/{ticker}/signals
  Returns only the trading signals summary (lightweight — for screener).

Security: public endpoint. Rate limiting: 60/min per IP via slowapi.
Caching: 5-min TTL in indicators_engine.
"""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.services.indicators_engine import compute_indicators

router = APIRouter(prefix="/indicators", tags=["indicators"])


@router.get("/{ticker}")
async def get_indicators(
    ticker: str,
    period: Literal["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"] = Query("1y"),
):
    """Full indicators payload for a ticker.

    Returns arrays aligned with `dates` + current snapshot values + signals.
    The `dates` array is the x-axis for all chart series.
    """
    result = await compute_indicators(ticker.upper(), period)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Insufficient data for indicators: {ticker.upper()}. "
                   "Minimum 26 candles required.",
        )
    return result


@router.get("/{ticker}/signals")
async def get_signals(
    ticker: str,
    period: Literal["1mo", "3mo", "6mo", "1y"] = Query("3mo"),
):
    """Lightweight signals-only endpoint — used by screener bulk calls."""
    result = await compute_indicators(ticker.upper(), period)
    if not result:
        raise HTTPException(status_code=404, detail=f"No data for {ticker.upper()}")

    return {
        "ticker":  ticker.upper(),
        "period":  period,
        "signals": result.get("signals", {}),
        "current": result.get("current", {}),
    }
