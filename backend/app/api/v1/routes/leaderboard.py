"""Leaderboard routes — top portfolios by returns (anonymized)."""

from typing import Literal
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.models.portfolio import Portfolio
from app.models.user import User
from app.services.portfolio_service import get_portfolio_summary

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    avatar_seed: str
    returns_pct: float
    portfolio_value: float
    top_holding: str
    period: str
    is_user: bool = False


@router.get("/", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    period: Literal["1W", "1M", "3M", "1Y", "ALL"] = Query(default="1Y"),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return anonymized portfolio rankings for the given period."""
    result = await db.execute(
        select(Portfolio).options(selectinload(Portfolio.holdings)).limit(250)
    )
    portfolios = result.scalars().all()

    entries: list[LeaderboardEntry] = []
    by_user: dict[str, dict] = {}
    for portfolio in portfolios:
        row = by_user.setdefault(
            portfolio.user_id,
            {"value": 0.0, "invested": 0.0, "top_holding": "N/A", "top_value": 0.0},
        )
        for holding in portfolio.holdings:
            value = holding.qty * holding.avg_price
            row["value"] += value
            row["invested"] += value
            if value > row["top_value"]:
                row["top_value"] = value
                row["top_holding"] = holding.ticker

    for user_id, row in by_user.items():
        returns_pct = ((row["value"] - row["invested"]) / row["invested"] * 100) if row["invested"] else 0
        entries.append(
            LeaderboardEntry(
                rank=0,
                display_name=f"Investor #{abs(hash(user_id)) % 10000:04d}",
                avatar_seed=user_id[:8],
                returns_pct=round(returns_pct, 2),
                portfolio_value=round(row["value"], 2),
                top_holding=row["top_holding"],
                period=period,
                is_user=user_id == current_user.id,
            )
        )

    if not entries:
        entries = _sample_entries(period)

    entries.sort(key=lambda item: item.returns_pct, reverse=True)
    for index, entry in enumerate(entries, start=1):
        entry.rank = index
    return entries[:limit]


@router.get("/my-rank")
async def my_rank(
    period: Literal["1W", "1M", "3M", "1Y", "ALL"] = Query(default="1Y"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's rank on the leaderboard."""
    summary = await get_portfolio_summary(db, current_user.id)
    if not summary["total_invested"]:
        return {
            "rank": None,
            "returns_pct": None,
            "message": "Your rank will appear once you log at least one transaction.",
        }
    entries = await get_leaderboard(period=period, limit=100, db=db, current_user=current_user)
    current = next((entry for entry in entries if entry.is_user), None)
    return {
        "rank": current.rank if current else None,
        "returns_pct": summary["gain_pct"],
        "message": "Rank calculated from logged portfolio data.",
    }


def _sample_entries(period: str) -> list[LeaderboardEntry]:
    return [
        LeaderboardEntry(rank=1, display_name="Bull Rider", avatar_seed="bull1", returns_pct=42.7, portfolio_value=4_280_000, top_holding="RELIANCE", period=period),
        LeaderboardEntry(rank=2, display_name="Alpha Seeker", avatar_seed="alpha2", returns_pct=31.3, portfolio_value=3_120_000, top_holding="HAL", period=period),
        LeaderboardEntry(rank=3, display_name="Dividend Baron", avatar_seed="div4", returns_pct=24.2, portfolio_value=1_800_000, top_holding="HDFCBANK", period=period),
        LeaderboardEntry(rank=4, display_name="Momentum Master", avatar_seed="mom5", returns_pct=18.9, portfolio_value=1_560_000, top_holding="INFY", period=period),
    ]
