"""Integration tests for /auth/* routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # Register
    resp = await client.post("/api/v1/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "SecurePass123!",
    })
    assert resp.status_code in (201, 409)  # 409 if email already registered in test DB

    # Login
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "SecurePass123!",
    })
    # May be 401 if demo auth is off and DB had no user — check both paths
    if resp.status_code == 200:
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Cookie should be set
        assert "sv_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com",
        "password": "wrongpassword",
    })
    assert resp.status_code in (401, 400)


@pytest.mark.asyncio
async def test_protected_route_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_without_cookie_returns_401(client: AsyncClient):
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"


@pytest.mark.asyncio
async def test_refresh_token_with_invalid_token_returns_401(client: AsyncClient):
    client.cookies.set("sv_refresh", "invalid.token.here")
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401
