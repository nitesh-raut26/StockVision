"""Data fetcher for NSE/BSE stock data.

Data source strategy:
  PRIMARY  — NSE India public API (nseindia.com/api):
    • Session cookie refresh via httpx.AsyncClient (non-blocking)
    • Nifty 50 bulk endpoint: ONE request returns all 50 stocks
    • Per-ticker equity endpoint: single-stock detail

  FALLBACK — yfinance for individual tickers not in the NSE bulk feed
    • Run in executor to avoid blocking the event loop

  CACHE — in-memory TTL cache to prevent duplicate fetches
"""

import asyncio
import logging
import time
from typing import Any
from urllib.parse import quote

import httpx
import yfinance as yf

logger = logging.getLogger(__name__)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# ── In-memory TTL cache ──────────────────────────────────────────────────────
_cache: dict[str, tuple[Any, float]] = {}
NSE_BULK_TTL     = 180
QUOTE_TTL        = 300
FUNDAMENTALS_TTL = 3600
HISTORY_TTL      = 900


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() < entry[1]:
        return entry[0]
    return None


def _cache_set(key: str, value: Any, ttl: float) -> None:
    _cache[key] = (value, time.time() + ttl)


# ── Async NSE session ─────────────────────────────────────────────────────────
_NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept":          "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.nseindia.com/",
}
_NSE_BASE = "https://www.nseindia.com/api"
_NSE_HOME = "https://www.nseindia.com/"

_nse_cookies: dict[str, str] = {}
_nse_cookie_lock = asyncio.Lock()
_nse_cookie_fetched_at: float = 0.0
_NSE_COOKIE_TTL = 600  # re-fetch cookies every 10 minutes


async def _refresh_nse_cookies() -> dict[str, str]:
    global _nse_cookies, _nse_cookie_fetched_at
    async with _nse_cookie_lock:
        if time.time() - _nse_cookie_fetched_at < _NSE_COOKIE_TTL and _nse_cookies:
            return _nse_cookies
        try:
            async with httpx.AsyncClient(headers=_NSE_HEADERS, follow_redirects=True, timeout=15) as client:
                resp = await client.get(_NSE_HOME)
                _nse_cookies = dict(resp.cookies)
                _nse_cookie_fetched_at = time.time()
                logger.info("NSE cookies refreshed")
        except Exception as exc:
            logger.warning("NSE cookie refresh failed: %s", exc)
    return _nse_cookies


async def _nse_get(path: str, timeout: int = 10) -> httpx.Response | None:
    """GET NSE API path; refreshes cookies on 401/403/empty response."""
    cookies = await _refresh_nse_cookies()
    url = f"{_NSE_BASE}{path}"
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(headers=_NSE_HEADERS, cookies=cookies, timeout=timeout) as client:
                resp = await client.get(url)
            if resp.status_code in (401, 403) or not resp.content:
                logger.info("NSE cookie refresh (attempt %d)", attempt + 1)
                _nse_cookie_fetched_at = 0  # force refresh
                cookies = await _refresh_nse_cookies()
                continue
            return resp
        except httpx.TimeoutException:
            logger.warning("NSE timeout for %s (attempt %d)", path, attempt + 1)
        except Exception as exc:
            logger.warning("NSE request error for %s: %s", path, exc)
            if attempt == 1:
                break
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1 — NSE bulk index fetch
# ═══════════════════════════════════════════════════════════════════════════════

async def get_bulk_price_data(symbols: list[str] | None = None) -> dict[str, dict[str, Any]]:
    cache_key = "nse_bulk"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = await _nse_get("/equity-stockIndices?index=NIFTY%2050", timeout=15)
        if resp is None or resp.status_code != 200:
            return {}

        stocks = resp.json().get("data", [])
        result: dict[str, dict[str, Any]] = {}

        for s in stocks:
            sym = s.get("symbol", "").upper()
            if not sym or sym == "NIFTY 50":
                continue
            try:
                price      = float(s.get("lastPrice", 0) or 0)
                prev_close = float(s.get("previousClose", price) or price)
                result[sym] = {
                    "price":      round(price, 2),
                    "change":     round(price - prev_close, 2),
                    "change_pct": round(float(s.get("pChange", 0) or 0), 2),
                    "volume":     int(s.get("totalTradedVolume", 0) or 0),
                    "market_cap": float(s.get("ffmc", 0) or 0) * 1e7,
                }
            except Exception as exc:
                logger.debug("NSE bulk parse error for %s: %s", sym, exc)

        if result:
            _cache_set(cache_key, result, NSE_BULK_TTL)
        logger.info("NSE bulk: %d tickers", len(result))
        return result
    except Exception as exc:
        logger.error("NSE bulk fetch failed: %s", exc)
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 2 — NSE per-ticker detail
# ═══════════════════════════════════════════════════════════════════════════════

async def _nse_quote(symbol: str) -> dict[str, Any] | None:
    try:
        resp = await _nse_get(f"/quote-equity?symbol={quote(symbol)}", timeout=10)
        if resp is None or resp.status_code != 200 or not resp.content:
            return None
        data = resp.json()
        pi   = data.get("priceInfo", {})
        info = data.get("info", {})
        meta = data.get("metadata", {})
        price = float(pi.get("lastPrice", 0) or 0)
        prev  = float(pi.get("previousClose", price) or price)
        return {
            "symbol":     symbol.upper(),
            "name":       info.get("companyName", symbol),
            "price":      round(price, 2),
            "change":     round(price - prev, 2),
            "change_pct": round(float(pi.get("pChange", 0) or 0), 2),
            "volume":     int(pi.get("totalTradedVolume", 0) or 0),
            "market_cap": 0,
            "sector":     meta.get("industry"),
            "pe_ratio":   None,
            "week_52_high": float(pi.get("weekHighLow", {}).get("max", 0) or 0) or None,
            "week_52_low":  float(pi.get("weekHighLow", {}).get("min", 0) or 0) or None,
        }
    except Exception as exc:
        logger.warning("NSE per-ticker failed for %s: %s", symbol, exc)
        return None


# ── yfinance fallback (runs in executor — doesn't block event loop) ───────────
_YF_SEMAPHORE = asyncio.Semaphore(1)


def _nse_ticker(symbol: str) -> str:
    symbol = symbol.upper().strip()
    if symbol.startswith("^") or symbol.endswith((".NS", ".BO")):
        return symbol
    return f"{symbol}.NS"


def _fetch_yf_fundamentals_sync(ticker: str) -> dict[str, Any]:
    yf_sym = _nse_ticker(ticker)
    info = yf.Ticker(yf_sym).info

    revenue_growth = None
    try:
        fin = yf.Ticker(yf_sym).financials
        if fin is not None and not fin.empty and "Total Revenue" in fin.index:
            rev = fin.loc["Total Revenue"].dropna()
            if len(rev) >= 2:
                revenue_growth = round((rev.iloc[0] - rev.iloc[1]) / abs(rev.iloc[1]) * 100, 2)
    except Exception:
        pass

    return {
        "pe_ratio":       info.get("trailingPE"),
        "pb_ratio":       info.get("priceToBook"),
        "eps":            info.get("trailingEps"),
        "roe":            info.get("returnOnEquity"),
        "roce":           info.get("returnOnAssets"),
        "debt_equity":    info.get("debtToEquity"),
        "promoter_holding": None,
        "revenue_growth": revenue_growth,
        "dividend_yield": info.get("dividendYield"),
        "free_cash_flow": info.get("freeCashflow"),
        "beta":           info.get("beta"),
        "description":    info.get("longBusinessSummary"),
    }


def _fetch_history_sync(ticker: str, period: str = "1y") -> list[dict]:
    yf_sym = _nse_ticker(ticker)
    hist = yf.Ticker(yf_sym).history(period=period, interval="1d")
    records = []
    for ts, row in hist.iterrows():
        records.append({
            "date":   ts.strftime("%Y-%m-%d"),
            "open":   round(float(row["Open"]),   2),
            "high":   round(float(row["High"]),   2),
            "low":    round(float(row["Low"]),    2),
            "close":  round(float(row["Close"]),  2),
            "volume": int(row["Volume"]),
        })
    return records


# ── Async public API ──────────────────────────────────────────────────────────

async def _get_all(ticker: str) -> dict[str, Any]:
    q_key = f"quote:{ticker}"
    f_key = f"fundamentals:{ticker}"

    cached_q = _cache_get(q_key)
    cached_f = _cache_get(f_key)
    if cached_q and cached_f:
        return {"quote": cached_q, "fundamentals": cached_f}

    nse_quote = await _nse_quote(ticker)

    if nse_quote:
        quote = {
            "ticker":      ticker.upper(),
            "name":        nse_quote.get("name", ticker),
            "price":       nse_quote.get("price", 0),
            "change":      nse_quote.get("change", 0),
            "change_pct":  nse_quote.get("change_pct", 0),
            "volume":      nse_quote.get("volume", 0),
            "market_cap":  nse_quote.get("market_cap", 0),
            "pe_ratio":    None,
            "week_52_high": nse_quote.get("week_52_high"),
            "week_52_low":  nse_quote.get("week_52_low"),
            "sector":      nse_quote.get("sector"),
        }
    else:
        quote = {
            "ticker": ticker.upper(), "name": ticker, "price": 0,
            "change": 0, "change_pct": 0, "volume": 0, "market_cap": 0,
            "pe_ratio": None, "week_52_high": None, "week_52_low": None, "sector": None,
        }

    if cached_f:
        fundamentals = cached_f
    else:
        try:
            async with _YF_SEMAPHORE:
                loop = asyncio.get_event_loop()
                fundamentals = await loop.run_in_executor(None, _fetch_yf_fundamentals_sync, ticker)
            if fundamentals.get("pe_ratio") and not quote.get("pe_ratio"):
                quote["pe_ratio"] = fundamentals["pe_ratio"]
        except Exception as exc:
            logger.warning("yfinance fundamentals failed for %s: %s", ticker, exc)
            fundamentals = {
                "pe_ratio": None, "pb_ratio": None, "eps": None,
                "roe": None, "roce": None, "debt_equity": None,
                "promoter_holding": None, "revenue_growth": None,
                "dividend_yield": None, "free_cash_flow": None,
                "beta": None, "description": None,
            }

    _cache_set(q_key, quote,        QUOTE_TTL)
    _cache_set(f_key, fundamentals, FUNDAMENTALS_TTL)
    return {"quote": quote, "fundamentals": fundamentals}


async def get_quote(ticker: str) -> dict[str, Any]:
    data = await _get_all(ticker)
    return data["quote"]


async def get_fundamentals(ticker: str) -> dict[str, Any]:
    data = await _get_all(ticker)
    return data["fundamentals"]


async def get_history(ticker: str, period: str = "1y") -> list[dict]:
    key = f"history:{ticker}:{period}"
    cached = _cache_get(key)
    if cached:
        return cached

    try:
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, _fetch_history_sync, ticker, period)
        _cache_set(key, data, HISTORY_TTL)
        return data
    except Exception as exc:
        logger.warning("History fetch failed for %s: %s", ticker, exc)
        return []


async def get_bulk_quotes(tickers: list[str]) -> list[dict[str, Any]]:
    tasks = [_get_all(t) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r["quote"] for r in results if isinstance(r, dict) and "quote" in r]


async def get_news(ticker: str | None = None, limit: int = 20) -> list[dict]:
    """Fetch market news via yfinance.

    If ticker is provided, returns news for that specific stock.
    Otherwise, returns general market news (NIFTY 50).
    """
    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            import time as _time
            yf_t = ticker if not ticker else f"{ticker}.NS"
            obj   = yf.Ticker(yf_t or "^NSEI")
            news_raw = getattr(obj, "news", []) or []
            results = []
            for n in news_raw[:limit]:
                # yfinance news item structure varies; handle both v1 and v2 shapes
                content = n.get("content", n)
                title = (
                    content.get("title")
                    or n.get("title")
                    or ""
                )
                url = (
                    content.get("canonicalUrl", {}).get("url", "")
                    or content.get("clickThroughUrl", {}).get("url", "")
                    or n.get("link", "")
                )
                pub_ts = (
                    n.get("providerPublishTime")
                    or (content.get("pubDate") and 0)
                    or int(_time.time())
                )
                results.append({
                    "title":     title,
                    "url":       url,
                    "publisher": (content.get("provider", {}).get("displayName") or n.get("publisher", "")),
                    "published_at": int(pub_ts) if isinstance(pub_ts, (int, float)) else int(_time.time()),
                    "ticker":    ticker or "NIFTY",
                })
            return results

        return await loop.run_in_executor(None, _fetch)
    except Exception:
        return []


async def search_stocks(query: str, limit: int = 10) -> list[dict]:
    try:
        resp = await _nse_get(f"/search-autocomplete?q={quote(query)}", timeout=8)
        if resp and resp.status_code == 200 and resp.content:
            symbols = resp.json().get("symbols", [])
            return [
                {
                    "ticker":   s.get("symbol", ""),
                    "name":     s.get("symbol_info", s.get("symbol", "")),
                    "exchange": "NSE",
                    "type":     s.get("result_type", "equity"),
                }
                for s in symbols[:limit]
                if s.get("result_type") in ("equity", "ETF", None, "")
            ]
    except Exception:
        pass

    # yfinance fallback
    try:
        loop = asyncio.get_event_loop()
        def _yf_search():
            try:
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                }
                resp = httpx.get(
                    "https://query2.finance.yahoo.com/v1/finance/search",
                    params={"q": query, "quotesCount": limit},
                    headers=headers,
                    timeout=5,
                )
                if resp.status_code == 200:
                    quotes = resp.json().get("quotes", [])
                    return [
                        {
                            "ticker":   q.get("symbol", "").replace(".NS", ""),
                            "name":     q.get("longname") or q.get("shortname") or "",
                            "exchange": q.get("exchange", ""),
                            "type":     q.get("quoteType", ""),
                        }
                        for q in quotes
                        if q.get("exchange") in ("NSE", "BSE")
                    ]
            except Exception as exc:
                logger.warning("yfinance fallback search failed: %s", exc)
            return []
        return await loop.run_in_executor(None, _yf_search)
    except Exception:
        return []
