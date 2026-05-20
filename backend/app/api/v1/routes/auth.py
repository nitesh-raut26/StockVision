"""Authentication routes — register, login, refresh, profile update, password reset."""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import (
    UserCreate, UserLogin, TokenResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest, UpdateMeRequest,
)
from app.services.auth_service import (
    get_user_by_email,
    get_user_by_id,
    create_user,
    authenticate_user,
    build_token_response,
    build_demo_token_response,
)
from app.core.config import settings
from app.core.security import create_refresh_token, decode_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_NAME = "sv_token"
_REFRESH_COOKIE = "sv_refresh"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    is_prod = settings.is_production
    response.set_cookie(
        key=_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/api/v1/auth/refresh",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(_COOKIE_NAME, path="/")
    response.delete_cookie(_REFRESH_COOKIE, path="/api/v1/auth/refresh")


async def _check_login_rate_limit(request: Request, email: str) -> None:
    """Per-email brute-force protection using Redis."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            key = f"login_fails:{email.lower()}"
            fails = int(await r.get(key) or 0)
            if fails >= 10:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed attempts. Please wait 15 minutes.",
                )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis unavailable — allow request but log


async def _record_login_failure(email: str) -> None:
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            key = f"login_fails:{email.lower()}"
            await r.incr(key)
            await r.expire(key, 900)  # 15-minute window
    except Exception:
        pass


async def _clear_login_failures(email: str) -> None:
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            await r.delete(f"login_fails:{email.lower()}")
    except Exception:
        pass


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        if body.email:
            existing = await get_user_by_email(db, str(body.email))
            if existing:
                raise HTTPException(status_code=409, detail="Email already registered")
        user = await create_user(db, body.name, str(body.email) if body.email else None, body.phone, body.password)
        token_data = build_token_response(user)
        _jti, refresh = create_refresh_token(user.id)
        _set_auth_cookies(response, token_data["access_token"], refresh)
        return token_data
    except HTTPException:
        raise
    except Exception:
        if settings.demo_auth_enabled and settings.environment != "production":
            demo = build_demo_token_response(str(body.email) if body.email else None)
            _jti, refresh = create_refresh_token("demo-user")
            _set_auth_cookies(response, demo["access_token"], refresh)
            return demo
        raise


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    if body.email and body.password:
        await _check_login_rate_limit(request, str(body.email))
        try:
            user = await authenticate_user(db, str(body.email), body.password)
            if not user:
                await _record_login_failure(str(body.email))
                raise HTTPException(status_code=401, detail="Invalid credentials")
            await _clear_login_failures(str(body.email))
            token_data = build_token_response(user)
            _jti, refresh = create_refresh_token(user.id)
            _set_auth_cookies(response, token_data["access_token"], refresh)
            return token_data
        except HTTPException:
            raise
        except Exception:
            if settings.demo_auth_enabled and settings.environment != "production":
                demo = build_demo_token_response(str(body.email))
                _jti, refresh = create_refresh_token("demo-user")
                _set_auth_cookies(response, demo["access_token"], refresh)
                return demo
            raise
    raise HTTPException(status_code=400, detail="Provide email+password or phone+otp")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Issue a new access token using the refresh token cookie."""
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id: str = payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if user_id == "demo-user" and settings.demo_auth_enabled:
        demo = build_demo_token_response()
        _jti, new_refresh = create_refresh_token("demo-user")
        _set_auth_cookies(response, demo["access_token"], new_refresh)
        return demo

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = build_token_response(user)
    _jti, new_refresh = create_refresh_token(user.id)
    _set_auth_cookies(response, token_data["access_token"], new_refresh)
    return token_data


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateMeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    _clear_auth_cookies(response)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Generate reset token, store in Redis, send email. Always 202 to prevent enumeration."""
    email = str(body.email).strip().lower()
    user = await get_user_by_email(db, email)
    if not user:
        return {"detail": "If that email is registered, a reset link has been sent."}

    reset_token = secrets.token_urlsafe(32)

    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            await r.setex(f"reset:{reset_token}", 900, user.id)  # 15-minute TTL
    except Exception:
        logger.warning("Redis unavailable — password reset token not stored")
        return {"detail": "If that email is registered, a reset link has been sent."}

    if settings.sendgrid_api_key:
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient() as client:
                await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
                    json={
                        "personalizations": [{"to": [{"email": email}]}],
                        "from": {"email": settings.from_email},
                        "subject": "Reset your StockVision password",
                        "content": [{
                            "type": "text/html",
                            "value": (
                                f"<p>Hi {user.name},</p>"
                                f"<p>Click the link below to reset your password (valid 15 minutes):</p>"
                                f"<p><a href='https://stockvision.in/reset-password?token={reset_token}'>"
                                f"Reset Password</a></p>"
                                f"<p>If you didn't request this, ignore this email.</p>"
                            ),
                        }],
                    },
                    timeout=10,
                )
        except Exception as exc:
            logger.error("SendGrid email failed: %s", exc)
    else:
        logger.info("Password reset token for %s: %s (configure SENDGRID_API_KEY to send email)", email, reset_token)

    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Validate reset token and update password."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            user_id = await r.get(f"reset:{body.token}")
            if not user_id:
                raise HTTPException(status_code=422, detail="Reset token is invalid or has expired.")
            user = await get_user_by_id(db, user_id)
            if not user:
                raise HTTPException(status_code=422, detail="User not found.")
            from app.core.security import hash_password
            user.hashed_password = hash_password(body.password)
            await db.flush()
            await r.delete(f"reset:{body.token}")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Reset service unavailable. Ensure Redis is running.")

    return {"detail": "Password updated successfully."}
