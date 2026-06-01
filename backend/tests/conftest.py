"""Shared pytest fixtures for StockVision backend tests."""

import asyncio
import os

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

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


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
