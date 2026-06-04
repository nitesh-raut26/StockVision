"""Unit tests for structured logging + request-id propagation (no DB)."""

import json
import logging

import pytest

from app.core.logging_config import JsonFormatter, RequestIdFilter, request_id_ctx

pytestmark = pytest.mark.unit


def _record(msg="hello"):
    return logging.LogRecord(
        name="t", level=logging.INFO, pathname=__file__, lineno=1,
        msg=msg, args=(), exc_info=None,
    )


def test_json_formatter_emits_valid_json():
    rec = _record("alert fired")
    RequestIdFilter().filter(rec)
    out = json.loads(JsonFormatter().format(rec))
    assert out["level"] == "INFO"
    assert out["msg"] == "alert fired"
    assert "request_id" in out
    assert "ts" in out


def test_request_id_filter_uses_contextvar():
    token = request_id_ctx.set("abc123")
    try:
        rec = _record()
        RequestIdFilter().filter(rec)
        assert rec.request_id == "abc123"
    finally:
        request_id_ctx.reset(token)


def test_request_id_echoed_on_response():
    from fastapi.testclient import TestClient

    import app.main as m

    client = TestClient(m.app, raise_server_exceptions=False)

    r = client.get("/health")
    assert any(k.lower() == "x-request-id" for k in r.headers)

    # An inbound correlation id is preserved end-to-end.
    r2 = client.get("/health", headers={"X-Request-ID": "trace-xyz"})
    assert r2.headers.get("x-request-id") == "trace-xyz"
