"""Financial statement ingestion and query service.

Architecture:
  - Ingestion: pulls yfinance quarterly/annual financials, transforms to our
    schema, upserts into PostgreSQL using ON CONFLICT DO UPDATE.
  - Caching: 1-hour Redis TTL keyed by (ticker, statement_type, period_type)
    to avoid hammering yfinance on every API request.
  - Async: all DB calls use SQLAlchemy 2.0 async; yfinance (sync) runs in
    executor to avoid blocking the event loop.
  - Derived ratios: computed once at ingest time and stored, not re-derived
    on every read (performance).

Scalability note: for production at 5000+ stocks, replace the yfinance pull
with a licensed NSE data vendor (e.g., Refinitiv, Quandl, TickerData) and
run the ingestion as a daily Celery task, not on-demand.
"""

import asyncio
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

import yfinance as yf

from app.core.database import AsyncSessionLocal
from app.models.financials import FinancialStatement
from app.services.data_fetcher import _nse_ticker, _YF_SEMAPHORE

logger = logging.getLogger(__name__)

# ── Cache ──────────────────────────────────────────────────────────────────
import time
_CACHE: dict[str, tuple[Any, float]] = {}
_CACHE_TTL = 3600  # 1 hour


def _cache_key(ticker: str, stmt_type: str, period: str) -> str:
    return f"financials:{ticker}:{stmt_type}:{period}"


def _cache_get(key: str) -> Any | None:
    entry = _CACHE.get(key)
    return entry[0] if entry and time.time() < entry[1] else None


def _cache_set(key: str, value: Any) -> None:
    _CACHE[key] = (value, time.time() + _CACHE_TTL)


# ── Helpers ────────────────────────────────────────────────────────────────

def _dec(v: Any) -> Decimal | None:
    if v is None:
        return None
    try:
        f = float(v)
        if f != f:  # NaN
            return None
        return Decimal(str(round(f, 2)))
    except (TypeError, ValueError, InvalidOperation):
        return None


def _ratio(num: Decimal | None, den: Decimal | None) -> Decimal | None:
    if num is None or den is None or den == 0:
        return None
    try:
        return Decimal(str(round(float(num) / float(den), 4)))
    except Exception:
        return None


def _quarter_label(dt: Any) -> str:
    """Convert a pandas Timestamp to 'Q1FY26' style label."""
    try:
        ts = datetime.fromisoformat(str(dt)[:10])
        fy_month = ts.month
        fy_year  = ts.year + 1 if fy_month >= 4 else ts.year
        quarter  = ((fy_month - 4) % 12) // 3 + 1
        return f"Q{quarter}FY{str(fy_year)[2:]}"
    except Exception:
        return str(dt)[:7]


def _annual_label(dt: Any) -> str:
    try:
        ts = datetime.fromisoformat(str(dt)[:10])
        fy_year = ts.year + 1 if ts.month >= 4 else ts.year
        return f"FY{fy_year}"
    except Exception:
        return str(dt)[:4]


def _to_date(dt: Any) -> date:
    try:
        return datetime.fromisoformat(str(dt)[:10]).date()
    except Exception:
        return date.today()


# ── yfinance extraction (sync — run in executor) ──────────────────────────

def _extract_income(ticker_obj: yf.Ticker, quarterly: bool) -> list[dict[str, Any]]:
    df = ticker_obj.quarterly_income_stmt if quarterly else ticker_obj.income_stmt
    if df is None or df.empty:
        return []

    rows = []
    for col in df.columns:
        def g(row: str) -> float | None:
            try:
                v = df.at[row, col]
                return None if v != v else float(v)
            except Exception:
                return None

        # Convert from absolute to crores (yfinance gives absolute INR values)
        cr = 1e7  # 1 crore = 10 million

        rev  = g("Total Revenue")
        gp   = g("Gross Profit")
        ebit = g("EBIT") or g("Operating Income")
        int_ = g("Interest Expense")
        pbt  = g("Pretax Income")
        tax  = g("Tax Provision") or g("Income Tax Expense")
        pat  = g("Net Income")
        eps  = g("Basic EPS") or g("Diluted EPS")
        epsd = g("Diluted EPS")
        shs  = g("Diluted Average Shares") or g("Basic Average Shares")
        da   = g("Depreciation And Amortization") or g("Reconciled Depreciation") or 0

        ebitda_ = (float(ebit or 0) + float(da or 0)) if ebit is not None else None

        row_data: dict[str, Any] = {
            "statement_type": "income",
            "period_type":    "quarterly" if quarterly else "annual",
            "period_label":   _quarter_label(col) if quarterly else _annual_label(col),
            "period_end":     _to_date(col),
            "data_source":    "yfinance",
            "revenue":          _dec(rev / cr if rev else None),
            "gross_profit":     _dec(gp / cr if gp else None),
            "ebitda":           _dec(ebitda_ / cr if ebitda_ else None),
            "ebit":             _dec(ebit / cr if ebit else None),
            "interest_expense": _dec(int_ / cr if int_ else None),
            "pbt":              _dec(pbt / cr if pbt else None),
            "tax":              _dec(tax / cr if tax else None),
            "pat":              _dec(pat / cr if pat else None),
            "eps_basic":        _dec(eps),
            "eps_diluted":      _dec(epsd),
            "shares_outstanding": _dec(shs / 1e7 if shs else None),
        }

        # Derived margins
        rev_cr = _dec(rev / cr if rev else None)
        pat_cr = _dec(pat / cr if pat else None)
        gp_cr  = _dec(gp / cr if gp else None)
        eb_cr  = _dec(ebitda_ / cr if ebitda_ else None)

        row_data["gross_margin"]  = _ratio(gp_cr, rev_cr)
        row_data["ebitda_margin"] = _ratio(eb_cr, rev_cr)
        row_data["net_margin"]    = _ratio(pat_cr, rev_cr)
        rows.append(row_data)

    return rows


def _extract_balance_sheet(ticker_obj: yf.Ticker, quarterly: bool) -> list[dict[str, Any]]:
    df = ticker_obj.quarterly_balance_sheet if quarterly else ticker_obj.balance_sheet
    if df is None or df.empty:
        return []

    rows = []
    for col in df.columns:
        def g(row: str) -> float | None:
            try:
                v = df.at[row, col]
                return None if v != v else float(v)
            except Exception:
                return None

        cr = 1e7

        ta   = g("Total Assets")
        tl   = g("Total Liabilities Net Minority Interest") or g("Total Liabilities")
        te   = g("Stockholders Equity") or g("Total Equity Gross Minority Interest")
        ca   = g("Current Assets")
        cl   = g("Current Liabilities")
        cash = g("Cash And Cash Equivalents") or g("Cash Equivalents")
        debt = g("Total Debt") or g("Long Term Debt And Capital Lease Obligation")
        inv  = g("Inventory")
        rec  = g("Receivables") or g("Gross Accounts Receivable")
        fa   = g("Net PPE")
        gw   = g("Goodwill")
        bvps = None

        row_data: dict[str, Any] = {
            "statement_type":    "balance_sheet",
            "period_type":       "quarterly" if quarterly else "annual",
            "period_label":      _quarter_label(col) if quarterly else _annual_label(col),
            "period_end":        _to_date(col),
            "data_source":       "yfinance",
            "total_assets":      _dec(ta / cr if ta else None),
            "total_liabilities": _dec(tl / cr if tl else None),
            "total_equity":      _dec(te / cr if te else None),
            "current_assets":    _dec(ca / cr if ca else None),
            "current_liabilities": _dec(cl / cr if cl else None),
            "cash_and_equivalents": _dec(cash / cr if cash else None),
            "total_debt":        _dec(debt / cr if debt else None),
            "inventory":         _dec(inv / cr if inv else None),
            "receivables":       _dec(rec / cr if rec else None),
            "fixed_assets":      _dec(fa / cr if fa else None),
            "goodwill":          _dec(gw / cr if gw else None),
            "book_value_per_share": _dec(bvps),
        }

        # Ratios
        ca_cr   = _dec(ca / cr if ca else None)
        cl_cr   = _dec(cl / cr if cl else None)
        de_cr   = _dec(debt / cr if debt else None)
        eq_cr   = _dec(te / cr if te else None)

        row_data["current_ratio"] = _ratio(ca_cr, cl_cr)
        row_data["debt_equity"]   = _ratio(de_cr, eq_cr)
        rows.append(row_data)

    return rows


def _extract_cash_flow(ticker_obj: yf.Ticker, quarterly: bool) -> list[dict[str, Any]]:
    df = ticker_obj.quarterly_cashflow if quarterly else ticker_obj.cashflow
    if df is None or df.empty:
        return []

    rows = []
    for col in df.columns:
        def g(row: str) -> float | None:
            try:
                v = df.at[row, col]
                return None if v != v else float(v)
            except Exception:
                return None

        cr = 1e7
        cfo   = g("Operating Cash Flow") or g("Cash Flows From Operations")
        cfi   = g("Investing Cash Flow") or g("Cash Flows From Investing")
        cff   = g("Financing Cash Flow") or g("Cash Flows From Financing")
        capex = g("Capital Expenditure")
        div   = g("Common Stock Dividend Paid") or g("Dividends Paid")

        fcf_ = (float(cfo or 0) + float(capex or 0)) if cfo else None

        rows.append({
            "statement_type": "cash_flow",
            "period_type":    "quarterly" if quarterly else "annual",
            "period_label":   _quarter_label(col) if quarterly else _annual_label(col),
            "period_end":     _to_date(col),
            "data_source":    "yfinance",
            "cfo":    _dec(cfo / cr if cfo else None),
            "cfi":    _dec(cfi / cr if cfi else None),
            "cff":    _dec(cff / cr if cff else None),
            "capex":  _dec(capex / cr if capex else None),
            "fcf":    _dec(fcf_ / cr if fcf_ else None),
            "dividends_paid": _dec(div / cr if div else None),
        })

    return rows


def _fetch_all_financials_sync(ticker: str) -> list[dict[str, Any]]:
    """Pull quarterly + annual for all 3 statement types. Sync — run in executor."""
    yf_sym = _nse_ticker(ticker)
    t = yf.Ticker(yf_sym)

    rows: list[dict[str, Any]] = []
    for quarterly in (True, False):
        rows.extend(_extract_income(t, quarterly))
        rows.extend(_extract_balance_sheet(t, quarterly))
        rows.extend(_extract_cash_flow(t, quarterly))

    for row in rows:
        row["ticker"] = ticker.upper()

    return rows


# ── Upsert to PostgreSQL ─────────────────────────────────────────────────

async def _upsert_rows(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    async with AsyncSessionLocal() as db:
        try:
            for row in rows:
                stmt = pg_insert(FinancialStatement).values(**row)
                update_cols = {
                    c.key: getattr(stmt.excluded, c.key)
                    for c in FinancialStatement.__table__.columns
                    if c.key not in ("id", "ticker", "statement_type", "period_label", "period_type", "created_at")
                }
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_financial_statement",
                    set_=update_cols,
                )
                await db.execute(stmt)
            await db.commit()
        except Exception as exc:
            logger.error("Financial upsert error: %s", exc)
            await db.rollback()


# ── Public API ───────────────────────────────────────────────────────────

async def get_financials(
    ticker: str,
    statement_type: str,
    period_type: str = "quarterly",
    limit: int = 8,
) -> list[dict]:
    """Return cached or freshly fetched financial statements.

    Args:
        ticker:         NSE ticker symbol
        statement_type: 'income' | 'balance_sheet' | 'cash_flow'
        period_type:    'quarterly' | 'annual'
        limit:          max periods to return (default 8 = 2 years quarterly)
    """
    cache_key = _cache_key(ticker, statement_type, period_type)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Try DB first
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(FinancialStatement)
            .where(
                FinancialStatement.ticker == ticker.upper(),
                FinancialStatement.statement_type == statement_type,
                FinancialStatement.period_type == period_type,
            )
            .order_by(FinancialStatement.period_end.desc())
            .limit(limit)
        )
        rows = result.scalars().all()

    if rows:
        data = [_row_to_dict(r) for r in rows]
        data.sort(key=lambda x: x["period_end"])
        _cache_set(cache_key, data)
        return data

    # DB empty — fetch from yfinance, upsert, return
    try:
        async with _YF_SEMAPHORE:
            loop = asyncio.get_event_loop()
            all_rows = await loop.run_in_executor(None, _fetch_all_financials_sync, ticker)
        await _upsert_rows(all_rows)
        logger.info("Fetched %d financial rows for %s", len(all_rows), ticker)

        # Re-query after upsert
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(FinancialStatement)
                .where(
                    FinancialStatement.ticker == ticker.upper(),
                    FinancialStatement.statement_type == statement_type,
                    FinancialStatement.period_type == period_type,
                )
                .order_by(FinancialStatement.period_end.desc())
                .limit(limit)
            )
            rows = result.scalars().all()

        data = [_row_to_dict(r) for r in rows]
        data.sort(key=lambda x: x["period_end"])
        _cache_set(cache_key, data)
        return data

    except Exception as exc:
        logger.error("Financial fetch failed for %s: %s", ticker, exc)
        return []


def _row_to_dict(row: FinancialStatement) -> dict:
    """Serialize a model row to API-safe dict, handling Decimal → float."""
    def f(v: Any) -> float | None:
        return float(v) if v is not None else None

    return {
        "ticker":          row.ticker,
        "statement_type":  row.statement_type,
        "period_type":     row.period_type,
        "period_label":    row.period_label,
        "period_end":      str(row.period_end),
        "currency":        row.currency,
        "unit":            row.unit,
        # Income
        "revenue":          f(row.revenue),
        "gross_profit":     f(row.gross_profit),
        "ebitda":           f(row.ebitda),
        "ebit":             f(row.ebit),
        "interest_expense": f(row.interest_expense),
        "pbt":              f(row.pbt),
        "tax":              f(row.tax),
        "pat":              f(row.pat),
        "eps_basic":        f(row.eps_basic),
        "eps_diluted":      f(row.eps_diluted),
        "shares_outstanding": f(row.shares_outstanding),
        # Balance Sheet
        "total_assets":      f(row.total_assets),
        "total_liabilities": f(row.total_liabilities),
        "total_equity":      f(row.total_equity),
        "current_assets":    f(row.current_assets),
        "current_liabilities": f(row.current_liabilities),
        "cash_and_equivalents": f(row.cash_and_equivalents),
        "total_debt":        f(row.total_debt),
        "inventory":         f(row.inventory),
        "receivables":       f(row.receivables),
        "fixed_assets":      f(row.fixed_assets),
        "goodwill":          f(row.goodwill),
        "book_value_per_share": f(row.book_value_per_share),
        # Cash Flow
        "cfo":    f(row.cfo),
        "cfi":    f(row.cfi),
        "cff":    f(row.cff),
        "capex":  f(row.capex),
        "fcf":    f(row.fcf),
        "dividends_paid": f(row.dividends_paid),
        # Derived ratios
        "gross_margin":   f(row.gross_margin),
        "ebitda_margin":  f(row.ebitda_margin),
        "net_margin":     f(row.net_margin),
        "roe":            f(row.roe),
        "roce":           f(row.roce),
        "debt_equity":    f(row.debt_equity),
        "current_ratio":  f(row.current_ratio),
        "asset_turnover": f(row.asset_turnover),
    }
