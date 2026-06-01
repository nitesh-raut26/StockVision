"""JWT creation/verification, password hashing, field-level encryption, and JTI management.

Migration note: uses PyJWT (actively maintained) instead of python-jose (unmaintained,
CVE-2022-29217). API is nearly identical; exception type is jwt.InvalidTokenError.

Refresh token JTI lifecycle:
  create_refresh_token() → store JTI in Redis via store_refresh_jti()
  /auth/refresh           → verify JTI exists in Redis, then rotate (delete old, store new)
  /auth/logout            → delete all JTIs for the user via revoke_all_user_tokens()
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt as pyjwt

from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_JTI_PREFIX = "jti:"
_USER_SESSIONS_PREFIX = "user_sessions:"


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": str(subject),
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Return (jti, signed_jwt). Call store_refresh_jti() after to persist in Redis."""
    jti = secrets.token_hex(16)
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "jti": jti,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    token = pyjwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return jti, token


def decode_token(token: str) -> dict:
    try:
        return pyjwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except pyjwt.ExpiredSignatureError as exc:
        raise ValueError("Token has expired") from exc
    except pyjwt.InvalidTokenError as exc:
        raise ValueError("Invalid or malformed token") from exc


# ── Redis JTI management ──────────────────────────────────────────────────────

async def store_refresh_jti(user_id: str, jti: str) -> None:
    """Store a JTI in Redis so it can be verified and rotated."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        ttl = settings.refresh_token_expire_days * 86400
        async with r:
            pipe = r.pipeline()
            pipe.setex(f"{_JTI_PREFIX}{jti}", ttl, user_id)
            pipe.sadd(f"{_USER_SESSIONS_PREFIX}{user_id}", jti)
            pipe.expire(f"{_USER_SESSIONS_PREFIX}{user_id}", ttl)
            await pipe.execute()
    except Exception as exc:
        logger.warning("Failed to store refresh JTI in Redis: %s", exc)


async def verify_refresh_jti(jti: str) -> str | None:
    """Return user_id if JTI is valid (exists in Redis), else None."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            return await r.get(f"{_JTI_PREFIX}{jti}")
    except Exception as exc:
        logger.warning("Failed to verify refresh JTI in Redis: %s", exc)
        return None


async def rotate_refresh_jti(old_jti: str, new_jti: str, user_id: str) -> None:
    """Atomically replace old JTI with new one (token rotation)."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        ttl = settings.refresh_token_expire_days * 86400
        async with r:
            pipe = r.pipeline()
            pipe.delete(f"{_JTI_PREFIX}{old_jti}")
            pipe.srem(f"{_USER_SESSIONS_PREFIX}{user_id}", old_jti)
            pipe.setex(f"{_JTI_PREFIX}{new_jti}", ttl, user_id)
            pipe.sadd(f"{_USER_SESSIONS_PREFIX}{user_id}", new_jti)
            pipe.expire(f"{_USER_SESSIONS_PREFIX}{user_id}", ttl)
            await pipe.execute()
    except Exception as exc:
        logger.warning("Failed to rotate refresh JTI in Redis: %s", exc)


async def revoke_all_user_tokens(user_id: str) -> None:
    """Delete all active refresh JTIs for a user (logout-all / forced logout)."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            session_key = f"{_USER_SESSIONS_PREFIX}{user_id}"
            jtis = await r.smembers(session_key)
            if jtis:
                pipe = r.pipeline()
                for jti in jtis:
                    pipe.delete(f"{_JTI_PREFIX}{jti}")
                pipe.delete(session_key)
                await pipe.execute()
    except Exception as exc:
        logger.warning("Failed to revoke user tokens in Redis: %s", exc)


# ── Field-level Fernet encryption for PAN / broker tokens ────────────────────

def _get_cipher():
    """Lazy-load Fernet cipher; returns None when no key is configured."""
    key = settings.field_encryption_key.strip()
    if not key:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(key.encode())
    except Exception as exc:
        logger.error("Invalid FIELD_ENCRYPTION_KEY: %s", exc)
        return None


def encrypt_field(value: str | None) -> str | None:
    if not value:
        return value
    cipher = _get_cipher()
    if cipher is None:
        logger.warning(
            "FIELD_ENCRYPTION_KEY not configured — storing sensitive field as plaintext. "
            "Set FIELD_ENCRYPTION_KEY in production to protect PAN/broker tokens."
        )
        return value
    return cipher.encrypt(value.encode()).decode()


def decrypt_field(value: str | None) -> str | None:
    if not value:
        return value
    cipher = _get_cipher()
    if cipher is None:
        return value
    try:
        return cipher.decrypt(value.encode()).decode()
    except Exception:
        return value
