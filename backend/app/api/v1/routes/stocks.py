"""Stock data routes — quotes, history, search, heatmap."""

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
