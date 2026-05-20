"""Market-level data routes.

  GET /market/fii-dii            — FII/DII daily flows (last 30 trading days)
  GET /market/fii-dii/today      — Today's FII/DII snapshot
  GET /market/fii-dii/summary    — 10-day rolling sentiment summary
  GET /market/indices            — Major NSE indices (NIFTY 50, NIFTY Bank, etc.)
  GET /market/breadth            — Market advance/decline breadth
  GET /market/top-gainers        — Top 10 NIFTY gainers
  GET /market/top-losers         — Top 10 NIFTY losers
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.models.user import User
from app.services.fii_dii_service import fetch_fii_dii, get_fii_dii_summary
from app.services.data_fetcher import get_bulk_quotes, get_quote

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])

# ── NIFTY 50 constituents (top 30 by weight — sufficient for breadth calc) ───
_NIFTY50_SAMPLE = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK",
    "LT", "HCLTECH", "AXISBANK", "ASIANPAINT", "MARUTI",
    "SUNPHARMA", "TITAN", "ULTRACEMCO", "BAJFINANCE", "WIPRO",
    "NESTLEIND", "POWERGRID", "NTPC", "ADANIENT", "TECHM",
    "JSWSTEEL", "TATASTEEL", "HINDALCO", "ONGC", "COALINDIA",
]

_INDICES = [
    {"symbol": "^NSEI",     "name": "NIFTY 50",       "yf": "^NSEI"},
    {"symbol": "^NSEBANK",  "name": "NIFTY Bank",      "yf": "^NSEBANK"},
    {"symbol": "NIFTYIT.NS","name": "NIFTY IT",        "yf": "NIFTYIT.NS"},
    {"symbol": "NIFTYMID150.NS","name":"NIFTY Midcap 150","yf":"NIFTYMID150.NS"},
]


# ── FII/DII Routes ────────────────────────────────────────────────────────────

@router.get("/fii-dii")
async def fii_dii_flows(
    days: int = Query(default=30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
) -> dict:
    """FII and DII net buy/sell flows for the last N trading days.

    Values in ₹ Crore. Positive = net buy, negative = net sell.
    Sentiment label: Strong Buy | FII Inflow | DII Support | Neutral | Heavy Sell
    """
    rows = await fetch_fii_dii(days)
    return {
        "days":     days,
        "count":    len(rows),
        "data":     rows,
        "source":   "NSE India",
        "unit":     "₹ Crore",
    }


@router.get("/fii-dii/today")
async def fii_dii_today(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Today's (or most recent trading day's) FII/DII snapshot."""
    rows = await fetch_fii_dii(3)
    today = rows[0] if rows else {}
    return {"data": today, "unit": "₹ Crore"}


@router.get("/fii-dii/summary")
async def fii_dii_summary(
    days: int = Query(default=10, ge=3, le=30),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Rolling FII/DII sentiment summary for the last N trading days."""
    summary = await get_fii_dii_summary(days)
    return summary


# ── Indices ───────────────────────────────────────────────────────────────────

@router.get("/indices")
async def major_indices(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Major NSE indices with current price and day change."""
    import asyncio
    import yfinance as yf

    async def _fetch_index(meta: dict) -> dict:
        try:
            loop = asyncio.get_event_loop()
            def _yf():
                t = yf.Ticker(meta["yf"])
                hist = t.history(period="2d")
                if len(hist) < 1:
                    return None
                close  = float(hist["Close"].iloc[-1])
                prev   = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else close
                change = round(close - prev, 2)
                chg_pct= round((change / prev) * 100, 2) if prev else 0
                return {
                    "symbol":     meta["symbol"],
                    "name":       meta["name"],
                    "price":      round(close, 2),
                    "change":     change,
                    "change_pct": chg_pct,
                }
            return await loop.run_in_executor(None, _yf) or {"symbol": meta["symbol"], "name": meta["name"], "price": 0, "change": 0, "change_pct": 0}
        except Exception as exc:
            logger.debug("Index fetch failed for %s: %s", meta["symbol"], exc)
            return {"symbol": meta["symbol"], "name": meta["name"], "price": 0, "change": 0, "change_pct": 0}

    results = await asyncio.gather(*[_fetch_index(m) for m in _INDICES])
    return {"indices": [r for r in results if r]}


# ── Market Breadth ────────────────────────────────────────────────────────────

@router.get("/breadth")
async def market_breadth(
    current_user: User = Depends(get_current_user),
) -> dict:
    """NIFTY 50 market breadth: advances vs declines, A/D ratio.

    Uses a sample of 30 NIFTY 50 stocks for real-time computation.
    """
    try:
        quotes = await get_bulk_quotes(_NIFTY50_SAMPLE)
        advances  = [q for q in quotes if float(q.get("change_pct") or 0) > 0]
        declines  = [q for q in quotes if float(q.get("change_pct") or 0) < 0]
        unchanged = [q for q in quotes if float(q.get("change_pct") or 0) == 0]

        ad_ratio = round(len(advances) / max(len(declines), 1), 2)
        breadth_signal = (
            "Strong Bullish" if len(advances) >= 25 else
            "Bullish"        if len(advances) >= 18 else
            "Bearish"        if len(declines) >= 18 else
            "Strong Bearish" if len(declines) >= 25 else
            "Neutral"
        )

        # Top gainer and loser
        sorted_q = sorted(quotes, key=lambda q: float(q.get("change_pct") or 0), reverse=True)

        return {
            "total":          len(quotes),
            "advances":       len(advances),
            "declines":       len(declines),
            "unchanged":      len(unchanged),
            "ad_ratio":       ad_ratio,
            "breadth_signal": breadth_signal,
            "top_gainer":     sorted_q[0]  if sorted_q else None,
            "top_loser":      sorted_q[-1] if sorted_q else None,
        }
    except Exception as exc:
        logger.warning("Market breadth error: %s", exc)
        return {"total": 0, "advances": 0, "declines": 0, "unchanged": 0, "ad_ratio": 1, "breadth_signal": "Neutral"}


# ── Top Gainers / Losers ──────────────────────────────────────────────────────

@router.get("/top-gainers")
async def top_gainers(
    limit: int = Query(default=10, ge=1, le=30),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Top NIFTY 50 gainers by percentage change today."""
    try:
        quotes = await get_bulk_quotes(_NIFTY50_SAMPLE)
        gainers = sorted(
            [q for q in quotes if float(q.get("change_pct") or 0) > 0],
            key=lambda q: float(q.get("change_pct") or 0),
            reverse=True,
        )[:limit]
        return {"count": len(gainers), "data": gainers}
    except Exception as exc:
        logger.warning("Top gainers error: %s", exc)
        return {"count": 0, "data": []}


@router.get("/top-losers")
async def top_losers(
    limit: int = Query(default=10, ge=1, le=30),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Top NIFTY 50 losers by percentage change today."""
    try:
        quotes = await get_bulk_quotes(_NIFTY50_SAMPLE)
        losers = sorted(
            [q for q in quotes if float(q.get("change_pct") or 0) < 0],
            key=lambda q: float(q.get("change_pct") or 0),
        )[:limit]
        return {"count": len(losers), "data": losers}
    except Exception as exc:
        logger.warning("Top losers error: %s", exc)
        return {"count": 0, "data": []}
