"""Watchlist and price alert routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.portfolio import WatchlistItem, Alert
# Market-data reads go through the provider seam (app/services/market_data).
from app.services.market_data import get_market_data_provider

get_bulk_quotes = get_market_data_provider().get_bulk_quotes

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistAdd(BaseModel):
    ticker: str
    notes: str | None = None


class AlertCreate(BaseModel):
    ticker: str
    condition: str  # above | below | pct_change
    threshold: float


@router.get("/")
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(WatchlistItem).where(WatchlistItem.user_id == current_user.id))
    items = result.scalars().all()
    if not items:
        return []
    tickers = [i.ticker for i in items]
    quotes = await get_bulk_quotes(tickers)
    quote_map = {q["ticker"]: q for q in quotes}
    return [
        {
            "id": item.id,
            "ticker": item.ticker,
            "notes": item.notes,
            **quote_map.get(item.ticker, {}),
        }
        for item in items
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    body: WatchlistAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.ticker == body.ticker.upper(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already in watchlist")
    item = WatchlistItem(user_id=current_user.id, ticker=body.ticker.upper(), notes=body.notes)
    db.add(item)
    await db.flush()
    return {"id": item.id, "ticker": item.ticker, "notes": item.notes}


@router.delete("/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.ticker == ticker.upper(),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    await db.delete(item)


# ---- Price Alerts ----

@router.get("/alerts")
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Alert).where(Alert.user_id == current_user.id))
    return result.scalars().all()


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(
    body: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = Alert(
        user_id=current_user.id,
        ticker=body.ticker.upper(),
        condition=body.condition,
        threshold=body.threshold,
    )
    db.add(alert)
    await db.flush()
    return {"id": alert.id, "ticker": alert.ticker, "condition": alert.condition, "threshold": alert.threshold}


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
