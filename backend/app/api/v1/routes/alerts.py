"""Price alerts routes — CRUD for user-defined stock alerts."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.portfolio import Alert
from app.models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    condition: str = Field(..., pattern="^(above|below|pct_change)$")
    threshold: Decimal = Field(..., ge=0)


class AlertOut(BaseModel):
    id: str
    ticker: str
    condition: str
    threshold: float
    active: bool
    triggered: bool

    class Config:
        from_attributes = True


@router.get("", response_model=list[AlertOut])
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert)
        .where(Alert.user_id == current_user.id)
        .order_by(Alert.created_at.desc())
    )
    return [
        AlertOut(
            id=str(a.id),
            ticker=a.ticker,
            condition=a.condition,
            threshold=float(a.threshold),
            active=a.active,
            triggered=a.triggered,
        )
        for a in result.scalars().all()
    ]


@router.post("", response_model=AlertOut, status_code=201)
async def create_alert(
    body: AlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = Alert(
        user_id=current_user.id,
        ticker=body.ticker.upper(),
        condition=body.condition,
        threshold=body.threshold,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return AlertOut(
        id=str(alert.id),
        ticker=alert.ticker,
        condition=alert.condition,
        threshold=float(alert.threshold),
        active=alert.active,
        triggered=alert.triggered,
    )


@router.patch("/{alert_id}", response_model=AlertOut)
async def update_alert(
    alert_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if "active" in body and isinstance(body["active"], bool):
        alert.active = body["active"]
    return AlertOut(
        id=str(alert.id),
        ticker=alert.ticker,
        condition=alert.condition,
        threshold=float(alert.threshold),
        active=alert.active,
        triggered=alert.triggered,
    )


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if alert:
        await db.delete(alert)
