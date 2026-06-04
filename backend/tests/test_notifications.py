"""Unit tests for notification channels + dispatch (no real network)."""

import pytest

from app.core.config import settings
from app.services.notifications import NotificationMessage, dispatch
from app.services.notifications.channels import EmailChannel, LogChannel, WhatsAppChannel

pytestmark = pytest.mark.unit


async def test_log_channel_always_delivers():
    ch = LogChannel()
    assert ch.enabled is True
    res = await ch.send(NotificationMessage(user_id="u1", title="t", body="b"))
    assert res.ok and res.channel == "log"


def test_email_channel_enabled_follows_config(monkeypatch):
    monkeypatch.setattr(settings, "sendgrid_api_key", "")
    assert EmailChannel().enabled is False
    monkeypatch.setattr(settings, "sendgrid_api_key", "SG.test")
    assert EmailChannel().enabled is True


def test_whatsapp_channel_enabled_follows_config(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_api_token", "")
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "")
    assert WhatsAppChannel().enabled is False
    monkeypatch.setattr(settings, "whatsapp_api_token", "tok")
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "123456")
    assert WhatsAppChannel().enabled is True


async def test_email_send_without_recipient_is_graceful(monkeypatch):
    monkeypatch.setattr(settings, "sendgrid_api_key", "SG.test")
    res = await EmailChannel().send(
        NotificationMessage(user_id="u1", title="t", body="b", email=None)
    )
    assert res.ok is False
    assert "no recipient" in res.detail  # short-circuits before any network call


async def test_dispatch_always_includes_log_and_respects_config(monkeypatch):
    # Only the log channel enabled
    monkeypatch.setattr(settings, "sendgrid_api_key", "")
    monkeypatch.setattr(settings, "whatsapp_api_token", "")
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "")
    results = await dispatch(NotificationMessage(user_id="u1", title="t", body="b"))
    assert {r.channel for r in results} == {"log"}
    assert all(r.ok for r in results)

    # Enable email but provide no recipient → log ok + email graceful-fail (no network)
    monkeypatch.setattr(settings, "sendgrid_api_key", "SG.test")
    results2 = await dispatch(NotificationMessage(user_id="u1", title="t", body="b", email=None))
    by_channel = {r.channel: r for r in results2}
    assert by_channel["log"].ok is True
    assert by_channel["email"].ok is False
