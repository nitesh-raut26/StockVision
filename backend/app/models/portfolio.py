"""SQLAlchemy ORM models for portfolio, holdings, goals, watchlist, and alerts."""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    DateTime, String, Integer, Boolean, Date, ForeignKey, JSON,
    Text, Numeric, Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class Portfolio(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "portfolios"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    broker: Mapped[str] = mapped_column(String(50))
    broker_account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    user: Mapped["User"] = relationship(back_populates="portfolios")
    holdings: Mapped[list["Holding"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")


class Holding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "holdings"
    __table_args__ = (
        Index("idx_holdings_portfolio_ticker", "portfolio_id", "ticker"),
    )

    portfolio_id: Mapped[str] = mapped_column(String(36), ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(200))
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 6))   # fractional ETF support
    avg_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")


class Transaction(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("idx_transactions_portfolio_date", "portfolio_id", "transaction_date"),
    )

    portfolio_id: Mapped[str] = mapped_column(String(36), ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    action: Mapped[str] = mapped_column(String(10))  # BUY | SELL
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    transaction_date: Mapped[date] = mapped_column(Date)
    charges: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    portfolio: Mapped["Portfolio"] = relationship(back_populates="transactions")


class LedgerEntry(UUIDMixin, TimestampMixin, Base):
    """Append-only trade ledger — the immutable source of truth for holdings & tax.

    Unlike Transaction (portfolio-scoped, editable/deletable), a LedgerEntry is
    user-scoped and is NEVER updated or deleted in application code: corrections are
    *new* reversing entries. Holdings, tax, family roll-ups and CA exports are all
    derived (FIFO) from this ledger, making every position auditable and rebuildable.
    """

    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index("idx_ledger_user_ticker", "user_id", "ticker"),
        Index("idx_ledger_user_date", "user_id", "trade_date"),
    )

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    action: Mapped[str] = mapped_column(String(10))  # BUY | SELL
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    fees: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    trade_date: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | broker_sync | import
    broker: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Dedup key for broker-sync imports (broker's own trade id) — prevents double-counting.
    external_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Goal(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "goals"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    goal_type: Mapped[str] = mapped_column(String(20))
    target_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    target_date: Mapped[date] = mapped_column(Date)
    monthly_sip: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    current_corpus: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    suggested_allocation: Mapped[list] = mapped_column(JSON, default=list)

    user: Mapped["User"] = relationship(back_populates="goals")


class WatchlistItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (
        Index("idx_watchlist_user_ticker", "user_id", "ticker"),
    )

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="watchlist_items")


class Alert(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("idx_alerts_user_active", "user_id", postgresql_where="active = true"),
    )

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    condition: Mapped[str] = mapped_column(String(20))  # above | below | pct_change
    threshold: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    triggered: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="alerts")


class SavedScreen(UUIDMixin, TimestampMixin, Base):
    """A named screener configuration a user can re-run. `alert_enabled` opts the
    screen into background evaluation (notify when new stocks match)."""

    __tablename__ = "saved_screens"
    __table_args__ = (
        Index("idx_saved_screens_user", "user_id"),
    )

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class BrokerAccount(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "broker_accounts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    broker: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(String(30), default="not_connected")
    access_mode: Mapped[str] = mapped_column(String(20), default="read_only")
    holdings_synced: Mapped[int] = mapped_column(Integer, default=0)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Fernet-encrypted at service layer before storage
    encrypted_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    @validates("encrypted_access_token", "encrypted_refresh_token")
    def encrypt_on_set(self, key: str, value: str | None) -> str | None:
        if value is None:
            return None
        from app.core.security import encrypt_field
        return encrypt_field(value)

    def get_access_token(self) -> str | None:
        from app.core.security import decrypt_field
        return decrypt_field(self.encrypted_access_token)

    def get_refresh_token(self) -> str | None:
        from app.core.security import decrypt_field
        return decrypt_field(self.encrypted_refresh_token)


class FamilyMember(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "family_members"

    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    relation: Mapped[str] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#4361EE")
    total_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    total_invested: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    total_pnl: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    xirr: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0"))
    permission: Mapped[str] = mapped_column(String(30), default="view_only")
    invite_status: Mapped[str] = mapped_column(String(30), default="pending")


class ResearchReport(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "research_reports"

    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(240))
    summary: Mapped[str] = mapped_column(Text)
    analyst: Mapped[str] = mapped_column(String(120), default="StockVision Research")
    sector: Mapped[str] = mapped_column(String(100))
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    report_type: Mapped[str] = mapped_column(String(40), default="THEME")
    rating: Mapped[str | None] = mapped_column(String(20), nullable=True)
    target_price: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("7.5"))
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)


class CAClient(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ca_clients"

    ca_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    # PAN stored encrypted (Fernet). Use get_pan() / set_pan() helpers.
    _pan_encrypted: Mapped[str] = mapped_column("pan", String(200), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    filing_status: Mapped[str] = mapped_column(String(30), default="PENDING")
    tax_year: Mapped[str] = mapped_column(String(20), default="FY2025-26")
    total_gains: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    total_tax: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    last_reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    def set_pan(self, pan: str) -> None:
        from app.core.security import encrypt_field
        self._pan_encrypted = encrypt_field(pan) or pan

    def get_pan(self) -> str:
        from app.core.security import decrypt_field
        return decrypt_field(self._pan_encrypted) or self._pan_encrypted


class ReferralCode(UUIDMixin, TimestampMixin, Base):
    """A user's unique, shareable referral code (created lazily)."""

    __tablename__ = "referral_codes"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)


class ReferralReward(UUIDMixin, TimestampMixin, Base):
    """Two-sided referral reward ledger — one row per referred user. (The legacy
    `Referral` model in extensions.py is unused; this is the active reward ledger.)

    A referred user can only be referred once (unique constraint). Rewards are
    credited when the referred user qualifies (e.g. first subscription)."""

    __tablename__ = "referral_rewards"
    __table_args__ = (
        Index("idx_referral_rewards_referrer", "referrer_user_id"),
        UniqueConstraint("referred_user_id", name="uq_referral_reward_referred"),
    )

    referrer_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    referred_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    code_used: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | qualified
    reward_inr: Mapped[int] = mapped_column(Integer, default=0)            # credited to referrer
    referred_reward_inr: Mapped[int] = mapped_column(Integer, default=0)  # credited to referred user
    reward_premium_days: Mapped[int] = mapped_column(Integer, default=0)
    qualified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
