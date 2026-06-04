"""Unit tests for the MarketDataProvider seam (no DB or network)."""

import pytest

from app.services import data_fetcher
from app.services.market_data import MarketDataProvider, get_market_data_provider
from app.services.market_data.nse_yfinance import NseYfinanceProvider

pytestmark = pytest.mark.unit

_INTERFACE = (
    "get_quote", "get_fundamentals", "get_history", "get_bulk_quotes",
    "get_bulk_price_data", "get_news", "search_stocks",
)


def test_factory_returns_default_nse_yfinance_provider():
    provider = get_market_data_provider()
    assert isinstance(provider, NseYfinanceProvider)
    assert isinstance(provider, MarketDataProvider)
    assert provider.name == "nse_yfinance"


def test_factory_is_singleton():
    assert get_market_data_provider() is get_market_data_provider()


def test_provider_implements_full_interface():
    provider = get_market_data_provider()
    for method in _INTERFACE:
        assert callable(getattr(provider, method))


async def test_get_quote_delegates_to_data_fetcher(monkeypatch):
    sentinel = {"ticker": "TEST", "price": 123.0}

    async def fake_get_quote(ticker):
        assert ticker == "TEST"
        return sentinel

    monkeypatch.setattr(data_fetcher, "get_quote", fake_get_quote)
    result = await NseYfinanceProvider().get_quote("TEST")
    assert result is sentinel


async def test_bulk_and_search_delegate(monkeypatch):
    async def fake_bulk(tickers):
        return [{"ticker": t} for t in tickers]

    async def fake_search(query, limit):
        return [{"ticker": "RELIANCE", "q": query, "limit": limit}]

    monkeypatch.setattr(data_fetcher, "get_bulk_quotes", fake_bulk)
    monkeypatch.setattr(data_fetcher, "search_stocks", fake_search)

    provider = NseYfinanceProvider()
    assert await provider.get_bulk_quotes(["A", "B"]) == [{"ticker": "A"}, {"ticker": "B"}]
    assert (await provider.search_stocks("rel", 5))[0]["limit"] == 5


def test_provider_is_swappable_via_setting(monkeypatch):
    """Proves the licensed-feed swap mechanism: register a provider + point the
    MARKET_DATA_PROVIDER setting at it, and the factory returns it."""
    import app.services.market_data as md

    class FakeProvider(MarketDataProvider):
        name = "fake"

        async def get_quote(self, ticker): return {"ticker": ticker, "src": "fake"}
        async def get_fundamentals(self, ticker): return {}
        async def get_history(self, ticker, period="1y"): return []
        async def get_bulk_quotes(self, tickers): return []
        async def get_bulk_price_data(self, symbols=None): return {}
        async def get_news(self, ticker=None, limit=20): return []
        async def search_stocks(self, query, limit=10): return []

    monkeypatch.setitem(md._PROVIDERS, "fake", FakeProvider)
    monkeypatch.setattr(md.settings, "market_data_provider", "fake")
    md.get_market_data_provider.cache_clear()
    try:
        provider = md.get_market_data_provider()
        assert isinstance(provider, FakeProvider)
        assert provider.name == "fake"
    finally:
        md.get_market_data_provider.cache_clear()  # restore default singleton for other tests
