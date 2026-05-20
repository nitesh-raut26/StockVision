"""Pydantic schemas for stock data."""

from pydantic import BaseModel, Field
from typing import Optional


class StockQuote(BaseModel):
    ticker: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: int
    market_cap: float
    pe_ratio: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    sector: Optional[str] = None

    class Config:
        from_attributes = True


class StockScreenerFilter(BaseModel):
    min_conviction_score: float = Field(0, ge=0, le=10)
    max_pe: float = Field(200, ge=0, le=1000)
    min_roce: float = Field(0, ge=-100, le=200)
    max_debt_equity: float = Field(5, ge=0, le=100)
    min_promoter_holding: float = Field(0, ge=0, le=100)
    min_revenue_growth: float = Field(-50, ge=-100, le=500)
    sector: Optional[str] = None
    cap: Optional[str] = Field(None, pattern="^(large|mid|small)?$")
    universe: str = Field("nifty200", pattern="^(nifty50|nifty200|nifty500)$")
    sort_by: str = Field(
        "conviction_score",
        pattern="^(conviction_score|upside|change_pct|pe_ratio|market_cap)$",
    )
    limit: int = Field(50, ge=1, le=500)


class StockScreenerResult(BaseModel):
    ticker: str
    name: str
    sector: str
    cap: str = "mid"
    price: float
    change_pct: float
    conviction_score: float
    pe_ratio: Optional[float]
    roce: Optional[float]
    debt_equity: Optional[float]
    promoter_holding: Optional[float]
    revenue_growth: Optional[float]
    target_12m: Optional[float]
    upside: Optional[float]
    risk: str
    market_cap: Optional[float] = None


class ConvictionScoreResponse(BaseModel):
    ticker: str
    score: float = Field(..., ge=0, le=10)
    factors: dict
    rationale: str
    last_updated: str
