"""Family Portfolio routes — manage multiple member accounts under one view."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.portfolio import FamilyMember
from app.models.user import User

router = APIRouter(prefix="/family", tags=["family"])


class FamilyMemberOut(BaseModel):
    id: str
    name: str
    relation: str
    email: Optional[str] = None
    phone: Optional[str] = None
    total_value: float
    total_invested: float
    total_pnl: float
    pnl_pct: float
    xirr: float
    color: str
    permission: str
    invite_status: str


class FamilyMemberCreate(BaseModel):
    name: str
    relation: str
    email: Optional[str] = None
    phone: Optional[str] = None
    total_value: float = 0
    total_invested: float = 0
    color: str = "#4361EE"


class FamilyAggregate(BaseModel):
    total_value: float
    total_invested: float
    total_pnl: float
    pnl_pct: float
    member_count: int
    members: list[FamilyMemberOut]


@router.get("/members", response_model=list[FamilyMemberOut])
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all family members linked to the current user's account."""
    members = await _get_or_seed_members(db, current_user.id, current_user.name)
    return [_serialize_member(member) for member in members]


@router.post("/members", response_model=FamilyMemberOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    payload: FamilyMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a family member with view-only default access."""
    invested = payload.total_invested or payload.total_value
    member = FamilyMember(
        owner_user_id=current_user.id,
        name=payload.name,
        relation=payload.relation,
        email=payload.email,
        phone=payload.phone,
        total_value=payload.total_value,
        total_invested=invested,
        total_pnl=payload.total_value - invested,
        xirr=0.0,
        color=payload.color,
        permission="view_only",
        invite_status="pending" if payload.email or payload.phone else "manual",
    )
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return _serialize_member(member)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a family member link."""
    result = await db.execute(
        select(FamilyMember).where(
            FamilyMember.id == member_id,
            FamilyMember.owner_user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    await db.delete(member)


@router.get("/aggregate", response_model=FamilyAggregate)
async def aggregate_portfolio(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregated family portfolio metrics."""
    members = await _get_or_seed_members(db, current_user.id, current_user.name)
    total_value = sum(member.total_value for member in members)
    total_invested = sum(member.total_invested for member in members)
    total_pnl = total_value - total_invested
    pnl_pct = (total_pnl / total_invested * 100) if total_invested else 0
    return FamilyAggregate(
        total_value=round(total_value, 2),
        total_invested=round(total_invested, 2),
        total_pnl=round(total_pnl, 2),
        pnl_pct=round(pnl_pct, 2),
        member_count=len(members),
        members=[_serialize_member(member) for member in members],
    )


async def _get_or_seed_members(db: AsyncSession, user_id: str, user_name: str) -> list[FamilyMember]:
    result = await db.execute(select(FamilyMember).where(FamilyMember.owner_user_id == user_id))
    members = list(result.scalars().all())
    if members:
        return members

    seed = [
        FamilyMember(
            owner_user_id=user_id,
            name=user_name or "Self",
            relation="Self",
            total_value=1_850_000,
            total_invested=1_500_000,
            total_pnl=350_000,
            xirr=22.1,
            color="#4361EE",
            permission="owner",
            invite_status="active",
        ),
        FamilyMember(
            owner_user_id=user_id,
            name="Spouse",
            relation="Spouse",
            total_value=920_000,
            total_invested=800_000,
            total_pnl=120_000,
            xirr=13.8,
            color="#A78BFA",
            permission="view_only",
            invite_status="sample",
        ),
    ]
    db.add_all(seed)
    await db.flush()
    return seed


def _serialize_member(member: FamilyMember) -> FamilyMemberOut:
    pnl_pct = (member.total_pnl / member.total_invested * 100) if member.total_invested else 0
    return FamilyMemberOut(
        id=member.id,
        name=member.name,
        relation=member.relation,
        email=member.email,
        phone=member.phone,
        total_value=round(member.total_value, 2),
        total_invested=round(member.total_invested, 2),
        total_pnl=round(member.total_pnl, 2),
        pnl_pct=round(pnl_pct, 2),
        xirr=round(member.xirr, 2),
        color=member.color,
        permission=member.permission,
        invite_status=member.invite_status,
    )
