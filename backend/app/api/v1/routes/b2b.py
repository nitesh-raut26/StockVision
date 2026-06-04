"""B2B API Routes — authenticated by API key via APIGatewayMiddleware.

All routes under /b2b/ require:
  X-API-Key: sv_live_<your_key>
  OR Authorization: ApiKey sv_live_<your_key>

Errors:
  401  — Missing / invalid key
  429  — Rate limit exceeded (see plan tier)

Rate limits (per minute):
  free:       60    pro:    1000
  premium:   300    enterprise: 5000

Available endpoints:
  GET  /b2b/quote/{ticker}                — Real-time quote
  POST /b2b/quotes/batch                  — Batch quotes (up to 50 tickers)
  GET  /b2b/conviction/{ticker}           — AI conviction score
  GET  /b2b/indicators/{ticker}           — Technical indicators + signals
  GET  /b2b/fundamentals/{ticker}         — Fundamental analysis data
  GET  /b2b/history/{ticker}              — OHLCV historical data
  POST /b2b/portfolio/analyze             — Portfolio risk/return analytics
  GET  /b2b/screener                      — Screener with filters
  GET  /b2b/news                          — Market news feed
  GET  /b2b/status                        — API health + key info

All monetary values in INR. Prices in ₹. Market cap in crores.
"""

import logging
import time
from typing import Any

from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel, Field

# Market-data reads go through the provider seam (app/services/market_data).
from app.services.market_data import get_market_data_provider

_md = get_market_data_provider()
get_quote = _md.get_quote
get_bulk_quotes = _md.get_bulk_quotes
get_fundamentals = _md.get_fundamentals
get_news = _md.get_news
from app.services.indicators_engine import compute_indicators

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/b2b", tags=["b2b"])


# ── Helper: extract key metadata injected by APIGatewayMiddleware ─────────────

def _key_meta(request: Request) -> dict:
    return {
        "user_id":    getattr(request.state, "api_user_id",    ""),
        "plan":       getattr(request.state, "api_plan",       "free"),
        "key_prefix": getattr(request.state, "api_key_prefix", ""),
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class BatchQuoteRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1, max_length=50, description="Up to 50 NSE tickers")


class PortfolioHolding(BaseModel):
    ticker:   str
    quantity: float = Field(gt=0)
    avg_cost: float = Field(gt=0)


class PortfolioAnalyzeRequest(BaseModel):
    holdings: list[PortfolioHolding] = Field(..., min_length=1, max_length=100)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def b2b_status(request: Request) -> dict:
    """API health check — returns key info and current timestamp.

    Example:
      GET /api/v1/b2b/status
      X-API-Key: sv_live_abc123
    """
    meta = _key_meta(request)
    return {
        "status":     "ok",
        "timestamp":  int(time.time()),
        "key_prefix": meta["key_prefix"],
        "plan":        meta["plan"],
        "version":    "v1",
        "docs":        "https://stockvision.in/developers",
    }


@router.get("/quote/{ticker}")
async def b2b_quote(ticker: str, request: Request) -> dict:
    """Real-time NSE quote for a single ticker.

    Returns price, change, change_pct, volume, market_cap, week_52_high/low, sector.

    Example:
      GET /api/v1/b2b/quote/RELIANCE
    """
    t = ticker.strip().upper()
    try:
        quote = await get_quote(t)
        return {"ticker": t, **quote, "_source": "nse_live"}
    except Exception as exc:
        logger.warning("B2B quote error for %s: %s", t, exc)
        raise HTTPException(status_code=502, detail=f"Could not fetch quote for {t}")


@router.post("/quotes/batch")
async def b2b_batch_quotes(body: BatchQuoteRequest, request: Request) -> dict:
    """Batch real-time quotes for up to 50 tickers.

    Example:
      POST /api/v1/b2b/quotes/batch
      {"tickers": ["RELIANCE", "TCS", "INFY"]}
    """
    tickers = [t.strip().upper() for t in body.tickers[:50]]
    try:
        quotes = await get_bulk_quotes(tickers)
        return {
            "count":   len(quotes),
            "quotes":  quotes,
            "ts":      int(time.time()),
        }
    except Exception as exc:
        logger.warning("B2B batch quotes error: %s", exc)
        raise HTTPException(status_code=502, detail="Batch quote fetch failed")


@router.get("/conviction/{ticker}")
async def b2b_conviction(ticker: str, request: Request) -> dict:
    """AI conviction score for a ticker.

    Returns score (1-10), signals breakdown, and a brief rationale.

    Requires: premium plan or above.
    """
    meta = _key_meta(request)
    if meta["plan"] == "free":
        raise HTTPException(status_code=403, detail="Conviction scores require Premium plan or above. Upgrade at stockvision.in/pricing")

    t = ticker.strip().upper()
    try:
        # Get fundamentals + technical signals in parallel
        import asyncio
        fund_coro = get_fundamentals(t)
        ind_coro  = compute_indicators(t, "3mo")
        fund, ind = await asyncio.gather(fund_coro, ind_coro, return_exceptions=True)

        fund    = fund    if isinstance(fund, dict)  else {}
        signals = ind.get("signals", {}) if isinstance(ind, dict) else {}
        current = ind.get("current", {}) if isinstance(ind, dict) else {}

        # Simplified conviction formula
        buy_count  = int(signals.get("buy_count",  0))
        sell_count = int(signals.get("sell_count", 0))
        total      = max(buy_count + sell_count, 1)
        tech_score = (buy_count / total) * 10

        roe = float(fund.get("roe") or 0)
        pe  = float(fund.get("pe_ratio") or 20)
        rev_growth = float(fund.get("revenue_growth") or 0)

        # Fundamental score: blend of ROE, PE reasonableness, growth
        fund_score = min(10, max(0,
            (min(roe / 2, 5))
            + (5 - min(abs(pe - 20) / 4, 4))
            + (min(rev_growth / 4, 1))
        ))

        conviction = round((tech_score * 0.4 + fund_score * 0.6), 1)

        return {
            "ticker":          t,
            "conviction_score": conviction,
            "rating":          "Buy" if conviction >= 7 else "Hold" if conviction >= 5 else "Sell",
            "breakdown": {
                "technical_score":   round(tech_score, 1),
                "fundamental_score": round(fund_score, 1),
            },
            "signals": {
                "overall":      signals.get("overall", "Neutral"),
                "buy_count":    buy_count,
                "sell_count":   sell_count,
                "neutral_count": int(signals.get("neutral_count", 0)),
            },
            "current": {
                "rsi":        current.get("rsi"),
                "macd":       current.get("macd"),
                "ema_20":     current.get("ema_20"),
                "ema_50":     current.get("ema_50"),
            },
            "fundamentals": {
                "pe_ratio":       fund.get("pe_ratio"),
                "roe":            fund.get("roe"),
                "revenue_growth": fund.get("revenue_growth"),
            },
            "ts": int(time.time()),
            "disclaimer": "Educational purposes only — not investment advice",
        }
    except Exception as exc:
        logger.warning("B2B conviction error for %s: %s", t, exc)
        raise HTTPException(status_code=502, detail=f"Could not compute conviction for {t}")


@router.get("/indicators/{ticker}")
async def b2b_indicators(
    ticker:  str,
    request: Request,
    period:  str = Query("3mo", pattern="^(1mo|3mo|6mo|1y|2y)$"),
) -> dict:
    """Full technical indicator suite for a ticker.

    Returns RSI, MACD, Bollinger Bands, EMA, Stochastic, ATR, OBV,
    Supertrend, VWAP, Williams %R, CCI, and overall signal.

    Example:
      GET /api/v1/b2b/indicators/TCS?period=3mo
    """
    t = ticker.strip().upper()
    try:
        result = await compute_indicators(t, period)
        return {
            "ticker":  t,
            "period":  period,
            "signals": result.get("signals", {}),
            "current": result.get("current", {}),
            "ts":      int(time.time()),
        }
    except Exception as exc:
        logger.warning("B2B indicators error for %s: %s", t, exc)
        raise HTTPException(status_code=502, detail=f"Could not compute indicators for {t}")


@router.get("/fundamentals/{ticker}")
async def b2b_fundamentals(ticker: str, request: Request) -> dict:
    """Fundamental analysis data for a ticker.

    Returns PE, PB, ROE, ROCE, debt/equity, revenue growth, EPS,
    dividend yield, market cap, sector, business description.

    Example:
      GET /api/v1/b2b/fundamentals/HDFC
    """
    t = ticker.strip().upper()
    try:
        fund = await get_fundamentals(t)
        return {"ticker": t, **fund, "ts": int(time.time())}
    except Exception as exc:
        logger.warning("B2B fundamentals error for %s: %s", t, exc)
        raise HTTPException(status_code=502, detail=f"Could not fetch fundamentals for {t}")


@router.get("/history/{ticker}")
async def b2b_history(
    ticker:  str,
    request: Request,
    period:  str = Query("1y",   pattern="^(1mo|3mo|6mo|1y|2y|5y)$"),
    interval: str = Query("1d", pattern="^(1d|1wk|1mo)$"),
) -> dict:
    """OHLCV historical price data.

    Example:
      GET /api/v1/b2b/history/NIFTY?period=1y&interval=1d
    """
    import yfinance as yf

    meta = _key_meta(request)
    # Limit free plan to 3 months
    if meta["plan"] == "free" and period in ("2y", "5y"):
        raise HTTPException(status_code=403, detail="Historical data beyond 1y requires Premium plan")

    t = ticker.strip().upper()
    yf_ticker = f"{t}.NS"
    try:
        df = yf.download(yf_ticker, period=period, interval=interval, auto_adjust=True, progress=False)
        if df.empty:
            df = yf.download(t, period=period, interval=interval, auto_adjust=True, progress=False)

        if df.empty:
            raise HTTPException(status_code=404, detail=f"No history found for {t}")

        records = []
        for idx, row in df.iterrows():
            records.append({
                "date":   str(idx.date()) if hasattr(idx, 'date') else str(idx),
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row["Volume"]),
            })

        return {
            "ticker":   t,
            "period":   period,
            "interval": interval,
            "count":    len(records),
            "data":     records,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("B2B history error for %s: %s", t, exc)
        raise HTTPException(status_code=502, detail=f"Could not fetch history for {t}")


@router.post("/portfolio/analyze")
async def b2b_portfolio_analyze(body: PortfolioAnalyzeRequest, request: Request) -> dict:
    """Portfolio analytics: total value, P&L, allocation, risk metrics.

    Accepts a list of holdings (ticker + quantity + avg_cost).
    Returns current value, gain/loss per holding, sector allocation,
    portfolio beta approximation, concentration risk.

    Requires: premium plan or above.
    """
    meta = _key_meta(request)
    if meta["plan"] == "free":
        raise HTTPException(status_code=403, detail="Portfolio analytics requires Premium plan. Upgrade at stockvision.in/pricing")

    tickers = list({h.ticker.upper() for h in body.holdings})
    try:
        quotes_list = await get_bulk_quotes(tickers)
        price_map   = {q["ticker"]: q for q in quotes_list if "ticker" in q}
    except Exception:
        price_map = {}

    holdings_out = []
    total_cost   = 0.0
    total_value  = 0.0
    sector_map: dict[str, float] = {}

    for h in body.holdings:
        t     = h.ticker.upper()
        q     = price_map.get(t, {})
        price = float(q.get("price") or h.avg_cost)
        curr_value = price * h.quantity
        cost_value = h.avg_cost * h.quantity
        gain        = curr_value - cost_value
        gain_pct    = (gain / cost_value * 100) if cost_value else 0

        sector = str(q.get("sector") or "Unknown")
        sector_map[sector] = sector_map.get(sector, 0) + curr_value

        total_cost  += cost_value
        total_value += curr_value

        holdings_out.append({
            "ticker":       t,
            "quantity":     h.quantity,
            "avg_cost":     round(h.avg_cost,    2),
            "current_price": round(price,          2),
            "cost_value":   round(cost_value,     2),
            "current_value": round(curr_value,    2),
            "gain_loss":    round(gain,           2),
            "gain_loss_pct": round(gain_pct,      2),
            "sector":       sector,
            "weight_pct":   0,  # updated below
        })

    # Compute weights
    for h_out in holdings_out:
        h_out["weight_pct"] = round(h_out["current_value"] / total_value * 100 if total_value else 0, 2)

    # Sector allocation
    sector_alloc = [
        {"sector": s, "value": round(v, 2), "pct": round(v / total_value * 100 if total_value else 0, 2)}
        for s, v in sorted(sector_map.items(), key=lambda x: -x[1])
    ]

    # Concentration risk (HHI)
    weights = [h["weight_pct"] / 100 for h in holdings_out]
    hhi     = sum(w ** 2 for w in weights)
    conc_risk = "High" if hhi > 0.25 else "Medium" if hhi > 0.10 else "Low"

    return {
        "summary": {
            "total_holdings": len(holdings_out),
            "total_cost":     round(total_cost,  2),
            "total_value":    round(total_value, 2),
            "total_gain":     round(total_value - total_cost, 2),
            "total_gain_pct": round((total_value - total_cost) / total_cost * 100 if total_cost else 0, 2),
            "concentration_risk": conc_risk,
            "hhi_index":      round(hhi, 4),
        },
        "holdings":           holdings_out,
        "sector_allocation":  sector_alloc,
        "ts":                 int(time.time()),
        "disclaimer":         "For informational purposes only — not investment advice",
    }


@router.get("/screener")
async def b2b_screener(
    request:    Request,
    sector:     str | None = Query(None),
    min_pe:     float | None = Query(None, ge=0),
    max_pe:     float | None = Query(None, ge=0),
    min_roce:   float | None = Query(None),
    min_score:  float | None = Query(None, ge=0, le=10),
    limit:      int = Query(20, ge=1, le=100),
    offset:     int = Query(0,  ge=0),
) -> dict:
    """Stock screener with fundamental filters.

    Filters: sector, min_pe, max_pe, min_roce, min_score (conviction).

    Example:
      GET /api/v1/b2b/screener?sector=Defence&min_roce=15&limit=10
    """
    from app.services.screener_engine import run_screener

    try:
        filters: dict[str, Any] = {}
        if sector:   filters["sector"]   = sector
        if min_pe:   filters["min_pe"]   = min_pe
        if max_pe:   filters["max_pe"]   = max_pe
        if min_roce: filters["min_roce"] = min_roce
        if min_score: filters["min_score"] = min_score

        results = await run_screener(filters, limit=limit, offset=offset)
        return {
            "count":   len(results),
            "offset":  offset,
            "results": results,
        }
    except Exception as exc:
        logger.warning("B2B screener error: %s", exc)
        raise HTTPException(status_code=502, detail="Screener service error")


@router.get("/news")
async def b2b_news(
    request: Request,
    ticker:  str | None = Query(None, description="Filter by NSE ticker"),
    limit:   int = Query(20, ge=1, le=100),
) -> dict:
    """Market news feed, optionally filtered by ticker.

    Example:
      GET /api/v1/b2b/news?ticker=RELIANCE&limit=10
    """
    try:
        news = await get_news(ticker=ticker, limit=limit)
        return {
            "count": len(news),
            "items": news,
            "ts":    int(time.time()),
        }
    except Exception as exc:
        logger.warning("B2B news error: %s", exc)
        raise HTTPException(status_code=502, detail="News service error")
