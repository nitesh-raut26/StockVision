"""Referral / Refer-and-Earn routes — backed by the referral reward ledger."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services import referral_service

router = APIRouter(prefix="/referrals", tags=["referrals"])


class ClaimRequest(BaseModel):
    referral_code: str


@router.get("/me")
async def get_my_referral(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's referral code + real reward stats and milestones."""
    return await referral_service.referral_stats(db, current_user)


@router.post("/claim", status_code=200)
async def claim_referral(
    payload: ClaimRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply someone else's referral code (one per user; fraud-checked)."""
    result = await referral_service.claim_referral(db, current_user, payload.referral_code)
    if not result.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Could not apply referral."),
        )
    return result


@router.get("/ledger")
async def referral_ledger(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The referrer's reward ledger (one row per referred user)."""
    return await referral_service.fetch_referral_ledger(db, current_user)
