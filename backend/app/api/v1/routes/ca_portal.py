"""CA Portal routes — chartered accountant multi-client dashboard."""

import csv
import io
from datetime import datetime, timezone
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.portfolio import CAClient
from app.models.user import User
from app.services.ca_report import build_ca_report, render_ca_report_html

router = APIRouter(prefix="/ca", tags=["ca-portal"])


class CAClientOut(BaseModel):
    id: str
    name: str
    pan: str
    email: Optional[str] = None
    phone: Optional[str] = None
    filing_status: Literal["PENDING", "IN_PROGRESS", "FILED", "OVERDUE"]
    tax_year: str
    total_gains: float
    total_tax: float
    last_updated: str


class CAClientCreate(BaseModel):
    name: str
    pan: str
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_year: str = "FY2025-26"
    total_gains: float = 0
    total_tax: float = 0


@router.get("/clients", response_model=list[CAClientOut])
async def list_clients(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all clients for the logged-in CA/RIA workspace."""
    clients = await _get_or_seed_clients(db, current_user.id)
    if status_filter:
        clients = [client for client in clients if client.filing_status == status_filter.upper()]
    return [_serialize_client(client) for client in clients]


@router.post("/clients", response_model=CAClientOut, status_code=status.HTTP_201_CREATED)
async def add_client(
    payload: CAClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new client to the CA portal."""
    client = CAClient(
        ca_user_id=current_user.id,
        name=payload.name,
        pan=payload.pan.upper(),
        email=payload.email,
        phone=payload.phone,
        tax_year=payload.tax_year,
        total_gains=payload.total_gains,
        total_tax=payload.total_tax,
        filing_status="PENDING",
    )
    db.add(client)
    await db.flush()
    await db.refresh(client)
    return _serialize_client(client)


@router.get("/clients/{client_id}", response_model=CAClientOut)
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return details for a single client."""
    client = await _get_client_or_404(db, current_user.id, client_id)
    return _serialize_client(client)


@router.get("/clients/{client_id}/report.json")
async def client_report_json(
    client_id: str,
    firm: Optional[str] = Query(None, description="White-label firm name override"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Structured data behind a client's branded report."""
    client = await _get_client_or_404(db, current_user.id, client_id)
    firm_name = firm or current_user.name or "Advisory Firm"
    return build_ca_report(firm_name, _serialize_client(client).model_dump())


@router.get("/clients/{client_id}/report", response_class=HTMLResponse)
async def client_report_html(
    client_id: str,
    firm: Optional[str] = Query(None, description="White-label firm name override"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Branded, print-ready HTML report — open in a tab, then print / save as PDF."""
    client = await _get_client_or_404(db, current_user.id, client_id)
    firm_name = firm or current_user.name or "Advisory Firm"
    report = build_ca_report(firm_name, _serialize_client(client).model_dump())
    return HTMLResponse(render_ca_report_html(report))


@router.get("/export/{client_id}")
async def export_client_report(
    client_id: str,
    format: Literal["csv", "xlsx", "pdf"] = Query(default="csv"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a client's tax summary. CSV is implemented; PDF/XLSX return a clear upgrade path."""
    client = await _get_client_or_404(db, current_user.id, client_id)
    if format != "csv":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{format.upper()} export requires the document export worker. CSV export is available now.",
        )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Client", "PAN", "Tax Year", "Filing Status", "Total Gains", "Estimated Tax", "Last Updated"])
    writer.writerow([
        client.name,
        client.pan,
        client.tax_year,
        client.filing_status,
        client.total_gains,
        client.total_tax,
        client.last_reviewed_at.date().isoformat(),
    ])
    buffer.seek(0)
    filename = f"stockvision-{client.pan}-{client.tax_year}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/clients/{client_id}/status", response_model=CAClientOut)
async def update_filing_status(
    client_id: str,
    new_status: Literal["PENDING", "IN_PROGRESS", "FILED", "OVERDUE"],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the filing status of a client."""
    client = await _get_client_or_404(db, current_user.id, client_id)
    client.filing_status = new_status
    client.last_reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(client)
    return _serialize_client(client)


async def _get_or_seed_clients(db: AsyncSession, user_id: str) -> list[CAClient]:
    result = await db.execute(select(CAClient).where(CAClient.ca_user_id == user_id))
    clients = list(result.scalars().all())
    if clients:
        return clients

    seed = [
        CAClient(
            ca_user_id=user_id,
            name="Ramesh Sharma",
            pan="ABCDE1234F",
            email="ramesh@example.com",
            filing_status="FILED",
            tax_year="FY2025-26",
            total_gains=450_000,
            total_tax=67_500,
        ),
        CAClient(
            ca_user_id=user_id,
            name="Priya Mehta",
            pan="FGHIJ5678K",
            email="priya@example.com",
            filing_status="IN_PROGRESS",
            tax_year="FY2025-26",
            total_gains=1_200_000,
            total_tax=144_000,
        ),
        CAClient(
            ca_user_id=user_id,
            name="Vikram Patel",
            pan="LMNOP9012Q",
            filing_status="PENDING",
            tax_year="FY2025-26",
            total_gains=80_000,
            total_tax=6_000,
        ),
    ]
    db.add_all(seed)
    await db.flush()
    return seed


async def _get_client_or_404(db: AsyncSession, user_id: str, client_id: str) -> CAClient:
    await _get_or_seed_clients(db, user_id)
    result = await db.execute(
        select(CAClient).where(
            CAClient.id == client_id,
            CAClient.ca_user_id == user_id,
        )
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


def _serialize_client(client: CAClient) -> CAClientOut:
    return CAClientOut(
        id=client.id,
        name=client.name,
        pan=client.pan,
        email=client.email,
        phone=client.phone,
        filing_status=client.filing_status,  # type: ignore[arg-type]
        tax_year=client.tax_year,
        total_gains=round(client.total_gains, 2),
        total_tax=round(client.total_tax, 2),
        last_updated=client.last_reviewed_at.date().isoformat(),
    )
