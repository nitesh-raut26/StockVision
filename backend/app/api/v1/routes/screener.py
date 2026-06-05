"""Stock screener routes — V2 with 500+ stock universe."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.portfolio import SavedScreen
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


# ── Saved screens ─────────────────────────────────────────────────────────────

class SavedScreenCreate(BaseModel):
    name: str
    filters: dict
    alert_enabled: bool = False


class SavedScreenUpdate(BaseModel):
    alert_enabled: bool


class SavedScreenOut(BaseModel):
    id: str
    name: str
    filters: dict
    alert_enabled: bool


def serialize_screen(s: SavedScreen) -> dict:
    return {"id": s.id, "name": s.name, "filters": s.filters or {}, "alert_enabled": s.alert_enabled}


@router.get("/saved", response_model=list[SavedScreenOut])
async def list_saved_screens(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(SavedScreen)
        .where(SavedScreen.user_id == current_user.id)
        .order_by(SavedScreen.created_at.desc())
    )
    return [serialize_screen(s) for s in rows.scalars().all()]


@router.post("/saved", response_model=SavedScreenOut, status_code=status.HTTP_201_CREATED)
async def create_saved_screen(
    payload: SavedScreenCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    screen = SavedScreen(
        user_id=current_user.id,
        name=payload.name.strip()[:120] or "Untitled screen",
        filters=payload.filters,
        alert_enabled=payload.alert_enabled,
    )
    db.add(screen)
    await db.commit()
    await db.refresh(screen)
    return serialize_screen(screen)


@router.patch("/saved/{screen_id}", response_model=SavedScreenOut)
async def update_saved_screen(
    screen_id: str,
    payload: SavedScreenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedScreen).where(SavedScreen.id == screen_id, SavedScreen.user_id == current_user.id)
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(status_code=404, detail="Saved screen not found")
    screen.alert_enabled = payload.alert_enabled
    await db.commit()
    await db.refresh(screen)
    return serialize_screen(screen)


@router.delete("/saved/{screen_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_screen(
    screen_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedScreen).where(SavedScreen.id == screen_id, SavedScreen.user_id == current_user.id)
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(status_code=404, detail="Saved screen not found")
    await db.delete(screen)
    await db.commit()
