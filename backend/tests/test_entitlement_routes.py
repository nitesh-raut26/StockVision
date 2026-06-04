"""Regression lock for server-side entitlement coverage.

Every premium/enterprise route must require authentication (the entitlement
dependency layers on top of get_current_user). If someone un-gates a router, these
fail. No DB needed: get_current_user rejects a token-less request before any query.
"""

import pytest
from fastapi.testclient import TestClient

import app.main as m

pytestmark = pytest.mark.unit

client = TestClient(m.app, raise_server_exceptions=False)

# (method, path) for one representative endpoint per gated router.
GATED_ROUTES = [
    ("get", "/api/v1/dcf/RELIANCE"),                                   # premium
    ("get", "/api/v1/options/chain?symbol=NIFTY&expiry=2026-06-26"),  # premium
    ("post", "/api/v1/backtest/run"),                                 # premium
    ("get", "/api/v1/family/members"),                                # premium
    ("get", "/api/v1/ca/clients"),                                    # enterprise
]


@pytest.mark.parametrize("method,path", GATED_ROUTES)
def test_gated_route_requires_auth(method, path):
    resp = client.get(path) if method == "get" else client.post(path, json={})
    assert resp.status_code == 401, f"{method.upper()} {path} should require auth"


def test_health_remains_open():
    assert client.get("/health").status_code == 200
