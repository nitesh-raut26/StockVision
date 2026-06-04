"""Unit tests for the immutable ledger FIFO derivation (no DB or network)."""

from datetime import date

import pytest

from app.services.ledger_service import derive_holdings

pytestmark = pytest.mark.unit


def _e(ticker, action, qty, price, d, fees=0):
    return {"ticker": ticker, "action": action, "qty": qty, "price": price,
            "trade_date": d, "fees": fees}


def test_single_buy():
    h = derive_holdings([_e("REL", "BUY", 10, 100, date(2026, 1, 1))])
    assert h["REL"]["qty"] == 10
    assert h["REL"]["avg_cost"] == 100
    assert h["REL"]["invested"] == 1000


def test_average_cost_across_two_buys():
    h = derive_holdings([
        _e("REL", "BUY", 10, 100, date(2026, 1, 1)),
        _e("REL", "BUY", 10, 200, date(2026, 1, 2)),
    ])
    assert h["REL"]["qty"] == 20
    assert h["REL"]["avg_cost"] == 150
    assert h["REL"]["invested"] == 3000


def test_fifo_partial_sell_realized_pnl():
    h = derive_holdings([
        _e("REL", "BUY", 10, 100, date(2026, 1, 1)),
        _e("REL", "BUY", 10, 200, date(2026, 1, 2)),
        _e("REL", "SELL", 5, 250, date(2026, 1, 3)),
    ])
    # FIFO: sells 5 from the ₹100 lot → realized 5*(250-100)=750
    assert h["REL"]["realized_pnl"] == 750.0
    assert h["REL"]["qty"] == 15
    # remaining: 5@100 + 10@200 = 2500 invested
    assert h["REL"]["invested"] == 2500
    assert h["REL"]["avg_cost"] == round(2500 / 15, 2)


def test_full_exit_drops_ticker():
    h = derive_holdings([
        _e("REL", "BUY", 10, 100, date(2026, 1, 1)),
        _e("REL", "SELL", 10, 150, date(2026, 1, 2)),
    ])
    assert "REL" not in h  # fully sold → no open position


def test_multiple_tickers_isolated():
    h = derive_holdings([
        _e("A", "BUY", 1, 10, date(2026, 1, 1)),
        _e("B", "BUY", 2, 20, date(2026, 1, 1)),
    ])
    assert set(h) == {"A", "B"}
    assert h["B"]["invested"] == 40


def test_same_date_fifo_order_preserved():
    # Two buys on the same date, oldest first; the sell must consume the first lot.
    h = derive_holdings([
        _e("X", "BUY", 5, 100, date(2026, 1, 1)),
        _e("X", "BUY", 5, 200, date(2026, 1, 1)),
        _e("X", "SELL", 5, 300, date(2026, 1, 2)),
    ])
    assert h["X"]["realized_pnl"] == 1000.0  # 5*(300-100)
    assert h["X"]["qty"] == 5
    assert h["X"]["avg_cost"] == 200


def test_fees_accumulate():
    h = derive_holdings([
        _e("REL", "BUY", 10, 100, date(2026, 1, 1), fees=15),
        _e("REL", "BUY", 5, 120, date(2026, 1, 2), fees=10),
    ])
    assert h["REL"]["fees"] == 25.0
