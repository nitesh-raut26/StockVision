"""Shared pytest fixtures for StockVision backend tests."""

import os

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

# ── Override env before any app imports ──────────────────────────────────────
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-chars-long!")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://stockvision:test_password_ci@localhost:5432/stockvision_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")  # DB 1 to isolate from dev
os.environ.setdefault("FIELD_ENCRYPTION_KEY", "")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "")

from app.main import app  # noqa: E402 — must import after env is set
from app.core.database import Base, AsyncSessionLocal, engine
from app.api.deps import get_db


@pytest_asyncio.fixture(scope="session", autouse=True, loop_scope="session")
async def create_tables():
    """Create all DB tables once for the test session, then drop them."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(loop_scope="session")
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(loop_scope="session")
async def client(db_session: AsyncSession):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
