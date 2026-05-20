"""SQLAlchemy ORM model for users."""

from sqlalchemy import String, Integer, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Profile
    plan: Mapped[str] = mapped_column(String(20), default="free")
    language: Mapped[str] = mapped_column(String(10), default="en")
    investing_style: Mapped[str | None] = mapped_column(String(20), nullable=True)
    risk_appetite: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sectors: Mapped[list] = mapped_column(JSON, default=list)

    # Onboarding
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    portfolios: Mapped[list["Portfolio"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    watchlist_items: Mapped[list["WatchlistItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user", cascade="all, delete-orphan")
