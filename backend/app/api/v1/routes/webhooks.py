"""Webhook endpoints — Razorpay payment events."""

import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.models.extensions import SubscriptionEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_razorpay_signature(payload: bytes, signature: str, secret: str) -> bool:
    """HMAC-SHA256 verification per Razorpay docs."""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/razorpay")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not settings.razorpay_webhook_secret:
        logger.error("RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook request")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook endpoint not configured",
        )
    elif not signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")
    elif not _verify_razorpay_signature(payload_bytes, signature, settings.razorpay_webhook_secret):
        logger.warning("Razorpay webhook signature mismatch — potential forgery attempt")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event_data = json.loads(payload_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event_data.get("event", "unknown")
    event_id = event_data.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
    order_id = event_data.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
    amount_paise = event_data.get("payload", {}).get("payment", {}).get("entity", {}).get("amount")

    # Store audit record first, then process
    audit = SubscriptionEvent(
        event_type=event_type,
        razorpay_event_id=event_id,
        razorpay_order_id=order_id,
        amount_paise=amount_paise,
        status="received",
        payload=payload_bytes.decode("utf-8")[:10000],  # cap at 10KB
    )
    db.add(audit)
    await db.flush()

    if event_type == "payment.captured":
        await _handle_payment_captured(event_data, audit, db)
    elif event_type == "subscription.activated":
        await _handle_subscription_activated(event_data, audit, db)
    elif event_type == "subscription.cancelled":
        await _handle_subscription_cancelled(event_data, audit, db)
    else:
        logger.info("Unhandled Razorpay event type: %s", event_type)
        audit.status = "ignored"

    return {"status": "ok"}


async def _handle_payment_captured(event_data: dict, audit: SubscriptionEvent, db: AsyncSession) -> None:
    from sqlalchemy import select
    from app.models.user import User

    try:
        notes = event_data.get("payload", {}).get("payment", {}).get("entity", {}).get("notes", {})
        user_id = notes.get("user_id")

        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                plan = notes.get("plan", "premium")
                if plan in ("premium", "pro", "enterprise"):
                    user.plan = plan
                    audit.user_id = user_id
                    audit.status = "processed"
                    logger.info("Upgraded user %s to plan %s", user_id, plan)
                    return

        audit.status = "processed"
        logger.info("payment.captured processed (no user upgrade needed)")
    except Exception as exc:
        logger.error("Error processing payment.captured: %s", exc)
        audit.status = "failed"


async def _handle_subscription_activated(event_data: dict, audit: SubscriptionEvent, db: AsyncSession) -> None:
    audit.status = "processed"
    logger.info("subscription.activated: %s", event_data.get("payload", {}).get("subscription", {}).get("entity", {}).get("id"))


async def _handle_subscription_cancelled(event_data: dict, audit: SubscriptionEvent, db: AsyncSession) -> None:
    from sqlalchemy import select
    from app.models.user import User

    try:
        subscription = event_data.get("payload", {}).get("subscription", {}).get("entity", {})
        notes = subscription.get("notes", {})
        user_id = notes.get("user_id")

        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user and user.plan != "free":
                previous_plan = user.plan
                user.plan = "free"
                audit.user_id = user_id
                logger.info("Downgraded user %s from %s to free on cancellation", user_id, previous_plan)

        audit.status = "processed"
    except Exception as exc:
        logger.error("Error processing subscription.cancelled: %s", exc)
        audit.status = "failed"
