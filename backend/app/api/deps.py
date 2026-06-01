"""FastAPI dependencies — DB session, current user (cookie-first, Bearer fallback)."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import decode_token
from app.services.auth_service import get_user_by_id
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

_COOKIE_NAME = "sv_token"


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Cookie takes precedence (httpOnly — not accessible via JS)
    token = request.cookies.get(_COOKIE_NAME)
    # Fall back to Authorization: Bearer header
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("Wrong token type")
        user_id: str = payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user_id == "demo-user" and settings.demo_auth_enabled and settings.environment != "production":
        return User(
            id="demo-user",
            name="Demo Investor",
            email="demo@stockvision.in",
            phone=None,
            plan="premium",
            language="en",
            investing_style="intermediate",
            risk_appetite=6,
            sectors=["Defence", "IT", "Banking"],
            onboarding_completed=True,
        )

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    token = request.cookies.get(_COOKIE_NAME)
    if not token and credentials:
        token = credentials.credentials
    if not token:
        return None
    try:
        payload = decode_token(token)
        return await get_user_by_id(db, payload["sub"])
    except Exception:
        return None
