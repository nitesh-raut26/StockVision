"""Portfolio transaction routes — log BUY/SELL trades."""

from datetime import date
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.portfolio import Holding, Portfolio, Transaction

router = APIRouter(prefix="/portfolio/transactions", tags=["transactions"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20, example="RELIANCE")
    action: Literal["BUY", "SELL"]
    qty: int = Field(..., gt=0, le=1_000_000, description="Max 10 lakh units per trade")
    price: float = Field(..., gt=0, le=1_000_000, description="Max ₹10 lakh per unit")
    trade_date: Optional[date] = None
    exchange: str = Field(default="NSE", example="NSE", max_length=10)
    broker: Optional[str] = Field(default=None, max_length=50, example="Zerodha")
    charges: float = Field(default=0.0, ge=0, le=100_000, description="Max ₹1 lakh in charges")
    notes: Optional[str] = Field(default=None, max_length=500)


class TransactionOut(BaseModel):
    id: str
    portfolio_id: str
    ticker: str
    action: Literal["BUY", "SELL"]
    qty: int
    price: float
    trade_date: date
    exchange: str = "NSE"
    broker: str
    charges: float
    notes: Optional[str] = None
    created_at: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[TransactionOut])
async def list_transactions(
    ticker: Optional[str] = Query(None, description="Filter by ticker"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all transactions for the current user, newest first."""
    q = (
        select(Transaction, Portfolio.broker)
        .join(Portfolio, Transaction.portfolio_id == Portfolio.id)
        .where(Portfolio.user_id == current_user.id)
    )
    if ticker:
        q = q.where(Transaction.ticker == ticker.upper())
    q = q.order_by(desc(Transaction.transaction_date)).limit(limit)
    result = await db.execute(q)
    return [
        _serialize_transaction(tx, broker)
        for tx, broker in result.all()
    ]


@router.post("/", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a BUY or SELL transaction. Updates portfolio holdings automatically."""
    broker = payload.broker or "Manual"
    ticker = payload.ticker.upper()
    trade_date = payload.trade_date or date.today()

    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == current_user.id,
            Portfolio.broker == broker,
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()
    if portfolio is None:
        portfolio = Portfolio(
            user_id=current_user.id,
            broker=broker,
            broker_account_id=None,
        )
        db.add(portfolio)
        await db.flush()

    holding_result = await db.execute(
        select(Holding).where(
            Holding.portfolio_id == portfolio.id,
            Holding.ticker == ticker,
        )
    )
    holding = holding_result.scalar_one_or_none()

    if payload.action == "BUY":
        if holding:
            previous_value = holding.qty * holding.avg_price
            new_value = payload.qty * payload.price
            holding.qty += payload.qty
            holding.avg_price = (previous_value + new_value) / holding.qty
        else:
            holding = Holding(
                portfolio_id=portfolio.id,
                ticker=ticker,
                name=ticker,
                qty=payload.qty,
                avg_price=payload.price,
                sector=None,
            )
            db.add(holding)
    else:
        if holding is None or holding.qty < payload.qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot sell more quantity than currently held in this broker portfolio.",
            )
        holding.qty -= payload.qty
        if holding.qty == 0:
            await db.delete(holding)

    tx = Transaction(
        portfolio_id=portfolio.id,
        ticker=ticker,
        action=payload.action,
        qty=payload.qty,
        price=payload.price,
        transaction_date=trade_date,
        charges=payload.charges,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return _serialize_transaction(tx, broker, payload.exchange, payload.notes)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a logged transaction (does not undo broker-executed trades)."""
    result = await db.execute(
        select(Transaction)
        .join(Portfolio, Transaction.portfolio_id == Portfolio.id)
        .where(
            Transaction.id == transaction_id,
            Portfolio.user_id == current_user.id,
        )
    )
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)
    await db.commit()


def _serialize_transaction(
    tx: Transaction,
    broker: str,
    exchange: str = "NSE",
    notes: Optional[str] = None,
) -> dict:
    return {
        "id": tx.id,
        "portfolio_id": tx.portfolio_id,
        "ticker": tx.ticker,
        "action": tx.action,
        "qty": tx.qty,
        "price": tx.price,
        "trade_date": tx.transaction_date,
        "exchange": exchange,
        "broker": broker,
        "charges": tx.charges,
        "notes": notes,
        "created_at": tx.created_at.isoformat(),
    }
