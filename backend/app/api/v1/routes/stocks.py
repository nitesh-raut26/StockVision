"""Stock data routes — quotes, history, search, heatmap, analysts, news."""

import hashlib

from fastapi import APIRouter, Query, HTTPException
from app.schemas.stock import StockQuote, ConvictionScoreResponse
from app.services.data_fetcher import get_quote, get_history, search_stocks, get_bulk_quotes
from app.services.conviction_score import get_conviction_score

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/quote/{ticker}", response_model=StockQuote)
async def quote(ticker: str):
    try:
        return await get_quote(ticker.upper())
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found: {exc}")


@router.get("/history/{ticker}")
async def history(
    ticker: str,
    period: str = Query("1y", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
):
    try:
        return await get_history(ticker.upper(), period)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=30)):
    return await search_stocks(q, limit)


@router.get("/conviction/{ticker}", response_model=ConvictionScoreResponse)
async def conviction(ticker: str):
    try:
        return await get_conviction_score(ticker.upper())
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/heatmap")
async def heatmap(
    tickers: str = Query(..., description="Comma-separated NSE tickers"),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) > 100:
        raise HTTPException(status_code=400, detail="Max 100 tickers per request")
    quotes = await get_bulk_quotes(ticker_list)
    return quotes


# ── Analyst targets & news ──────────────────────────────────────────────────
# NOTE: deterministic per-ticker data so the UI always has sensible content
# offline. The paid product should replace these with a research/news vendor
# feed (e.g. Refinitiv estimates, yfinance .analyst_price_targets / .news).

_ANALYST_FIRMS = [
    ("ICICI Securities",  "Anshu Agarwal"),
    ("Kotak Equities",    "Sanjeev Kumar"),
    ("HDFC Securities",   "Nilesh Jain"),
    ("Motilal Oswal",     "Rakesh Sharma"),
    ("Axis Capital",      "Priya Nair"),
    ("Nuvama Research",   "Vikas Mehta"),
]
_ANALYST_DATES = ["May 2026", "Apr 2026", "Mar 2026"]

_NEWS_TEMPLATES = [
    ("{t} beats street estimates with strong quarterly numbers",     "Positive", "Economic Times"),
    ("Brokerages raise {t} target on robust order book",            "Positive", "Moneycontrol"),
    ("{t} faces margin pressure amid input-cost inflation",          "Negative", "Business Standard"),
    ("{t} announces capacity expansion and new contract wins",       "Positive", "Mint"),
    ("FIIs trim stake in {t} during a volatile session",            "Neutral",  "BloombergQuint"),
    ("{t} board approves dividend; buyback under review",           "Positive", "CNBC-TV18"),
]
_NEWS_TIMES = ["2h ago", "5h ago", "1d ago", "2d ago", "3d ago", "4d ago"]


def _seed(ticker: str) -> int:
    return int(hashlib.md5(ticker.encode()).hexdigest(), 16)


async def _base_price(ticker: str) -> float:
    try:
        q = await get_quote(ticker)
        price = getattr(q, "price", None)
        if price is None and isinstance(q, dict):
            price = q.get("price")
        return float(price) if price else 1000.0
    except Exception:
        return float(500 + _seed(ticker) % 4000)


@router.get("/{ticker}/analysts")
async def analyst_targets(ticker: str):
    """Consensus + per-firm 12-month price targets for a ticker."""
    ticker = ticker.upper()
    price = await _base_price(ticker)
    seed = _seed(ticker)
    n = len(_ANALYST_FIRMS)
    targets = []
    for i in range(3):
        firm, analyst = _ANALYST_FIRMS[(seed + i) % n]
        upside = round(((seed >> (i * 4)) % 60) - 8 + i * 3, 1)  # ~ -8%..+58%
        target = round(price * (1 + upside / 100))
        rating = "Buy" if upside > 12 else "Sell" if upside < -3 else "Hold"
        targets.append({
            "firm": firm, "analyst": analyst, "target": target,
            "upside": upside, "rating": rating, "date": _ANALYST_DATES[i],
        })
    consensus = round(sum(t["target"] for t in targets) / len(targets))
    return {
        "ticker": ticker,
        "consensus_target": consensus,
        "consensus_upside": round((consensus - price) / price * 100, 1) if price else 0,
        "targets": targets,
    }


@router.get("/{ticker}/news")
async def stock_news(ticker: str, limit: int = Query(6, ge=1, le=20)):
    """Recent news items for a ticker, with sentiment tags."""
    ticker = ticker.upper()
    seed = _seed(ticker)
    n = len(_NEWS_TEMPLATES)
    items = []
    for i in range(min(limit, n)):
        headline, sentiment, source = _NEWS_TEMPLATES[(seed + i) % n]
        items.append({
            "id":        f"{ticker}-news-{i}",
            "headline":  headline.format(t=ticker),
            "source":    source,
            "time":      _NEWS_TIMES[(seed + i) % len(_NEWS_TIMES)],
            "sentiment": sentiment,
            "url":       f"https://www.google.com/search?q={ticker}%20stock%20news",
        })
    return {"ticker": ticker, "items": items}


@router.get("/indices")
async def indices():
    """Return stable index tape data for the landing page.

    Public yfinance index endpoints often rate-limit local demos. The paid
    product should replace this with an exchange/data-vendor feed, but the app
    should never show zeroed indices or spam 429 logs while that setup is absent.
    """
    return [
        {"ticker": "^NSEI", "name": "NIFTY 50", "price": 24842.65, "change": 184.30, "change_pct": 0.75},
        {"ticker": "^BSESN", "name": "SENSEX", "price": 81426.80, "change": 612.45, "change_pct": 0.76},
        {"ticker": "NIFTYIT.NS", "name": "NIFTY IT", "price": 38420.15, "change": -284.60, "change_pct": -0.74},
        {"ticker": "NIFTYBANK.NS", "name": "BANK NIFTY", "price": 53218.40, "change": -124.80, "change_pct": -0.23},
        {"ticker": "NIFTYDEFENCE", "name": "NIFTY DEFENCE", "price": 7824.35, "change": 284.90, "change_pct": 3.78},
    ]
