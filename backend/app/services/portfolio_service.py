"""Portfolio service — aggregate holdings, compute P&L, XIRR, broker breakdown."""

from datetime import date
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.portfolio import Portfolio, Goal
# Market-data reads go through the provider seam (app/services/market_data).
from app.services.market_data import get_market_data_provider

get_bulk_quotes = get_market_data_provider().get_bulk_quotes
from app.services.tax_calculator import compute_tax_summary


def _xirr(cash_flows: list[tuple[date, float]], guess: float = 0.1) -> float | None:
    """Newton-Raphson XIRR computation."""
    if len(cash_flows) < 2:
        return None
    try:
        dates = [cf[0] for cf in cash_flows]
        amounts = [cf[1] for cf in cash_flows]
        t0 = dates[0]
        days = [(d - t0).days / 365.0 for d in dates]

        rate = guess
        for _ in range(100):
            f = sum(a / (1 + rate) ** t for a, t in zip(amounts, days))
            df = sum(-t * a / (1 + rate) ** (t + 1) for a, t in zip(amounts, days))
            if df == 0:
                break
            new_rate = rate - f / df
            if abs(new_rate - rate) < 1e-7:
                return round(new_rate * 100, 2)
            rate = new_rate
        return None
    except Exception:
        return None


async def get_portfolio_summary(db: AsyncSession, user_id: str) -> dict[str, Any]:
    """Build complete portfolio summary with live prices."""
    # Fetch all portfolios with holdings
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .options(selectinload(Portfolio.holdings), selectinload(Portfolio.transactions))
    )
    portfolios = result.scalars().all()

    if not portfolios:
        return {
            "total_value": 0,
            "total_invested": 0,
            "total_gain": 0,
            "gain_pct": 0,
            "xirr": None,
            "holdings": [],
            "broker_breakdown": [],
        }

    # Collect all unique tickers
    all_holdings = [h for p in portfolios for h in p.holdings]
    tickers = list({h.ticker for h in all_holdings})
    quotes = await get_bulk_quotes(tickers)
    quote_map = {q["ticker"]: q for q in quotes}

    holding_rows = []
    total_value = 0.0
    total_invested = 0.0
    broker_map: dict[str, dict] = {}

    for portfolio in portfolios:
        broker = portfolio.broker
        if broker not in broker_map:
            broker_map[broker] = {"broker": broker, "value": 0.0, "invested": 0.0}

        for h in portfolio.holdings:
            quote = quote_map.get(h.ticker, {})
            current_price = quote.get("price") or h.avg_price
            current_value = current_price * h.qty
            invested = h.avg_price * h.qty
            pnl = current_value - invested
            pnl_pct = (pnl / invested * 100) if invested else 0

            holding_rows.append({
                "ticker": h.ticker,
                "name": h.name,
                "qty": h.qty,
                "avg_price": round(h.avg_price, 2),
                "current_price": round(current_price, 2),
                "current_value": round(current_value, 2),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 2),
                "broker": broker,
                "sector": h.sector or quote.get("sector") or "Unknown",
            })

            total_value += current_value
            total_invested += invested
            broker_map[broker]["value"] += current_value
            broker_map[broker]["invested"] += invested

    total_gain = total_value - total_invested
    gain_pct = (total_gain / total_invested * 100) if total_invested else 0

    # XIRR — build cash flows from transactions
    all_txns = [t for p in portfolios for t in p.transactions]
    cash_flows: list[tuple[date, float]] = []
    for txn in sorted(all_txns, key=lambda t: t.transaction_date):
        amount = txn.price * txn.qty
        if txn.action == "BUY":
            cash_flows.append((txn.transaction_date, -amount))
        else:
            cash_flows.append((txn.transaction_date, amount))
    # Terminal value: current portfolio value today
    cash_flows.append((date.today(), total_value))
    xirr = _xirr(cash_flows)

    broker_breakdown = [
        {
            "broker": b,
            "value": round(v["value"], 2),
            "invested": round(v["invested"], 2),
            "pnl": round(v["value"] - v["invested"], 2),
        }
        for b, v in broker_map.items()
    ]

    return {
        "total_value": round(total_value, 2),
        "total_invested": round(total_invested, 2),
        "total_gain": round(total_gain, 2),
        "gain_pct": round(gain_pct, 2),
        "xirr": xirr,
        "holdings": holding_rows,
        "broker_breakdown": broker_breakdown,
    }


async def get_tax_summary(db: AsyncSession, user_id: str) -> dict[str, Any]:
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .options(selectinload(Portfolio.holdings), selectinload(Portfolio.transactions))
    )
    portfolios = result.scalars().all()

    all_holdings = [
        {
            "ticker": h.ticker,
            "qty": h.qty,
            "avg_price": h.avg_price,
            "current_price": h.avg_price,  # will be updated below
            "buy_date": None,
        }
        for p in portfolios for h in p.holdings
    ]
    all_txns = [
        {
            "ticker": t.ticker,
            "action": t.action,
            "qty": t.qty,
            "price": t.price,
            "transaction_date": t.transaction_date.isoformat(),
        }
        for p in portfolios for t in p.transactions
    ]

    # Get live prices for holdings
    tickers = list({h["ticker"] for h in all_holdings})
    quotes = await get_bulk_quotes(tickers)
    quote_map = {q["ticker"]: q["price"] for q in quotes}
    for h in all_holdings:
        h["current_price"] = quote_map.get(h["ticker"], h["avg_price"])

    return compute_tax_summary(all_holdings, all_txns)


async def get_goals(db: AsyncSession, user_id: str) -> list[dict[str, Any]]:
    result = await db.execute(select(Goal).where(Goal.user_id == user_id))
    goals = result.scalars().all()
    today = date.today()
    output = []
    for g in goals:
        years_left = max((g.target_date - today).days / 365, 0.1)
        # Compound projection at 12% CAGR
        projected = g.current_corpus * (1.12 ** years_left) + g.monthly_sip * 12 * years_left
        completion = min((g.current_corpus / g.target_amount) * 100, 100) if g.target_amount else 0
        on_track = projected >= g.target_amount
        output.append({
            "id": g.id,
            "name": g.name,
            "goal_type": g.goal_type,
            "target_amount": g.target_amount,
            "target_date": g.target_date.isoformat(),
            "monthly_sip": g.monthly_sip,
            "current_corpus": g.current_corpus,
            "projected_corpus": round(projected, 2),
            "on_track": on_track,
            "completion_pct": round(completion, 2),
            "suggested_allocation": g.suggested_allocation or [],
        })
    return output
