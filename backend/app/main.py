"""StockVision FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router
from app.workers.alert_worker import start_alert_worker, stop_alert_worker
from app.middleware.api_gateway import APIGatewayMiddleware

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://stockvision.in https://api.stockvision.in; "
                "frame-ancestors 'none';"
            )
        else:
            # Permissive but present in development — catches XSS early
            response.headers["Content-Security-Policy"] = (
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; "
                "img-src 'self' data: https:; "
                "frame-ancestors 'none';"
            )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate secrets, initialise Sentry, create tables, start workers."""
    settings.validate_production_secrets()

    if settings.sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            sentry_sdk.init(
                dsn=settings.sentry_dsn,
                environment=settings.environment,
                integrations=[FastApiIntegration(), SqlalchemyIntegration()],
                traces_sample_rate=0.1,
                send_default_pii=False,
            )
            logger.info("Sentry initialised (environment=%s)", settings.environment)
        except ImportError:
            logger.warning("sentry-sdk not installed — add it to requirements.txt")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        logger.warning(
            "Database not reachable on startup — DB-dependent routes will fail: %s. "
            "Set DATABASE_URL in .env to a valid PostgreSQL connection string.", exc
        )

    # Start background alert evaluation worker (every 120 s)
    try:
        start_alert_worker()
    except Exception as exc:
        logger.warning("Alert worker could not start: %s", exc)

    yield

    # Graceful shutdown
    stop_alert_worker()
    await engine.dispose()


app = FastAPI(
    title="StockVision API",
    description="AI-powered Indian stock market intelligence platform",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# API Gateway (B2B key validation — only activates on /api/v1/b2b/ paths)
app.add_middleware(APIGatewayMiddleware)

# Security headers (add before CORS so headers appear on all responses)
app.add_middleware(SecurityHeadersMiddleware)

# Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — explicit methods only, no wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# Routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok", "version": settings.app_version, "env": settings.environment}
