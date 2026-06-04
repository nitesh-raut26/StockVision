"""Market-data provider package — the single seam for reading market data.

Today the app reads NSE/BSE data through NSE's public API with a yfinance fallback
(`NseYfinanceProvider`). yfinance is not production-grade; moving to a licensed feed
(Global Datafeeds, TrueData, a broker feed, etc.) should be a *drop-in*: implement
`MarketDataProvider`, register it below, and set `MARKET_DATA_PROVIDER` in the env —
no call-site changes.

Call sites should depend on `get_market_data_provider()` rather than importing
`app.services.data_fetcher` directly. `data_fetcher` is the NSE/yfinance
*implementation detail* that the default provider delegates to.
"""

from functools import lru_cache

from app.core.config import settings
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.nse_yfinance import NseYfinanceProvider

# Registry of available providers, keyed by the MARKET_DATA_PROVIDER setting.
_PROVIDERS: dict[str, type[MarketDataProvider]] = {
    "nse_yfinance": NseYfinanceProvider,
}


@lru_cache(maxsize=1)
def get_market_data_provider() -> MarketDataProvider:
    """Return the configured market-data provider (cached singleton)."""
    key = (settings.market_data_provider or "nse_yfinance").lower()
    provider_cls = _PROVIDERS.get(key, NseYfinanceProvider)
    return provider_cls()


__all__ = ["MarketDataProvider", "NseYfinanceProvider", "get_market_data_provider"]
