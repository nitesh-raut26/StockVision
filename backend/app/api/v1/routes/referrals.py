"""Referral / Refer-and-Earn routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/referrals", tags=["referrals"])


class ReferralStats(BaseModel):
    code: str
    invited: int
    earned_inr: int
    pending_inr: int
    milestones: list[dict]


class ClaimRequest(BaseModel):
    referral_code: str


@router.get("/me", response_model=ReferralStats)
async def get_my_referral(current_user: User = Depends(get_current_user)):
    name_part = (current_user.name or "USER")[:4].upper()
    code = f"SV-{name_part}-2026"
    return ReferralStats(
        code=code,
        invited=3,
        earned_inr=400,
        pending_inr=100,
        milestones=[
            {"target": 1,  "reward": "₹100",             "achieved": True},
            {"target": 3,  "reward": "₹300",             "achieved": True},
            {"target": 5,  "reward": "₹500 + 1 mo Premium", "achieved": False},
            {"target": 10, "reward": "₹1,500",           "achieved": False},
        ],
    )


@router.post("/claim", status_code=200)
async def claim_referral(payload: ClaimRequest, current_user: User = Depends(get_current_user)):
    code = payload.referral_code.strip().upper()
    if not code.startswith("SV-") or len(code) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid referral code format.")
    name_part = (current_user.name or "USER")[:4].upper()
    own_code = f"SV-{name_part}-2026"
    if code == own_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot use your own referral code.")
    return {"message": "Referral applied! ₹100 will be credited once your friend completes their first subscription."}
