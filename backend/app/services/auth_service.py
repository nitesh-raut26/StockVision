"""Authentication service — register, login, OTP verification."""

from datetime import timedelta
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    result = await db.execute(select(User).where(User.phone == phone))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, name: str, email: str | None, phone: str | None, password: str | None) -> User:
    user = User(
        name=name,
        email=email,
        phone=phone,
        hashed_password=hash_password(password) if password else None,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def build_token_response(user: User) -> dict[str, Any]:
    token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "plan": user.plan,
            "language": user.language,
            "investing_style": user.investing_style,
            "risk_appetite": user.risk_appetite,
            "sectors": user.sectors or [],
            "onboarding_completed": user.onboarding_completed,
        },
    }


def build_demo_token_response(email: str | None = None) -> dict[str, Any]:
    token = create_access_token(
        subject="demo-user",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "user": {
            "id": "demo-user",
            "name": "Demo Investor",
            "email": email or "demo@stockvision.in",
            "phone": None,
            "plan": "premium",
            "language": "en",
            "investing_style": "intermediate",
            "risk_appetite": 6,
            "sectors": ["Defence", "IT", "Banking"],
            "onboarding_completed": True,
        },
    }
