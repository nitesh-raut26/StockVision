"""Aggregate all v1 route modules into a single router."""

from fastapi import APIRouter, Depends
from app.api.entitlements import require_plan
from app.api.v1.routes import (
    auth,
    stocks,
    screener,
    portfolio,
    dcf,
    mutual_funds,
    watchlist,
    transactions,
    broker,
    leaderboard,
    research,
    family,
    ca_portal,
    subscriptions,
    options,
    ipo,
    backtest,
    notifications,
    referrals,
    developer,
    alerts,
    webhooks,
    financials,
    indicators,
    market_ws,
    ai,
    b2b,
    compliance,
    market_data,
)

api_router = APIRouter()

# ── Core ──────────────────────────────────────────────────────────────────────
api_router.include_router(auth.router)
api_router.include_router(stocks.router)
api_router.include_router(screener.router)
api_router.include_router(portfolio.router)
api_router.include_router(dcf.router, dependencies=[Depends(require_plan("premium"))])
api_router.include_router(mutual_funds.router)
api_router.include_router(watchlist.router)

# ── New routes ────────────────────────────────────────────────────────────────
api_router.include_router(transactions.router)   # POST /portfolio/transactions
api_router.include_router(broker.router)         # /broker/connect, /broker/orders
api_router.include_router(leaderboard.router)    # /leaderboard
api_router.include_router(research.router)       # /research
api_router.include_router(family.router, dependencies=[Depends(require_plan("premium"))])        # /family
api_router.include_router(ca_portal.router, dependencies=[Depends(require_plan("enterprise"))])  # /ca
api_router.include_router(subscriptions.router)  # /subscriptions

# ── Market data & tools ───────────────────────────────────────────────────────
api_router.include_router(options.router, dependencies=[Depends(require_plan("premium"))])   # /options/chain, /options/expiries
api_router.include_router(ipo.router)             # /ipo/open, /ipo/upcoming, /ipo/listed
api_router.include_router(backtest.router, dependencies=[Depends(require_plan("premium"))])  # /backtest/run, /backtest/strategies

# ── User engagement & B2B ─────────────────────────────────────────────────────
api_router.include_router(notifications.router)  # /notifications
api_router.include_router(referrals.router)      # /referrals
api_router.include_router(developer.router)      # /developer/keys, /developer/usage
api_router.include_router(alerts.router)         # /alerts
api_router.include_router(webhooks.router)       # /webhooks/razorpay

# ── Phase 2: Data, Analytics, AI ─────────────────────────────────────────────
api_router.include_router(financials.router)     # /financials/{ticker}/income|balance-sheet|cash-flow
api_router.include_router(indicators.router)     # /indicators/{ticker}?period=1y
api_router.include_router(market_ws.router)      # WS /ws/market?tickers=RELIANCE,TCS
api_router.include_router(ai.router)             # /ai/chat, /ai/report/{ticker}

# ── Phase 4: B2B API ──────────────────────────────────────────────────────────
api_router.include_router(b2b.router)            # /b2b/* (API key auth via middleware)

# ── Phase 6: DPDP Compliance ──────────────────────────────────────────────────
api_router.include_router(compliance.router)     # /compliance/export|account|consent|grievance

# ── Phase 2: Market-level data ────────────────────────────────────────────────
api_router.include_router(market_data.router)    # /market/fii-dii, /market/indices, /market/breadth
