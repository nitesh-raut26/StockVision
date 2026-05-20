"""ORM models — import all so Base.metadata knows about every table."""

from app.models.user import User  # noqa: F401
from app.models.portfolio import (  # noqa: F401
    Portfolio, Holding, Transaction, Goal, WatchlistItem, Alert,
    BrokerAccount, FamilyMember, ResearchReport, CAClient,
)
from app.models.extensions import (  # noqa: F401
    Notification, Referral, ApiKey, PasswordResetToken,
    EmailVerification, UserSession, AuditLog, SubscriptionEvent,
)
from app.models.financials import FinancialStatement  # noqa: F401
