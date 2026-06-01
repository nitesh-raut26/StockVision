"""Application settings loaded from environment variables."""

import logging
import secrets
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-secret-change-in-production"
_DEV_DB_DEFAULT = "postgresql+asyncpg://postgres:postgres@localhost:5432/stockvision"

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ──────────────────────────────────────────────────
    app_name: str = "StockVision API"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def demo_auth_enabled(self) -> bool:
        """Demo auth is allowed in non-production environments only."""
        return not self.is_production

    # ── Server ───────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://stockvision.in",
        "https://www.stockvision.in",
    ]

    # ── Database ─────────────────────────────────────────────
    database_url: str = _DEV_DB_DEFAULT
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # ── Auth ─────────────────────────────────────────────────
    jwt_secret_key: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15          # short-lived; refresh token handles renewal
    refresh_token_expire_days: int = 30

    # Fernet key for PAN / broker token field encryption
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    field_encryption_key: str = ""

    def validate_production_secrets(self) -> None:
        """Raise on startup if production config is unsafe."""
        if not self.is_production:
            return
        errors: list[str] = []
        if self.jwt_secret_key == _DEV_JWT_SECRET or len(self.jwt_secret_key) < 32:
            errors.append("JWT_SECRET_KEY must be a strong random secret (≥32 chars) in production. "
                          "Generate with: openssl rand -hex 32")
        if self.database_url == _DEV_DB_DEFAULT or "postgres:postgres" in self.database_url:
            errors.append("DATABASE_URL uses default dev credentials — set a strong password in production.")
        if not self.anthropic_api_key:
            errors.append("ANTHROPIC_API_KEY must be set in production to enable AI features.")
        if not self.field_encryption_key:
            errors.append(
                "FIELD_ENCRYPTION_KEY must be set in production to encrypt PAN/broker tokens. "
                "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        if not self.razorpay_webhook_secret:
            errors.append("RAZORPAY_WEBHOOK_SECRET must be set in production to verify payment webhooks.")
        if errors:
            raise RuntimeError("Production security check failed:\n" + "\n".join(f"  • {e}" for e in errors))
        logger.info("Production security checks passed.")

    # ── Redis ────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"
    redis_ttl_seconds: int = 300

    # ── External APIs ────────────────────────────────────────
    anthropic_api_key: str = ""
    alpha_vantage_key: str = ""
    fmp_api_key: str = ""
    bhashini_user_id: str = ""
    bhashini_api_key: str = ""
    angelone_api_key: str = ""
    zerodha_api_key: str = ""
    icici_api_key: str = ""

    # ── Payments ─────────────────────────────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # ── Email ────────────────────────────────────────────────
    sendgrid_api_key: str = ""
    from_email: str = "noreply@stockvision.in"

    # ── Monitoring ───────────────────────────────────────────
    sentry_dsn: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
