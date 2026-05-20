"""Research Library routes — analyst reports, sector notes, and uploads."""

from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.portfolio import ResearchReport
from app.models.user import User

router = APIRouter(prefix="/research", tags=["research"])


class ResearchItem(BaseModel):
    id: str
    title: str
    summary: str
    analyst: str
    sector: str
    ticker: Optional[str] = None
    report_type: Literal["INITIATION", "EARNINGS_UPDATE", "SECTOR_NOTE", "THEME"]
    rating: Optional[Literal["BUY", "HOLD", "SELL"]] = None
    target_price: Optional[float] = None
    confidence: float
    published_at: str
    pdf_url: Optional[str] = None
    tags: list[str] = []


class ResearchCreate(BaseModel):
    title: str
    summary: str
    analyst: str = "StockVision Research"
    sector: str
    ticker: Optional[str] = None
    report_type: Literal["INITIATION", "EARNINGS_UPDATE", "SECTOR_NOTE", "THEME"] = "THEME"
    rating: Optional[Literal["BUY", "HOLD", "SELL"]] = None
    target_price: Optional[float] = None
    confidence: float = 7.5
    pdf_url: Optional[str] = None
    tags: list[str] = []


@router.get("/", response_model=list[ResearchItem])
async def list_reports(
    sector: Optional[str] = Query(None),
    ticker: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return research reports with optional filters."""
    reports = await _get_or_seed_reports(db)
    if sector:
        reports = [report for report in reports if sector.lower() in report.sector.lower()]
    if ticker:
        reports = [report for report in reports if report.ticker == ticker.upper()]
    if report_type:
        reports = [report for report in reports if report.report_type == report_type.upper()]
    return [_serialize_report(report) for report in reports[:limit]]


@router.post("/", response_model=ResearchItem, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ResearchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a research report record. PDF storage can be attached via pdf_url."""
    report = ResearchReport(
        user_id=current_user.id,
        title=payload.title,
        summary=payload.summary,
        analyst=payload.analyst,
        sector=payload.sector,
        ticker=payload.ticker.upper() if payload.ticker else None,
        report_type=payload.report_type,
        rating=payload.rating,
        target_price=payload.target_price,
        confidence=payload.confidence,
        pdf_url=payload.pdf_url,
        tags=payload.tags,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return _serialize_report(report)


@router.get("/{report_id}", response_model=ResearchItem)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single research report by ID."""
    await _get_or_seed_reports(db)
    result = await db.execute(select(ResearchReport).where(ResearchReport.id == report_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _serialize_report(item)


async def _get_or_seed_reports(db: AsyncSession) -> list[ResearchReport]:
    result = await db.execute(select(ResearchReport).order_by(ResearchReport.created_at.desc()))
    reports = list(result.scalars().all())
    if reports:
        return reports

    seed = [
        ResearchReport(
            title="Reliance Industries — Initiating Coverage",
            summary="Diversified conglomerate with telecom, retail, O2C, and new energy optionality. Jio ARPU and retail margin expansion remain key catalysts.",
            analyst="StockVision Research",
            sector="Energy / Telecom",
            ticker="RELIANCE",
            report_type="INITIATION",
            rating="BUY",
            target_price=3200,
            confidence=8.4,
            tags=["large-cap", "conviction"],
        ),
        ResearchReport(
            title="Indian IT Sector — Q4 Preview",
            summary="Macro headwinds are weighing on discretionary tech spending. Margin resilience and order book quality separate leaders from laggards.",
            analyst="StockVision Research",
            sector="IT",
            ticker=None,
            report_type="SECTOR_NOTE",
            rating=None,
            target_price=None,
            confidence=7.6,
            tags=["sector", "IT", "preview"],
        ),
        ResearchReport(
            title="India AI Theme — 2026 Outlook",
            summary="Data centers, power equipment, semiconductor supply chain, and AI-adjacent software remain the highest-probability public market themes.",
            analyst="StockVision Research",
            sector="Technology",
            ticker=None,
            report_type="THEME",
            rating=None,
            target_price=None,
            confidence=8.1,
            tags=["theme", "AI", "2026"],
        ),
    ]
    db.add_all(seed)
    await db.flush()
    return seed


def _serialize_report(report: ResearchReport) -> ResearchItem:
    return ResearchItem(
        id=report.id,
        title=report.title,
        summary=report.summary,
        analyst=report.analyst,
        sector=report.sector,
        ticker=report.ticker,
        report_type=report.report_type,  # type: ignore[arg-type]
        rating=report.rating,  # type: ignore[arg-type]
        target_price=report.target_price,
        confidence=round(report.confidence, 1),
        published_at=report.created_at.date().isoformat(),
        pdf_url=report.pdf_url,
        tags=report.tags or [],
    )
