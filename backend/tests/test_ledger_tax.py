"""Unit tests for tax derived from the immutable ledger (no DB or network)."""

from datetime import date, timedelta

import pytest

from app.services.ledger_service import (
    derive_holdings,
    derived_to_tax_holdings,
    ledger_to_tax_transactions,
)
from app.services.tax_calculator import STCG_RATE, compute_tax_summary

pytestmark = pytest.mark.unit


def _entry(ticker, action, qty, price, d):
    return {"ticker": ticker, "action": action, "qty": qty, "price": price, "trade_date": d}


def _fy_start() -> date:
    today = date.today()
    return date(today.year if today.month >= 4 else today.year - 1, 4, 1)


def test_ledger_to_tax_transactions_maps_fields():
    out = ledger_to_tax_transactions([_entry("REL", "BUY", 10, 100, date(2026, 1, 1))])
    assert out[0] == {
        "ticker": "REL", "action": "BUY", "qty": 10, "price": 100.0,
        "transaction_date": date(2026, 1, 1),
    }


def test_realized_stcg_from_ledger():
    fy = _fy_start()
    entries = [
        _entry("REL", "BUY", 10, 2000, fy + timedelta(days=10)),
        _entry("REL", "SELL", 10, 2500, fy + timedelta(days=70)),  # held ~60d → STCG
    ]
    summary = compute_tax_summary([], ledger_to_tax_transactions(entries))
    assert summary["stcg_gains"] == pytest.approx(5000.0)
    assert summary["ltcg_gains"] == 0.0
    assert summary["stcg_tax"] == pytest.approx(5000 * STCG_RATE)


def test_harvest_suggestion_from_derived_holdings():
    derived = derive_holdings([_entry("REL", "BUY", 10, 1000, date(2026, 1, 1))])
    # current price 200 → unrealised loss of 8,000 (> 5,000 threshold) → harvest candidate
    holdings = derived_to_tax_holdings(derived, {"REL": 200})
    summary = compute_tax_summary(holdings, [])
    assert any(s["ticker"] == "REL" for s in summary["harvesting_suggestions"])
    assert summary["tax_saved_potential"] > 0


def test_no_harvest_when_in_profit():
    derived = derive_holdings([_entry("REL", "BUY", 10, 1000, date(2026, 1, 1))])
    holdings = derived_to_tax_holdings(derived, {"REL": 1500})  # in profit
    summary = compute_tax_summary(holdings, [])
    assert summary["harvesting_suggestions"] == []
