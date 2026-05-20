"""Broker integration routes — OAuth connect + order placement.

STATUS: Stub implementation. OAuth flows and real order placement require
        broker API credentials (AngelOne SmartAPI / Zerodha Kite Connect).

Supported brokers (planned):
  - AngelOne  (smartapi-python)
  - Zerodha   (kiteconnect)
  - Groww     (unofficial — not recommended for production)
  - ICICI Direct (breeze-connect)
"""

from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.models.portfolio import BrokerAccount
from app.models.user import User

router = APIRouter(prefix="/broker", tags=["broker"])

SUPPORTED_BROKERS = ["angelone", "zerodha", "icici", "groww"]


# ── Schemas ──────────────────────────────────────────────────────────────────

class BrokerConnectRequest(BaseModel):
    broker: Literal["angelone", "zerodha", "icici", "groww"]


class BrokerLoginRequest(BaseModel):
    broker: Literal["angelone", "zerodha", "icici", "groww"]
    client_id: str
    password: str
    totp: Optional[str] = Field(None, description="TOTP code for 2FA")


class OrderRequest(BaseModel):
    broker: Literal["angelone", "zerodha", "icici", "groww"]
    ticker: str = Field(..., example="RELIANCE")
    exchange: str = Field(default="NSE", example="NSE")
    action: Literal["BUY", "SELL"]
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    qty: int = Field(..., gt=0)
    price: Optional[float] = Field(None, description="Required for LIMIT orders")
    product: Literal["CNC", "MIS", "NRML"] = Field(
        default="CNC",
        description="CNC=delivery, MIS=intraday, NRML=F&O",
    )


class OrderResponse(BaseModel):
    order_id: str
    status: str
    message: str


class BrokerAccountOut(BaseModel):
    id: str | None = None
    broker: str
    status: str
    access_mode: str = "read_only"
    holdings_synced: int = 0
    last_sync_at: str | None = None
    message: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/connected")
async def get_connected_brokers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of brokers the user has connected."""
    result = await db.execute(select(BrokerAccount).where(BrokerAccount.user_id == current_user.id))
    accounts = {account.broker: account for account in result.scalars().all()}
    return [
        _serialize_broker(accounts.get(broker), broker)
        for broker in SUPPORTED_BROKERS
    ]


@router.post("/connect")
async def initiate_broker_connect(
    payload: BrokerConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Step 1 of broker OAuth. Returns the authorization URL for the broker.

    AngelOne:  Redirect user to → https://smartapi.angelbroking.com/publisher-login
    Zerodha:   Redirect user to → https://kite.zerodha.com/connect/login?api_key={KEY}
    """
    result = await db.execute(
        select(BrokerAccount).where(
            BrokerAccount.user_id == current_user.id,
            BrokerAccount.broker == payload.broker,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = BrokerAccount(
            user_id=current_user.id,
            broker=payload.broker,
            status="configuration_required",
            access_mode="read_only",
            message="Broker API keys are not configured. Manual portfolio tracking is available now.",
        )
        db.add(account)

    account.status = "configuration_required"
    account.access_mode = "read_only"
    account.message = _broker_configuration_message(payload.broker)
    await db.flush()
    await db.refresh(account)
    return _serialize_broker(account, payload.broker)


@router.post("/login")
async def broker_login(
    payload: BrokerLoginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Direct login flow for brokers that support credential-based auth (e.g. AngelOne SmartAPI).

    AngelOne example (requires smartapi-python):
        from SmartApi import SmartConnect
        obj = SmartConnect(api_key=ANGEL_API_KEY)
        data = obj.generateSession(client_id, password, totp)
        # → data['data']['jwtToken']  store this per user

    ⚠️  Store tokens encrypted, never in plaintext.
    """
    # Never persist raw broker credentials. This endpoint records an integration
    # request so the UI can show a safe state until an OAuth callback is added.
    result = await db.execute(
        select(BrokerAccount).where(
            BrokerAccount.user_id == current_user.id,
            BrokerAccount.broker == payload.broker,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = BrokerAccount(
            user_id=current_user.id,
            broker=payload.broker,
            access_mode="read_only",
        )
        db.add(account)
    account.status = "configuration_required"
    account.message = _broker_configuration_message(payload.broker)
    await db.flush()
    await db.refresh(account)
    return _serialize_broker(account, payload.broker)


@router.post("/orders", response_model=OrderResponse)
async def place_order(
    payload: OrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Place a real order via the connected broker.

    ⚠️  THIS EXECUTES A REAL TRADE WITH REAL MONEY.
    Always confirm on paper trading first.

    AngelOne example:
        obj = SmartConnect(api_key=ANGEL_API_KEY)
        obj.setAccessToken(user_token)
        order_params = {
            "variety": "NORMAL",
            "tradingsymbol": payload.ticker,
            "symboltoken": "2885",      # NSE token for ticker
            "transactiontype": payload.action,
            "exchange": payload.exchange,
            "ordertype": payload.order_type,
            "producttype": payload.product,
            "duration": "DAY",
            "price": str(payload.price or 0),
            "quantity": str(payload.qty),
        }
        response = obj.placeOrder(order_params)
        # → response['data']['orderid']

    Zerodha example:
        kite = KiteConnect(api_key=KITE_API_KEY)
        kite.set_access_token(user_token)
        order_id = kite.place_order(
            variety=kite.VARIETY_REGULAR,
            exchange=kite.EXCHANGE_NSE,
            tradingsymbol=payload.ticker,
            transaction_type=kite.TRANSACTION_TYPE_BUY,
            quantity=payload.qty,
            product=kite.PRODUCT_CNC,
            order_type=kite.ORDER_TYPE_MARKET,
        )
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Order placement is not yet implemented. "
            "Connect a broker via /broker/connect first, then implement this route."
        ),
    )


@router.get("/positions")
async def get_positions(
    broker: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch live open positions from the broker account."""
    account = await _get_account(db, current_user.id, broker)
    return {"broker": broker, "positions": [], "message": account.message or "No live positions synced yet."}


@router.get("/holdings")
async def get_broker_holdings(
    broker: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch long-term demat holdings from the broker account."""
    account = await _get_account(db, current_user.id, broker)
    return {"broker": broker, "holdings": [], "message": account.message or "No broker holdings synced yet."}


async def _get_account(db: AsyncSession, user_id: str, broker: str) -> BrokerAccount:
    result = await db.execute(
        select(BrokerAccount).where(
            BrokerAccount.user_id == user_id,
            BrokerAccount.broker == broker,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Broker is not connected.")
    return account


def _serialize_broker(account: BrokerAccount | None, broker: str) -> BrokerAccountOut:
    if account is None:
        return BrokerAccountOut(
            broker=broker,
            status="not_connected",
            message="Connect read-only broker sync when broker API credentials are configured.",
        )
    return BrokerAccountOut(
        id=account.id,
        broker=account.broker,
        status=account.status,
        access_mode=account.access_mode,
        holdings_synced=account.holdings_synced,
        last_sync_at=account.last_sync_at.isoformat() if account.last_sync_at else None,
        message=account.message or "Connected.",
    )


def _broker_configuration_message(broker: str) -> str:
    key_status = {
        "angelone": bool(getattr(settings, "angelone_api_key", "")),
        "zerodha": bool(getattr(settings, "zerodha_api_key", "")),
        "icici": bool(getattr(settings, "icici_api_key", "")),
        "groww": False,
    }
    if key_status.get(broker):
        return "Broker credentials detected. OAuth callback implementation is the next required step."
    return f"{broker.title()} API keys are not configured. Add credentials and OAuth callback before live sync."
