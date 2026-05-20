"""Financial statement ORM models.

Design decisions:
  - Single `FinancialStatement` table with a `statement_type` discriminator
    (income / balance_sheet / cash_flow) + `period_type` (quarterly / annual).
    This avoids 3 tables with near-identical columns and enables cross-statement
    queries with a single JOIN.
  - All monetary fields are NUMERIC(20,2) — large enough for Reliance / TCS
    scale (₹crores, up to ₹99,999,999,999,999.99).
  - Composite unique index on (ticker, statement_type, period_label, period_type)
    prevents duplicate imports from NSE/yfinance.
  - `raw_json` column stores the un-transformed source payload for auditability
    and future schema migrations without data loss.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Date, Index, JSON, Numeric, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class FinancialStatement(UUIDMixin, TimestampMixin, Base):
    """Universal financial statement row.

    statement_type: 'income' | 'balance_sheet' | 'cash_flow'
    period_type:    'quarterly' | 'annual' | 'ttm'
    period_label:   'Q1FY26' | 'FY2025' | 'TTM'
    """

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint(
            "ticker", "statement_type", "period_label", "period_type",
            name="uq_financial_statement",
        ),
        Index("idx_fs_ticker_type", "ticker", "statement_type"),
        Index("idx_fs_ticker_period", "ticker", "period_end"),
    )

    # ── Identity ─────────────────────────────────────────────────
    ticker:         Mapped[str]  = mapped_column(String(20),  index=True)
    statement_type: Mapped[str]  = mapped_column(String(20))  # income | balance_sheet | cash_flow
    period_type:    Mapped[str]  = mapped_column(String(20))  # quarterly | annual | ttm
    period_label:   Mapped[str]  = mapped_column(String(20))  # Q1FY26 | FY2025 | TTM
    period_end:     Mapped[date] = mapped_column(Date, index=True)
    currency:       Mapped[str]  = mapped_column(String(5), default="INR")
    unit:           Mapped[str]  = mapped_column(String(20), default="crores")  # crores | lakhs | millions

    # ── Income Statement ──────────────────────────────────────────
    revenue:          Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    gross_profit:     Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    ebitda:           Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    ebit:             Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    interest_expense: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    pbt:              Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    tax:              Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    pat:              Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)  # Profit After Tax
    eps_basic:        Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    eps_diluted:      Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    shares_outstanding: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    # ── Balance Sheet ─────────────────────────────────────────────
    total_assets:      Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    total_liabilities: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    total_equity:      Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    current_assets:    Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    current_liabilities: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    cash_and_equivalents: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    total_debt:        Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    inventory:         Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    receivables:       Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    fixed_assets:      Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    goodwill:          Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    book_value_per_share: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)

    # ── Cash Flow ─────────────────────────────────────────────────
    cfo:   Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)  # Operating CF
    cfi:   Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)  # Investing CF
    cff:   Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)  # Financing CF
    capex: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    fcf:   Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)  # Free CF = CFO - CapEx
    dividends_paid: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)

    # ── Derived ratios (pre-computed for fast API responses) ─────
    gross_margin:   Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    ebitda_margin:  Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    net_margin:     Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    roe:            Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    roce:           Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    debt_equity:    Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    current_ratio:  Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    asset_turnover: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)

    # ── Audit ────────────────────────────────────────────────────
    data_source: Mapped[str | None] = mapped_column(String(30), nullable=True)  # yfinance | nse | bse
    raw_json:    Mapped[dict | None] = mapped_column(JSON, nullable=True)
