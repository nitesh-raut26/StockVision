"""Pydantic schemas for portfolio data."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class HoldingOut(BaseModel):
    ticker: str
    name: str
    qty: int
    avg_price: float
    current_price: float
    current_value: float
    pnl: float
    pnl_pct: float
    broker: str
    sector: str


class PortfolioSummary(BaseModel):
    total_value: float
    total_invested: float
    total_gain: float
    gain_pct: float
    xirr: Optional[float]
    holdings: list[HoldingOut]
    broker_breakdown: list[dict]


class TaxSummary(BaseModel):
    stcg_gains: float
    ltcg_gains: float
    stcg_tax: float
    ltcg_tax: float
    total_tax: float
    tax_saved_potential: float
    harvesting_suggestions: list[dict]


class GoalCreate(BaseModel):
    name: str
    goal_type: str = Field(..., pattern="^(education|home|retirement|emergency|custom)$")
    target_amount: float = Field(..., gt=0)
    target_date: date
    monthly_sip: float = Field(..., gt=0)


class GoalOut(GoalCreate):
    id: str
    current_corpus: float
    projected_corpus: float
    on_track: bool
    completion_pct: float
    suggested_allocation: list[dict]
