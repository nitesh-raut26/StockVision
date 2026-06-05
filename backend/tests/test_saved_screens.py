"""Unit tests for saved screens (no DB or network)."""

import pytest
from fastapi.testclient import TestClient

import app.main as m
from app.api.v1.routes.screener import serialize_screen
from app.core.database import Base
from app.models.portfolio import SavedScreen

pytestmark = pytest.mark.unit

client = TestClient(m.app, raise_server_exceptions=False)


def test_saved_screens_table_registered():
    assert "saved_screens" in Base.metadata.tables


def test_serialize_screen():
    s = SavedScreen(id="x", name="Deep value", filters={"max_pe": 15}, alert_enabled=True)
    assert serialize_screen(s) == {
        "id": "x", "name": "Deep value", "filters": {"max_pe": 15}, "alert_enabled": True,
    }


def test_serialize_screen_handles_null_filters():
    s = SavedScreen(id="y", name="n", filters=None, alert_enabled=False)
    assert serialize_screen(s)["filters"] == {}


def test_saved_endpoints_require_auth():
    assert client.get("/api/v1/screener/saved").status_code == 401
    assert client.post("/api/v1/screener/saved", json={"name": "x", "filters": {}}).status_code == 401
    assert client.delete("/api/v1/screener/saved/abc").status_code == 401
