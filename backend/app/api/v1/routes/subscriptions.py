"""Subscription and Razorpay payment routes.

Flow:
  1. GET  /subscriptions/plans              — list plan catalogue
  2. GET  /subscriptions/me                 — current user subscription state
  3. POST /subscriptions/checkout           — create Razorpay order, return params
  4. POST /subscriptions/verify-payment     — verify Razorpay signature, upgrade plan
  5. POST /subscriptions/cancel             — downgrade back to free (no refund flow)
"""

import hashlib
import hmac
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# ── Plan catalogue ────────────────────────────────────────────────────────────

class Plan(BaseModel):
    id: Literal["free", "premium", "pro", "enterprise"]
    name: str
    price_monthly: int        # INR
    price_yearly: int         # INR (12-month prepay)
    features: list[str]


PLANS: list[Plan] = [
    Plan(
        id="free",
        name="Free",
        price_monthly=0,
        price_yearly=0,
        features=["Watchlist (20 stocks)", "Basic screener", "Demo portfolio", "Market overview"],
    ),
    Plan(
        id="premium",
        name="Premium",
        price_monthly=299,
        price_yearly=2990,
        features=[
            "Everything in Free",
            "DCF Builder",
            "Tax Tracker",
            "5 AI reports/month",
            "Price alerts (10)",
            "Fundamental screener",
        ],
    ),
    Plan(
        id="pro",
        name="Pro",
        price_monthly=999,
        price_yearly=9990,
        features=[
            "Everything in Premium",
            "Family Portfolio",
            "Advanced alerts (unlimited)",
            "Broker sync (Zerodha, Groww, Upstox)",
            "Backtesting engine",
            "Options chain",
        ],
    ),
    Plan(
        id="enterprise",
        name="Enterprise",
        price_monthly=1999,
        price_yearly=19990,
        features=[
            "Everything in Pro",
            "CA Portal",
            "White-label research reports",
            "Developer API access",
            "Priority support",
            "Custom data exports",
        ],
    ),
]

_PLAN_MAP: dict[str, Plan] = {p.id: p for p in PLANS}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan_id: Literal["premium", "pro", "enterprise"]
    billing_cycle: Literal["monthly", "yearly"] = "monthly"


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    plan_id: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[Plan])
async def get_plans():
    """Return the full plan catalogue (unauthenticated)."""
    return PLANS


@router.get("/me")
async def current_subscription(current_user: User = Depends(get_current_user)):
    """Return the current user's subscription state."""
    return {
        "plan": current_user.plan,
        "status": "active" if current_user.plan != "free" else "free",
        "billing_provider": "razorpay",
        "payments_configured": bool(
            settings.razorpay_key_id and settings.razorpay_key_secret
        ),
    }


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a Razorpay order and return all params needed by the frontend modal."""
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Payments are not yet configured on this server. "
                "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout."
            ),
        )

    plan = _PLAN_MAP.get(payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    amount_inr = (
        plan.price_monthly
        if payload.billing_cycle == "monthly"
        else plan.price_yearly
    )
    if amount_inr == 0:
        raise HTTPException(status_code=400, detail="Free plan does not require checkout")

    amount_paise = amount_inr * 100  # Razorpay amounts are in paise

    try:
        import razorpay  # noqa: PLC0415  (optional dep — checked at runtime)

        client = razorpay.Client(
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret)
        )
        order = client.order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"sv_{current_user.id[:8]}_{plan.id}",
                "notes": {
                    "user_id": current_user.id,
                    "plan": payload.plan_id,
                    "billing_cycle": payload.billing_cycle,
                },
            }
        )
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Razorpay SDK not installed. Run: pip install razorpay",
        )
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Payment gateway error — please try again in a moment",
        )

    logger.info(
        "Razorpay order created: order_id=%s user=%s plan=%s amount_inr=%d",
        order["id"],
        current_user.id,
        payload.plan_id,
        amount_inr,
    )

    return {
        "key_id": settings.razorpay_key_id,
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "plan_id": payload.plan_id,
        "plan_name": plan.name,
        "billing_cycle": payload.billing_cycle,
        "prefill": {
            "name": current_user.name,
            "email": current_user.email or "",
        },
    }


@router.post("/verify-payment")
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify Razorpay payment signature then upgrade the user's plan.

    Razorpay signature formula (per Razorpay docs):
        HMAC-SHA256( key=razorpay_key_secret,
                     msg="{order_id}|{payment_id}" )
    """
    if not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payments not configured on this server",
        )

    message = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected_sig = hmac.new(
        settings.razorpay_key_secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, payload.razorpay_signature):
        logger.warning(
            "Payment signature mismatch — user=%s order=%s",
            current_user.id,
            payload.razorpay_order_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed — signature mismatch",
        )

    # Signature valid — upgrade plan
    plan_id = payload.plan_id
    if plan_id in ("premium", "pro", "enterprise"):
        current_user.plan = plan_id
        logger.info(
            "Plan upgraded via verify-payment — user=%s plan=%s order=%s",
            current_user.id,
            plan_id,
            payload.razorpay_order_id,
        )
        # Two-sided referral credit: if this user was referred, qualify it now
        # (idempotent; commits the plan change + referral reward together).
        from app.services.referral_service import qualify_referral  # noqa: PLC0415
        try:
            await qualify_referral(db, current_user.id)
        except Exception as exc:  # never block a paid upgrade on referral bookkeeping
            logger.warning("Referral qualify failed (non-fatal): %s", exc)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_id}")

    return {"plan": current_user.plan, "status": "active"}


@router.post("/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Downgrade user to free plan (immediate, no refund)."""
    if current_user.plan == "free":
        return {"plan": "free", "message": "Already on free plan"}

    previous_plan = current_user.plan
    current_user.plan = "free"
    logger.info(
        "Subscription cancelled — user=%s previous_plan=%s",
        current_user.id,
        previous_plan,
    )
    return {"plan": "free", "message": f"Downgraded from {previous_plan} to free"}
