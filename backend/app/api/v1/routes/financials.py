"""Financial statements API routes.

Endpoints:
  GET /financials/{ticker}/income?period=quarterly&limit=8
  GET /financials/{ticker}/balance-sheet?period=quarterly&limit=8
  GET /financials/{ticker}/cash-flow?period=quarterly&limit=8
  GET /financials/{ticker}/summary   — all three types, last 4 periods each

Security: all endpoints are public (no auth required) — financial data is
public information. Rate limiting via slowapi (inherited from app-level).
"""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.services.financial_service import get_financials

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/financials", tags=["financials"])

_STMT_MAP = {
    "income":        "income",
    "balance-sheet": "balance_sheet",
    "cash-flow":     "cash_flow",
}


@router.get("/{ticker}/income")
async def income_statement(
    ticker: str,
    period: Literal["quarterly", "annual"] = Query("quarterly"),
    limit:  int = Query(8, ge=1, le=20),
):
    """Quarterly or annual income statements — up to 5 years."""
    data = await get_financials(ticker.upper(), "income", period, limit)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No income statement data found for {ticker.upper()}. "
                   "Data may not be available for this ticker yet.",
        )
    return {"ticker": ticker.upper(), "statement_type": "income", "period": period, "data": data}


@router.get("/{ticker}/balance-sheet")
async def balance_sheet(
    ticker: str,
    period: Literal["quarterly", "annual"] = Query("quarterly"),
    limit:  int = Query(8, ge=1, le=20),
):
    """Quarterly or annual balance sheet."""
    data = await get_financials(ticker.upper(), "balance_sheet", period, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"No balance sheet data for {ticker.upper()}")
    return {"ticker": ticker.upper(), "statement_type": "balance_sheet", "period": period, "data": data}


@router.get("/{ticker}/cash-flow")
async def cash_flow_statement(
    ticker: str,
    period: Literal["quarterly", "annual"] = Query("quarterly"),
    limit:  int = Query(8, ge=1, le=20),
):
    """Quarterly or annual cash flow statement."""
    data = await get_financials(ticker.upper(), "cash_flow", period, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"No cash flow data for {ticker.upper()}")
    return {"ticker": ticker.upper(), "statement_type": "cash_flow", "period": period, "data": data}


@router.get("/{ticker}/summary")
async def financials_summary(
    ticker: str,
    period: Literal["quarterly", "annual"] = Query("quarterly"),
    limit:  int = Query(4, ge=1, le=8),
):
    """All three statement types in one call — ideal for stock detail pages."""
    ticker = ticker.upper()

    import asyncio
    income_task = get_financials(ticker, "income",       period, limit)
    bs_task     = get_financials(ticker, "balance_sheet", period, limit)
    cf_task     = get_financials(ticker, "cash_flow",     period, limit)

    income, balance_sheet_, cash_flow_ = await asyncio.gather(
        income_task, bs_task, cf_task, return_exceptions=True
    )

    return {
        "ticker":        ticker,
        "period":        period,
        "income":        income        if isinstance(income,        list) else [],
        "balance_sheet": balance_sheet_ if isinstance(balance_sheet_, list) else [],
        "cash_flow":     cash_flow_     if isinstance(cash_flow_,     list) else [],
    }
