"""Unit tests for DCF, conviction score, and tax calculator — no DB or network needed."""

import pytest
from datetime import date

from app.services.dcf_calculator import compute_dcf
from app.services.conviction_score import compute_conviction_score, _score_pe, _score_roe, _score_volume
from app.services.tax_calculator import compute_tax_summary, STCG_RATE, LTCG_RATE

pytestmark = pytest.mark.unit


# ── DCF Calculator ────────────────────────────────────────────────────────────

class TestDCF:
    def test_basic_positive_fcf(self):
        result = compute_dcf(
            free_cash_flow=1000,
            revenue_growth_rate=0.15,
            wacc=0.12,
            shares_outstanding=100,
        )
        assert result["intrinsic_value_per_share"] > 0
        assert result["scenarios"]["bull"] > result["scenarios"]["base"]
        assert result["scenarios"]["bear"] < result["scenarios"]["base"]

    def test_zero_shares_returns_zero_not_error(self):
        result = compute_dcf(
            free_cash_flow=1000,
            revenue_growth_rate=0.15,
            shares_outstanding=0,
        )
        assert result["intrinsic_value_per_share"] == 0

    def test_negative_fcf_produces_negative_equity(self):
        result = compute_dcf(
            free_cash_flow=-500,
            revenue_growth_rate=0.10,
            shares_outstanding=100,
        )
        assert result["equity_value"] < 0

    def test_wacc_clamped_above_terminal_growth(self):
        # If wacc == terminal_growth, formula would divide by zero
        result = compute_dcf(
            free_cash_flow=500,
            revenue_growth_rate=0.10,
            terminal_growth_rate=0.12,
            wacc=0.12,  # equal to terminal_growth — should be adjusted
            shares_outstanding=50,
        )
        assert result["intrinsic_value_per_share"] >= 0

    def test_projected_fcfs_length(self):
        result = compute_dcf(1000, 0.10, projection_years=5, shares_outstanding=10)
        assert len(result["projected_fcfs"]) == 5


# ── Conviction Score ──────────────────────────────────────────────────────────

class TestConvictionScore:
    def _make_quote(self, **kwargs):
        base = {
            "ticker": "TEST",
            "price": 500,
            "change_pct": 2.5,
            "change_pct_1m": 5.0,
            "change_pct_3m": 12.0,
            "volume": 1_500_000,
            "avg_volume": 1_000_000,
            "week_52_high": 600,
            "week_52_low": 400,
        }
        return {**base, **kwargs}

    def _make_fund(self, **kwargs):
        base = {
            "pe_ratio": 18,
            "pb_ratio": 2.5,
            "revenue_growth": 22,
            "roe": 0.20,
            "debt_equity": 0.3,
            "dividend_yield": 0.02,
            "beta": 1.0,
            "free_cash_flow": 200,
        }
        return {**base, **kwargs}

    def test_score_in_range(self):
        result = compute_conviction_score(self._make_quote(), self._make_fund())
        assert 1.0 <= result["score"] <= 10.0

    def test_strong_fundamentals_score_higher(self):
        strong = compute_conviction_score(
            self._make_quote(),
            self._make_fund(pe_ratio=10, roe=0.30, debt_equity=0.1, revenue_growth=35),
        )
        weak = compute_conviction_score(
            self._make_quote(),
            self._make_fund(pe_ratio=80, roe=0.02, debt_equity=4.0, revenue_growth=-5),
        )
        assert strong["score"] > weak["score"]

    def test_score_has_required_fields(self):
        result = compute_conviction_score(self._make_quote(), self._make_fund())
        assert "score" in result
        assert "risk" in result
        assert "factors" in result
        assert "rationale" in result

    def test_volume_relative_scoring(self):
        # 3x avg volume should score higher than 0.5x avg volume
        high_vol = _score_volume(3_000_000, 1_000_000)
        low_vol  = _score_volume(500_000, 1_000_000)
        assert high_vol > low_vol

    def test_pe_scoring(self):
        assert _score_pe(8) > _score_pe(25)
        assert _score_pe(60) < _score_pe(15)
        assert _score_pe(None) == 0.4

    def test_roe_scoring(self):
        assert _score_roe(0.30) > _score_roe(0.05)
        assert _score_roe(None) == 0.4

    def test_no_fake_3m_momentum(self):
        # 3m momentum must use change_pct_3m, not change_pct * 1.5
        quote = self._make_quote(change_pct=2.0, change_pct_3m=25.0)
        result = compute_conviction_score(quote, self._make_fund())
        # The 3m factor should reflect 25%, not 2*1.5=3%
        assert result["factors"]["price_momentum_3m"] > result["factors"]["price_momentum_1m"]


# ── Tax Calculator ────────────────────────────────────────────────────────────

class TestTaxCalculator:
    def _make_buy(self, ticker, qty, price, days_ago):
        from datetime import timedelta
        txn_date = date.today() - timedelta(days=days_ago)
        return {"ticker": ticker, "action": "BUY", "qty": qty, "price": price, "transaction_date": str(txn_date)}

    def _make_sell(self, ticker, qty, price, days_ago=1):
        from datetime import timedelta
        txn_date = date.today() - timedelta(days=days_ago)
        return {"ticker": ticker, "action": "SELL", "qty": qty, "price": price, "transaction_date": str(txn_date)}

    def test_stcg_on_short_hold(self):
        buy  = self._make_buy("RELIANCE", 10, 2000, days_ago=100)
        sell = self._make_sell("RELIANCE", 10, 2500, days_ago=1)
        result = compute_tax_summary([], [buy, sell])
        assert result["stcg_gains"] == pytest.approx(5000.0)
        assert result["ltcg_gains"] == 0.0
        assert result["stcg_tax"] == pytest.approx(5000 * STCG_RATE)

    def test_ltcg_on_long_hold(self):
        buy  = self._make_buy("TCS", 5, 3000, days_ago=400)
        sell = self._make_sell("TCS", 5, 4000, days_ago=1)
        result = compute_tax_summary([], [buy, sell])
        assert result["ltcg_gains"] == pytest.approx(5000.0)
        assert result["stcg_gains"] == 0.0

    def test_ltcg_exemption_applied(self):
        buy  = self._make_buy("HDFC", 100, 1000, days_ago=400)
        sell = self._make_sell("HDFC", 100, 1500, days_ago=1)
        result = compute_tax_summary([], [buy, sell])
        # Gain = 50,000 < 1,25,000 exemption → LTCG tax should be 0
        assert result["ltcg_tax"] == 0.0

    def test_fifo_lot_consumption(self):
        """Selling 10 shares across two FIFO lots — older lot first."""
        buy1 = self._make_buy("INFY", 6, 1500, days_ago=400)  # LT
        buy2 = self._make_buy("INFY", 10, 1600, days_ago=100)  # ST
        sell = self._make_sell("INFY", 8, 2000, days_ago=1)
        result = compute_tax_summary([], [buy1, buy2, sell])
        # 6 shares from LT lot (gain = 6*500 = 3000 LTCG)
        # 2 shares from ST lot (gain = 2*400 = 800 STCG)
        assert result["ltcg_gains"] == pytest.approx(3000.0)
        assert result["stcg_gains"] == pytest.approx(800.0)

    def test_lots_consumed_across_multiple_sells(self):
        """Two sells from the same lot must not double-count."""
        buy  = self._make_buy("WIPRO", 10, 500, days_ago=400)
        sell1 = self._make_sell("WIPRO", 5, 700, days_ago=5)
        sell2 = self._make_sell("WIPRO", 5, 800, days_ago=1)
        result = compute_tax_summary([], [buy, sell1, sell2])
        expected_ltcg = 5 * (700 - 500) + 5 * (800 - 500)
        assert result["ltcg_gains"] == pytest.approx(expected_ltcg)

    def test_no_tax_on_loss(self):
        buy  = self._make_buy("ADANI", 10, 3000, days_ago=100)
        sell = self._make_sell("ADANI", 10, 2500, days_ago=1)
        result = compute_tax_summary([], [buy, sell])
        assert result["stcg_gains"] == pytest.approx(-5000.0)
        assert result["stcg_tax"] == 0.0  # no tax on losses
