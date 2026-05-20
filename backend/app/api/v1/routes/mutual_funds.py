"""Mutual fund intelligence routes."""

import asyncio
from fastapi import APIRouter, Query, HTTPException
import yfinance as yf

router = APIRouter(prefix="/mutual-funds", tags=["mutual_funds"])

# Top Indian MF categories with representative ETFs/funds on NSE
MF_UNIVERSE = {
    "large_cap": ["NIFTYBEES.NS", "JUNIORBEES.NS", "SETFNN50.NS"],
    "mid_cap": ["MIDCAPETF.NS", "NV20BEES.NS"],
    "small_cap": ["SETFNIF50.NS"],
    "flexi_cap": ["ICICIB22.NS"],
    "elss": ["AXISELONG.NS"],
    "index": ["NIFTYBEES.NS", "BANKBEES.NS", "ITBEES.NS", "PSUBNKBEES.NS"],
    "sectoral": ["ITBEES.NS", "PHARMABEES.NS", "BANKBEES.NS"],
}


def _fetch_fund_data_sync(ticker: str) -> dict:
    try:
        yt = yf.Ticker(ticker)
        info = yt.info
        hist = yt.history(period="1y")
        returns_1y = None
        if len(hist) >= 2:
            returns_1y = round((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0] * 100, 2)
        return {
            "ticker": ticker.replace(".NS", ""),
            "name": info.get("longName") or info.get("shortName") or ticker,
            "nav": round(info.get("regularMarketPrice") or info.get("currentPrice") or 0, 2),
            "change_pct": round(info.get("regularMarketChangePercent") or 0, 2),
            "aum": info.get("totalAssets"),
            "expense_ratio": info.get("annualReportExpenseRatio"),
            "returns_1y": returns_1y,
            "category": "Index ETF",
            "risk": "Moderate",
            "min_sip": 500,
        }
    except Exception:
        return None


@router.get("/")
async def list_funds(category: str = Query("index")):
    tickers = MF_UNIVERSE.get(category, MF_UNIVERSE["index"])
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(*[
        loop.run_in_executor(None, _fetch_fund_data_sync, t) for t in tickers
    ])
    return [r for r in results if r is not None]


@router.get("/sip-calculator")
async def sip_calculator(
    monthly_amount: float = Query(..., gt=0),
    expected_return: float = Query(0.12, ge=0.01, le=0.50),
    tenure_years: int = Query(10, ge=1, le=40),
):
    """SIP compound return calculator."""
    r = expected_return / 12
    n = tenure_years * 12
    if r > 0:
        future_value = monthly_amount * (((1 + r) ** n - 1) / r) * (1 + r)
    else:
        future_value = monthly_amount * n
    invested = monthly_amount * n
    returns = future_value - invested

    # Build year-by-year projection
    projection = []
    for yr in range(1, tenure_years + 1):
        n_yr = yr * 12
        if r > 0:
            fv_yr = monthly_amount * (((1 + r) ** n_yr - 1) / r) * (1 + r)
        else:
            fv_yr = monthly_amount * n_yr
        projection.append({
            "year": yr,
            "invested": round(monthly_amount * n_yr, 2),
            "value": round(fv_yr, 2),
            "returns": round(fv_yr - monthly_amount * n_yr, 2),
        })

    return {
        "monthly_amount": monthly_amount,
        "tenure_years": tenure_years,
        "expected_return_pct": expected_return * 100,
        "total_invested": round(invested, 2),
        "future_value": round(future_value, 2),
        "total_returns": round(returns, 2),
        "wealth_gain_pct": round(returns / invested * 100, 2),
        "projection": projection,
    }
