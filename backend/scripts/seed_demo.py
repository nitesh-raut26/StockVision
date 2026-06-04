"""Idempotent demo seed — a stable tenant the app can render against.

Run (from the backend dir, with DATABASE_URL pointing at a migrated DB):

    python scripts/seed_demo.py

Creates (if missing): a demo user, a portfolio, a handful of immutable ledger
entries (so /portfolio/transactions/derived-holdings has data), and a watchlist.
Safe to run repeatedly — it checks for the demo user by email first.
"""

import asyncio
import os
import sys
from datetime import date

# Make `app` importable when run as a plain script from the backend dir.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.portfolio import Portfolio, WatchlistItem  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.ledger_service import derive_holdings, record_entry  # noqa: E402

DEMO_EMAIL = "demo@stockvision.in"

_DEMO_TRADES = [
    ("RELIANCE", "BUY", 10, 2800.0, date(2026, 1, 10)),
    ("HAL", "BUY", 5, 4000.0, date(2026, 1, 15)),
    ("HAL", "BUY", 5, 4200.0, date(2026, 2, 1)),
    ("INFY", "BUY", 12, 1580.0, date(2026, 2, 12)),
    ("HAL", "SELL", 4, 4500.0, date(2026, 3, 5)),
    ("TCS", "BUY", 6, 3900.0, date(2026, 3, 20)),
]
_DEMO_WATCHLIST = ["BEL", "IDEAFORGE", "TATAPOWER"]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        if existing.scalar_one_or_none():
            print(f"✓ Demo user {DEMO_EMAIL} already exists — nothing to seed.")
            return

        user = User(
            name="Demo Investor",
            email=DEMO_EMAIL,
            plan="premium",
            language="en",
            investing_style="intermediate",
            risk_appetite=6,
            sectors=["Defence", "IT", "Banking"],
            onboarding_completed=True,
        )
        db.add(user)
        await db.flush()  # assign user.id

        db.add(Portfolio(user_id=user.id, broker="Manual", broker_account_id=None))

        for ticker, action, qty, price, trade_date in _DEMO_TRADES:
            await record_entry(
                db, user_id=user.id, ticker=ticker, action=action,
                qty=qty, price=price, trade_date=trade_date, source="manual",
            )

        for ticker in _DEMO_WATCHLIST:
            db.add(WatchlistItem(user_id=user.id, ticker=ticker))

        await db.commit()

        derived = derive_holdings([
            {"ticker": t, "action": a, "qty": q, "price": p, "trade_date": d, "fees": 0}
            for (t, a, q, p, d) in _DEMO_TRADES
        ])
        print(f"✓ Seeded demo user {user.id} ({DEMO_EMAIL})")
        print(f"  {len(_DEMO_TRADES)} ledger entries → {len(derived)} open positions: {sorted(derived)}")
        print(f"  watchlist: {_DEMO_WATCHLIST}")


if __name__ == "__main__":
    asyncio.run(seed())
