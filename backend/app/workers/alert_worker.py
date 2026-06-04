"""Background alert-evaluation worker.

Runs every 120 seconds via APScheduler (AsyncIOScheduler).

Flow:
  1. Load all active, un-triggered alerts from the DB.
  2. Batch-fetch current prices for every unique ticker.
  3. Evaluate each alert condition against the live price.
  4. On condition met: mark alert triggered, create a Notification row.
  5. Commit in one transaction.

Alert conditions:
  above      — price > threshold (e.g., "notify when RELIANCE > 3000")
  below      — price < threshold (e.g., "notify when HDFC < 1500")
  pct_change — |change_pct| >= threshold (intraday move alert)
"""

import logging
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.extensions import Notification
from app.models.portfolio import Alert

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _evaluate_alerts() -> None:
    """Single sweep — called every 120 s by the scheduler."""
    # Import inside function to avoid circular import at module load time
    from app.services.market_data import get_market_data_provider  # noqa: PLC0415
    get_bulk_quotes = get_market_data_provider().get_bulk_quotes

    async with AsyncSessionLocal() as db:
        try:
            # ── 1. Fetch active, un-triggered alerts ─────────────────────
            result = await db.execute(
                select(Alert).where(
                    Alert.active.is_(True),
                    Alert.triggered.is_(False),
                )
            )
            alerts: list[Alert] = list(result.scalars().all())

            if not alerts:
                return

            # ── 2. Batch price fetch (one round-trip per unique ticker) ──
            tickers = list({a.ticker for a in alerts})
            quotes: list[dict[str, Any]] = await get_bulk_quotes(tickers)
            price_map: dict[str, dict[str, Any]] = {
                q["ticker"]: q for q in quotes if "ticker" in q
            }

            # ── 3. Evaluate each alert ───────────────────────────────────
            triggered_count = 0
            deliveries: list[dict[str, Any]] = []  # dispatched best-effort after commit
            for alert in alerts:
                quote = price_map.get(alert.ticker)
                if not quote:
                    continue  # price unavailable — skip this cycle

                price: float = float(quote.get("price", 0) or 0)
                change_pct: float = float(quote.get("change_pct", 0) or 0)
                threshold = float(alert.threshold)

                fired = False
                body = ""

                if alert.condition == "above" and price > threshold:
                    fired = True
                    body = (
                        f"{alert.ticker} crossed ₹{threshold:,.0f} — "
                        f"now at ₹{price:,.2f}"
                    )
                elif alert.condition == "below" and price < threshold:
                    fired = True
                    body = (
                        f"{alert.ticker} dropped below ₹{threshold:,.0f} — "
                        f"now at ₹{price:,.2f}"
                    )
                elif alert.condition == "pct_change" and abs(change_pct) >= threshold:
                    direction = "up" if change_pct > 0 else "down"
                    fired = True
                    body = (
                        f"{alert.ticker} moved {direction} {abs(change_pct):.1f}% — "
                        f"alert threshold was {threshold:.1f}%"
                    )

                if fired:
                    # One-shot: de-activate after first trigger.
                    # Users can re-arm via the UI (PATCH /alerts/{id}).
                    alert.triggered = True
                    alert.active = False

                    db.add(
                        Notification(
                            user_id=alert.user_id,
                            type="alert",
                            title=f"Price Alert: {alert.ticker}",
                            body=body,
                        )
                    )
                    triggered_count += 1
                    deliveries.append({
                        "user_id": alert.user_id,
                        "title": f"Price Alert: {alert.ticker}",
                        "body": body,
                    })
                    logger.info(
                        "Alert fired — user=%s ticker=%s condition=%s price=%.2f threshold=%.2f",
                        alert.user_id,
                        alert.ticker,
                        alert.condition,
                        price,
                        threshold,
                    )

            # ── 4. Persist all changes in one commit ─────────────────────
            if triggered_count:
                await db.commit()
                logger.info(
                    "Alert sweep: %d/%d alerts triggered", triggered_count, len(alerts)
                )

                # ── 5. Deliver via notification channels (best-effort) ───
                await _deliver_notifications(db, deliveries)

        except Exception as exc:
            logger.error("Alert evaluation error: %s", exc, exc_info=True)
            await db.rollback()


async def _deliver_notifications(db, deliveries: list[dict[str, Any]]) -> None:
    """Best-effort delivery of triggered alerts via the configured channels.
    Runs after commit and never raises — a delivery failure must not undo a
    committed trigger. The Log channel guarantees at least an audit-trail delivery."""
    if not deliveries:
        return
    from app.models.user import User  # noqa: PLC0415
    from app.services.notifications import NotificationMessage, dispatch  # noqa: PLC0415

    try:
        user_ids = list({d["user_id"] for d in deliveries})
        rows = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {u.id: u for u in rows.scalars().all()}
        for d in deliveries:
            user = users.get(d["user_id"])
            results = await dispatch(NotificationMessage(
                user_id=d["user_id"],
                title=d["title"],
                body=d["body"],
                email=getattr(user, "email", None),
                phone=getattr(user, "phone", None),
                category="alert",
            ))
            ok_channels = [r.channel for r in results if r.ok]
            logger.info("Alert delivered via %s — user=%s", ok_channels or ["none"], d["user_id"])
    except Exception as exc:
        logger.warning("Notification delivery error (best-effort): %s", exc)


def start_alert_worker() -> "AsyncIOScheduler":
    """Start the alert evaluation scheduler. Call once at app startup."""
    global _scheduler  # noqa: PLW0603

    if _scheduler is not None and _scheduler.running:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
    _scheduler.add_job(
        _evaluate_alerts,
        trigger="interval",
        seconds=120,
        id="alert_sweep",
        max_instances=1,  # never overlap if one run is slow
        coalesce=True,    # skip missed runs accumulated during downtime
    )
    _scheduler.start()
    logger.info("Alert worker started — evaluating every 120 s")
    return _scheduler


def stop_alert_worker() -> None:
    """Gracefully stop the scheduler. Called at app shutdown."""
    global _scheduler  # noqa: PLW0603

    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Alert worker stopped")
    _scheduler = None
