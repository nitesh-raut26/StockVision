"""Abstract market-data provider interface.

Any data backend (NSE public API, a licensed feed, a broker feed, a test double)
implements this interface. The method surface mirrors the functions the app already
relies on, so swapping the backend requires no call-site changes.
"""

from abc import ABC, abstractmethod
from typing import Any


class MarketDataProvider(ABC):
    """Read-only market-data access. All methods are async and must degrade
    gracefully (return empty/zeroed data) rather than raise on upstream failure —
    the UI surfaces live/demo state via the frontend SystemStatus component."""

    #: Stable identifier, also reported by the provider for observability.
    name: str = "abstract"

    @abstractmethod
    async def get_quote(self, ticker: str) -> dict[str, Any]:
        """Latest price/volume/52w snapshot for one ticker."""

    @abstractmethod
    async def get_fundamentals(self, ticker: str) -> dict[str, Any]:
        """Valuation/quality fundamentals (PE, PB, ROE, growth, …) for one ticker."""

    @abstractmethod
    async def get_history(self, ticker: str, period: str = "1y") -> list[dict]:
        """Daily OHLCV history for the given period."""

    @abstractmethod
    async def get_bulk_quotes(self, tickers: list[str]) -> list[dict[str, Any]]:
        """Quotes for many tickers (concurrent)."""

    @abstractmethod
    async def get_bulk_price_data(
        self, symbols: list[str] | None = None
    ) -> dict[str, dict[str, Any]]:
        """Index-level bulk price map (e.g. one NSE call for all of NIFTY 50)."""

    @abstractmethod
    async def get_news(self, ticker: str | None = None, limit: int = 20) -> list[dict]:
        """Market or per-ticker news."""

    @abstractmethod
    async def search_stocks(self, query: str, limit: int = 10) -> list[dict]:
        """Symbol search / autocomplete."""
