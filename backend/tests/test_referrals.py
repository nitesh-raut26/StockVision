"""Unit tests for the referral reward ledger (pure logic + auth; no DB)."""

import pytest
from fastapi.testclient import TestClient

import app.main as m
from app.services.referral_service import (
    MILESTONES,
    is_valid_code_format,
    make_code,
    milestones_for,
    premium_days_at,
)

pytestmark = pytest.mark.unit

client = TestClient(m.app, raise_server_exceptions=False)


def test_make_code_format_and_determinism():
    c1 = make_code("Nitesh Raut", "abc12345-0000")
    c2 = make_code("Nitesh Raut", "abc12345-0000")
    assert c1 == c2
    assert c1.startswith("SV-NITE-")
    assert is_valid_code_format(c1)


def test_make_code_sanitizes_and_handles_empty():
    assert make_code(None, "").startswith("SV-USER-")
    assert is_valid_code_format(make_code("A!@#$", "x-y"))


def test_milestones_for():
    ms = milestones_for(3)
    by_target = {m["target"]: m for m in ms}
    assert by_target[1]["achieved"] is True
    assert by_target[3]["achieved"] is True
    assert by_target[5]["achieved"] is False
    assert len(ms) == len(MILESTONES)


def test_premium_days_at_milestone():
    assert premium_days_at(5) == 30   # 1 month Premium at the 5-referral milestone
    assert premium_days_at(1) == 0
    assert premium_days_at(4) == 0


def test_valid_code_format():
    assert is_valid_code_format("SV-RAUT-1A2B")
    assert not is_valid_code_format("RAUT-1234")          # missing SV- prefix
    assert not is_valid_code_format("SV-TOOLONGNAME-1234")  # name part > 4 chars


def test_referral_endpoints_require_auth():
    assert client.get("/api/v1/referrals/me").status_code == 401
    assert client.post("/api/v1/referrals/claim", json={"referral_code": "SV-X-Y"}).status_code == 401
    assert client.get("/api/v1/referrals/ledger").status_code == 401
