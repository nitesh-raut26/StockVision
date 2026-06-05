"""Unit tests for the CA white-label report (pure rendering; no DB)."""

import pytest
from fastapi.testclient import TestClient

import app.main as m
from app.services.ca_report import build_ca_report, mask_pan, render_ca_report_html

pytestmark = pytest.mark.unit

client = TestClient(m.app, raise_server_exceptions=False)

_CLIENT = {
    "name": "Ramesh Sharma", "pan": "ABCDE1234F", "tax_year": "FY2025-26",
    "filing_status": "FILED", "total_gains": 450000, "total_tax": 67500,
}


def test_mask_pan():
    assert mask_pan("ABCDE1234F") == "ABCXXXX34F"
    assert "DE12" not in mask_pan("ABCDE1234F")
    assert mask_pan("") == "XXXX"
    assert mask_pan(None) == "XXXX"


def test_build_ca_report_effective_rate():
    r = build_ca_report("Sharma & Co", _CLIENT)
    assert r["firm_name"] == "Sharma & Co"
    assert r["client"]["pan_masked"] == "ABCXXXX34F"
    assert r["tax"]["effective_rate"] == 15.0  # 67,500 / 4,50,000


def test_build_ca_report_zero_gains_no_divzero():
    r = build_ca_report("X", {**_CLIENT, "total_gains": 0, "total_tax": 0})
    assert r["tax"]["effective_rate"] == 0.0


def test_render_html_is_branded_and_masks_pan():
    html = render_ca_report_html(build_ca_report("Mehta Advisory", _CLIENT))
    assert "<!DOCTYPE html>" in html
    assert "Mehta Advisory" in html          # firm leads (white-label)
    assert "Ramesh Sharma" in html
    assert "ABCXXXX34F" in html
    assert "ABCDE1234F" not in html          # full PAN never leaks into a shareable report
    assert "Powered by StockVision" in html
    assert "450,000" in html                 # gains rendered


def test_report_endpoints_require_auth():
    assert client.get("/api/v1/ca/clients/abc/report").status_code == 401
    assert client.get("/api/v1/ca/clients/abc/report.json").status_code == 401
