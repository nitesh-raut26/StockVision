"""DCF valuation routes."""

from fastapi import APIRouter, Query, HTTPException
from app.services.dcf_calculator import get_dcf_valuation

router = APIRouter(prefix="/dcf", tags=["dcf"])


@router.get("/{ticker}")
async def dcf_valuation(
    ticker: str,
    wacc: float = Query(0.12, ge=0.05, le=0.30, description="Weighted average cost of capital"),
    growth_years: int = Query(10, ge=5, le=20, description="Explicit forecast period"),
):
    try:
        return await get_dcf_valuation(ticker.upper(), wacc=wacc, growth_years=growth_years)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))
