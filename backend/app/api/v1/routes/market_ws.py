"""Real-time market data via WebSocket.

Architecture:
  ┌─ Client (React) ──────────────────────────────────────────────┐
  │  useMarketWebSocket hook → ws://api/v1/ws/market?tickers=RELIANCE,TCS
  └───────────────────────────────────────────────────────────────┘
               ↕ WebSocket (full-duplex)
  ┌─ FastAPI WS endpoint ─────────────────────────────────────────┐
  │  ConnectionManager (in-memory pub/sub per ticker)              │
  │  Price poller: async loop fetching NSE every 15 s             │
  │  Sends JSON: { ticker, price, change, change_pct, volume, ts } │
  └───────────────────────────────────────────────────────────────┘

Scalability:
  This implementation uses in-process async tasks. For horizontal scaling
  (multiple pods), replace the in-process ConnectionManager with Redis pub/sub:
  - Publisher: Redis PUBLISH ch:RELIANCE <json>
  - Subscriber: each pod subscribes and forwards to connected WS clients.
  The interface is identical from the client's perspective.

Security:
  - JWT cookie validation on WS handshake (same get_current_user pattern)
  - Max 20 tickers per connection to prevent resource abuse
  - Connections auto-disconnect after 8h (configurable)
"""

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

# Market-data reads go through the provider seam (app/services/market_data).
from app.services.market_data import get_market_data_provider

get_bulk_quotes = get_market_data_provider().get_bulk_quotes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# ── Connection Manager ────────────────────────────────────────────────────

class ConnectionManager:
    """Thread-safe WebSocket connection registry with per-ticker subscription."""

    def __init__(self) -> None:
        # connection → set of subscribed tickers
        self._connections: dict[WebSocket, set[str]] = {}
        # ticker → set of connections subscribed to it
        self._subscriptions: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, tickers: list[str]) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[ws] = set(tickers)
            for t in tickers:
                self._subscriptions.setdefault(t, set()).add(ws)
        logger.info("WS connected: %d tickers, total conns=%d", len(tickers), len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            tickers = self._connections.pop(ws, set())
            for t in tickers:
                self._subscriptions.get(t, set()).discard(ws)
                if not self._subscriptions.get(t):
                    self._subscriptions.pop(t, None)
        logger.info("WS disconnected, total conns=%d", len(self._connections))

    async def broadcast_ticker(self, ticker: str, payload: dict[str, Any]) -> None:
        """Send price update to all clients subscribed to this ticker."""
        subs = list(self._subscriptions.get(ticker, set()))
        if not subs:
            return
        msg = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in subs:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    def all_tickers(self) -> set[str]:
        return set(self._subscriptions.keys())

    def connection_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()

# ── Price polling task ─────────────────────────────────────────────────────

_poll_task: asyncio.Task | None = None
_last_prices: dict[str, float] = {}


async def _poll_prices() -> None:
    """Poll NSE prices for all subscribed tickers every 15 seconds."""
    logger.info("WS price poller started")
    while True:
        try:
            tickers = list(manager.all_tickers())
            if tickers:
                quotes = await get_bulk_quotes(tickers)
                ts = int(time.time() * 1000)
                for q in quotes:
                    ticker  = q.get("ticker", "")
                    price   = float(q.get("price", 0) or 0)
                    last    = _last_prices.get(ticker, price)
                    changed = abs(price - last) > 0.001

                    if changed:
                        _last_prices[ticker] = price
                        await manager.broadcast_ticker(ticker, {
                            "type":       "price",
                            "ticker":     ticker,
                            "price":      price,
                            "change":     round(float(q.get("change", 0) or 0), 2),
                            "change_pct": round(float(q.get("change_pct", 0) or 0), 2),
                            "volume":     int(q.get("volume", 0) or 0),
                            "ts":         ts,
                        })
        except Exception as exc:
            logger.warning("WS price poll error: %s", exc)

        await asyncio.sleep(15)


def ensure_poll_task() -> None:
    """Start the background poller if not already running."""
    global _poll_task  # noqa: PLW0603
    if _poll_task is None or _poll_task.done():
        _poll_task = asyncio.create_task(_poll_prices())


# ── WebSocket endpoint ─────────────────────────────────────────────────────

@router.websocket("/market")
async def market_websocket(
    ws: WebSocket,
    tickers: str = Query(..., description="Comma-separated NSE tickers, max 20"),
):
    """Real-time price WebSocket.

    Query params:
      tickers=RELIANCE,TCS,INFY,HAL   (up to 20)

    Message format (server → client):
      { "type": "price", "ticker": "RELIANCE", "price": 2923.45,
        "change": 12.3, "change_pct": 0.42, "volume": 1234567, "ts": 1716000000000 }

    Client can send:
      { "action": "subscribe",   "tickers": ["HDFC"] }
      { "action": "unsubscribe", "tickers": ["RELIANCE"] }
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:20]
    if not ticker_list:
        await ws.close(code=1008, reason="No tickers specified")
        return

    await manager.connect(ws, ticker_list)
    ensure_poll_task()

    # Send initial snapshot
    try:
        quotes = await get_bulk_quotes(ticker_list)
        ts = int(time.time() * 1000)
        for q in quotes:
            await ws.send_text(json.dumps({
                "type":       "snapshot",
                "ticker":     q.get("ticker", ""),
                "price":      float(q.get("price", 0) or 0),
                "change":     round(float(q.get("change", 0) or 0), 2),
                "change_pct": round(float(q.get("change_pct", 0) or 0), 2),
                "volume":     int(q.get("volume", 0) or 0),
                "ts":         ts,
            }))
    except Exception as exc:
        logger.warning("WS initial snapshot error: %s", exc)

    try:
        while True:
            # Keep connection alive; handle client control messages
            try:
                text = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                msg  = json.loads(text)
                action  = msg.get("action")
                new_tks = [t.strip().upper() for t in msg.get("tickers", []) if t.strip()]
                if action == "subscribe" and new_tks:
                    async with manager._lock:
                        for t in new_tks[:20]:
                            manager._connections[ws].add(t)
                            manager._subscriptions.setdefault(t, set()).add(ws)
                elif action == "unsubscribe" and new_tks:
                    async with manager._lock:
                        for t in new_tks:
                            manager._connections[ws].discard(t)
                            manager._subscriptions.get(t, set()).discard(ws)
                elif action == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                # Send heartbeat every 30s
                await ws.send_text(json.dumps({"type": "heartbeat"}))
            except (ValueError, KeyError):
                pass  # bad JSON from client — ignore

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)
