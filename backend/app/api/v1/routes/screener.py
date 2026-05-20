"""Stock screener routes — V2 with 500+ stock universe."""

from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.stock import StockScreenerFilter, StockScreenerResult
from app.services.screener_engine import NSE_500_UNIVERSE, STOCK_META, run_screener

router = APIRouter(prefix="/screener", tags=["screener"])


@router.post("/run", response_model=list[StockScreenerResult])
async def run(
    filters: StockScreenerFilter,
    current_user: User = Depends(get_current_user),
):
    """Run the stock screener.

    Free tier: capped at nifty200 universe, no revenue-growth filter.
    Premium+:  full nifty500 universe + all filters unlocked.
    """
    data = filters.model_dump()

    # Free-tier restrictions
    if current_user.plan == "free":
        if data.get("universe") == "nifty500":
            data["universe"] = "nifty200"   # downgrade silently
        if data.get("min_revenue_growth", -50) > -50:
            raise HTTPException(
                status_code=403,
                detail="Revenue growth filter requires a paid plan. Upgrade at /subscriptions.",
            )

    results = await run_screener(data)
    return results


@router.get("/universe/stats")
async def universe_stats(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return sector distribution and stock counts for each universe tier."""
    from collections import Counter
    sector_count = Counter(m["sector"] for m in STOCK_META.values())
    cap_count    = Counter(m.get("cap", "mid") for m in STOCK_META.values())
    return {
        "total_stocks": len(NSE_500_UNIVERSE),
        "meta_coverage": len(STOCK_META),
        "by_sector": dict(sector_count.most_common()),
        "by_cap":    dict(cap_count),
        "universes": {
            "nifty50":  50,
            "nifty200": 100,
            "nifty500": len(NSE_500_UNIVERSE),
        },
    }


@router.get("/presets/{preset_name}")
async def preset(
    preset_name: str,
    current_user: User = Depends(get_current_user),
):
    """Return a named preset filter configuration."""
    presets = {
        "deep_value": {
            "max_pe": 15,
            "min_roce": 15,
            "max_debt_equity": 0.5,
            "min_conviction_score": 6.0,
            "universe": "nifty200",
            "sort_by": "conviction_score",
        },
        "growth": {
            "min_revenue_growth": 20,
            "min_conviction_score": 6.5,
            "universe": "nifty500",
            "sort_by": "upside",
        },
        "dividend": {
            "min_conviction_score": 5.0,
            "max_debt_equity": 1.0,
            "universe": "nifty200",
            "sort_by": "conviction_score",
        },
        "momentum": {
            "min_conviction_score": 5.5,
            "universe": "nifty200",
            "sort_by": "change_pct",
        },
        "large_cap_quality": {
            "cap": "large",
            "min_conviction_score": 6.0,
            "max_debt_equity": 1.0,
            "universe": "nifty50",
            "sort_by": "conviction_score",
        },
        "midcap_growth": {
            "cap": "mid",
            "min_conviction_score": 5.5,
            "universe": "nifty500",
            "sort_by": "upside",
        },
        "defence_theme": {
            "sector": "Defence",
            "universe": "nifty500",
            "sort_by": "conviction_score",
        },
        "it_momentum": {
            "sector": "IT",
            "min_conviction_score": 5.0,
            "universe": "nifty200",
            "sort_by": "change_pct",
        },
    }
    if preset_name not in presets:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_name}' not found")
    return presets[preset_name]
