"""Tests for Razorpay webhook validation and event handling."""

import hashlib
import hmac
import json

import pytest
from httpx import AsyncClient


def _make_signature(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_rejects_missing_secret(client: AsyncClient, monkeypatch):
    """Webhook must return 400 if RAZORPAY_WEBHOOK_SECRET is not configured."""
    monkeypatch.setattr("app.core.config.settings.razorpay_webhook_secret", "")
    payload = json.dumps({"event": "payment.captured"}).encode()
    resp = await client.post(
        "/api/v1/webhooks/razorpay",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_webhook_rejects_missing_signature(client: AsyncClient, monkeypatch):
    """Webhook must return 400 if X-Razorpay-Signature header is absent."""
    monkeypatch.setattr("app.core.config.settings.razorpay_webhook_secret", "test-webhook-secret")
    payload = json.dumps({"event": "payment.captured"}).encode()
    resp = await client.post(
        "/api/v1/webhooks/razorpay",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(client: AsyncClient, monkeypatch):
    """Webhook must return 400 on signature mismatch."""
    secret = "test-webhook-secret"
    monkeypatch.setattr("app.core.config.settings.razorpay_webhook_secret", secret)
    payload = json.dumps({"event": "payment.captured"}).encode()
    resp = await client.post(
        "/api/v1/webhooks/razorpay",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": "badhash",
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_webhook_accepts_valid_signature(client: AsyncClient, monkeypatch):
    """Webhook returns 200 with correct HMAC-SHA256 signature."""
    secret = "test-webhook-secret"
    monkeypatch.setattr("app.core.config.settings.razorpay_webhook_secret", secret)
    payload = json.dumps({"event": "payment.captured", "payload": {}}).encode()
    sig = _make_signature(payload, secret)
    resp = await client.post(
        "/api/v1/webhooks/razorpay",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": sig,
        },
    )
    assert resp.status_code == 200
