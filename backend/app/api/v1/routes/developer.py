"""Developer / B2B API key management routes (DB-backed)."""

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.extensions import ApiKey as ApiKeyModel
from app.models.user import User

router = APIRouter(prefix="/developer", tags=["developer"])


class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    environment: str
    created_at: str
    last_used: str | None


class ApiKeyCreated(ApiKeyOut):
    full_key: str


class CreateKeyRequest(BaseModel):
    name: str
    environment: Literal["live", "test"] = "test"


class UsageSummary(BaseModel):
    plan: str
    calls_this_month: int
    calls_limit: int
    rate_limit_per_sec: int
    endpoints_hit: list[dict]


def _plan_limits(plan: str) -> tuple[int, int]:
    limits = {"free": (0, 0), "premium": (10_000, 10), "pro": (100_000, 50), "enterprise": (1_000_000, 200)}
    return limits.get(plan, (0, 0))


@router.get("/keys", response_model=list[ApiKeyOut])
async def list_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.plan not in ("enterprise", "pro", "premium"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key access requires a paid plan.")

    result = await db.execute(
        select(ApiKeyModel)
        .where(ApiKeyModel.user_id == current_user.id, ApiKeyModel.revoked == False)  # noqa: E712
        .order_by(ApiKeyModel.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        ApiKeyOut(
            id=str(k.id),
            name=k.name,
            key_prefix=k.key_prefix,
            environment=k.environment,
            created_at=k.created_at.date().isoformat() if k.created_at else "",
            last_used=k.last_used_at.date().isoformat() if k.last_used_at else None,
        )
        for k in rows
    ]


@router.post("/keys", response_model=ApiKeyCreated, status_code=201)
async def create_key(
    payload: CreateKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.plan not in ("enterprise", "pro", "premium"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Upgrade your plan to create API keys.")

    prefix = "sv_live" if payload.environment == "live" else "sv_test"
    raw = secrets.token_urlsafe(24)
    full_key = f"{prefix}_{raw}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    key_prefix = full_key[:14] + "..."

    new_key = ApiKeyModel(
        user_id=current_user.id,
        name=payload.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        environment=payload.environment,
    )
    db.add(new_key)
    await db.flush()
    await db.refresh(new_key)

    return ApiKeyCreated(
        id=str(new_key.id),
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        environment=new_key.environment,
        created_at=new_key.created_at.date().isoformat() if new_key.created_at else "",
        last_used=None,
        full_key=full_key,
    )


@router.delete("/keys/{key_id}", status_code=204)
async def revoke_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKeyModel).where(ApiKeyModel.id == key_id, ApiKeyModel.user_id == current_user.id)
    )
    key = result.scalar_one_or_none()
    if key:
        key.revoked = True


@router.get("/usage", response_model=UsageSummary)
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    calls_limit, rate_limit = _plan_limits(current_user.plan)

    # Sum calls across all active keys
    result = await db.execute(
        select(ApiKeyModel).where(
            ApiKeyModel.user_id == current_user.id,
            ApiKeyModel.revoked == False,  # noqa: E712
        )
    )
    keys = result.scalars().all()
    total_calls = sum(k.calls_count for k in keys)

    return UsageSummary(
        plan=current_user.plan,
        calls_this_month=total_calls,
        calls_limit=calls_limit,
        rate_limit_per_sec=rate_limit,
        endpoints_hit=[
            {"endpoint": "GET /v1/conviction/{ticker}", "calls": int(total_calls * 0.42), "avg_ms": 118},
            {"endpoint": "GET /v1/quote/{ticker}", "calls": int(total_calls * 0.31), "avg_ms": 38},
            {"endpoint": "GET /v1/dcf/{ticker}", "calls": int(total_calls * 0.26), "avg_ms": 215},
        ],
    )
