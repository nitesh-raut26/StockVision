"""Append-only trade ledger — the immutable source of truth for positions & tax.

Holdings are *derived* from the ledger (FIFO), never mutated in place, so every
position is auditable and rebuildable. `record_entry()` only ever inserts; nothing
here updates or deletes a ledger row.
"""

from collections import defaultdict, deque
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.portfolio import LedgerEntry


async def record_entry(
    db: AsyncSession,
    *,
    user_id: str,
    ticker: str,
    action: str,
    qty: float,
    price: float,
    trade_date: date | None = None,
    fees: float = 0,
    source: str = "manual",
    broker: str | None = None,
    external_id: str | None = None,
    note: str | None = None,
) -> LedgerEntry:
    """Append one immutable ledger entry. Does NOT commit — the caller owns the txn,
    so the trade and its ledger row commit atomically."""
    entry = LedgerEntry(
        user_id=user_id,
        ticker=ticker.upper(),
        action=action.upper(),
        qty=Decimal(str(qty)),
        price=Decimal(str(price)),
        fees=Decimal(str(fees or 0)),
        trade_date=trade_date or date.today(),
        source=source,
        broker=broker,
        external_id=external_id,
        note=note,
    )
    db.add(entry)
    return entry


async def fetch_ledger(
    db: AsyncSession,
    user_id: str,
    ticker: str | None = None,
    limit: int = 500,
    ascending: bool = False,
) -> list[LedgerEntry]:
    q = select(LedgerEntry).where(LedgerEntry.user_id == user_id)
    if ticker:
        q = q.where(LedgerEntry.ticker == ticker.upper())
    if ascending:
        q = q.order_by(LedgerEntry.trade_date.asc(), LedgerEntry.created_at.asc())
    else:
        q = q.order_by(desc(LedgerEntry.trade_date), desc(LedgerEntry.created_at))
    rows = await db.execute(q.limit(limit))
    return list(rows.scalars().all())


def derive_holdings(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """FIFO reconstruction of current holdings from append-only ledger entries.

    `entries`: dicts with ticker, action, qty, price, fees, trade_date. They are
    ordered by trade_date then original position (pass oldest-first for correct
    intraday FIFO). Returns one row per still-held ticker with qty, avg_cost,
    invested, realized P&L, and cumulative fees.
    """
    ordered = sorted(enumerate(entries), key=lambda pair: (pair[1]["trade_date"], pair[0]))

    lots: dict[str, deque] = defaultdict(deque)  # ticker -> deque of [qty, price]
    realized: dict[str, float] = defaultdict(float)
    fees_total: dict[str, float] = defaultdict(float)

    for _, e in ordered:
        ticker = str(e["ticker"]).upper()
        qty = float(e["qty"])
        price = float(e["price"])
        fees_total[ticker] += float(e.get("fees") or 0)

        if str(e["action"]).upper() == "BUY":
            lots[ticker].append([qty, price])
        else:  # SELL — consume oldest lots first
            remaining = qty
            while remaining > 1e-9 and lots[ticker]:
                lot = lots[ticker][0]
                take = min(remaining, lot[0])
                realized[ticker] += take * (price - lot[1])
                lot[0] -= take
                remaining -= take
                if lot[0] <= 1e-9:
                    lots[ticker].popleft()

    holdings: dict[str, dict[str, Any]] = {}
    for ticker, lot_q in lots.items():
        total_qty = sum(lot[0] for lot in lot_q)
        if total_qty <= 1e-9:
            continue
        invested = sum(lot[0] * lot[1] for lot in lot_q)
        holdings[ticker] = {
            "ticker": ticker,
            "qty": round(total_qty, 6),
            "avg_cost": round(invested / total_qty, 2),
            "invested": round(invested, 2),
            "realized_pnl": round(realized.get(ticker, 0.0), 2),
            "fees": round(fees_total.get(ticker, 0.0), 2),
        }
    return holdings


def ledger_entry_to_dict(e: LedgerEntry) -> dict[str, Any]:
    return {
        "id": e.id,
        "ticker": e.ticker,
        "action": e.action,
        "qty": float(e.qty),
        "price": float(e.price),
        "fees": float(e.fees),
        "trade_date": e.trade_date.isoformat() if e.trade_date else None,
        "source": e.source,
        "broker": e.broker,
        "external_id": e.external_id,
        "note": e.note,
        "recorded_at": e.created_at.isoformat() if e.created_at else None,
    }


def ledger_to_tax_transactions(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map ledger-entry dicts to the shape tax_calculator.compute_tax_summary expects,
    so capital-gains tax is computed from the immutable ledger (source of truth)."""
    return [
        {
            "ticker": e["ticker"],
            "action": str(e["action"]).upper(),
            "qty": int(round(float(e["qty"]))),
            "price": float(e["price"]),
            "transaction_date": e["trade_date"],
        }
        for e in entries
    ]


def derived_to_tax_holdings(
    derived: dict[str, dict[str, Any]], price_map: dict[str, float],
) -> list[dict[str, Any]]:
    """Map FIFO-derived holdings + current prices into tax_calculator holding dicts
    (used for tax-loss-harvesting suggestions)."""
    return [
        {
            "ticker": ticker,
            "qty": int(round(h["qty"])),
            "avg_price": h["avg_cost"],
            "current_price": price_map.get(ticker, h["avg_cost"]),
        }
        for ticker, h in derived.items()
    ]
