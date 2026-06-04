"""Default market-data provider: NSE public API (primary) + yfinance (fallback).

This is a thin adapter over `app.services.data_fetcher`, which holds the existing
NSE session handling, yfinance executors, and in-memory TTL cache. Keeping the
implementation in `data_fetcher` means this migration changes *behaviour by zero* —
it only introduces the swap seam.
"""

from typing import Any

from app.services import data_fetcher
from app.services.market_data.base import MarketDataProvider


class NseYfinanceProvider(MarketDataProvider):
    name = "nse_yfinance"

    async def get_quote(self, ticker: str) -> dict[str, Any]:
        return await data_fetcher.get_quote(ticker)

    async def get_fundamentals(self, ticker: str) -> dict[str, Any]:
        return await data_fetcher.get_fundamentals(ticker)

    async def get_history(self, ticker: str, period: str = "1y") -> list[dict]:
        return await data_fetcher.get_history(ticker, period)

    async def get_bulk_quotes(self, tickers: list[str]) -> list[dict[str, Any]]:
        return await data_fetcher.get_bulk_quotes(tickers)

    async def get_bulk_price_data(
        self, symbols: list[str] | None = None
    ) -> dict[str, dict[str, Any]]:
        return await data_fetcher.get_bulk_price_data(symbols)

    async def get_news(self, ticker: str | None = None, limit: int = 20) -> list[dict]:
        return await data_fetcher.get_news(ticker, limit)

    async def search_stocks(self, query: str, limit: int = 10) -> list[dict]:
        return await data_fetcher.search_stocks(query, limit)
