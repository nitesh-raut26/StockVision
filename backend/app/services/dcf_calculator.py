"""DCF (Discounted Cash Flow) valuation engine for Indian stocks."""

import asyncio
from typing import Any
from app.services.data_fetcher import _get_all


def compute_dcf(
    free_cash_flow: float,
    revenue_growth_rate: float,
    terminal_growth_rate: float = 0.05,
    wacc: float = 0.12,
    projection_years: int = 10,
    shares_outstanding: int = 1,
    net_debt: float = 0.0,
) -> dict[str, Any]:
    """
    Gordon Growth / DCF model.

    Args:
        free_cash_flow: Base FCF (INR crores or absolute)
        revenue_growth_rate: Projected FCF growth (e.g. 0.15 for 15%)
        terminal_growth_rate: Perpetuity growth after projection period
        wacc: Weighted average cost of capital (e.g. 0.12)
        projection_years: Number of explicit forecast years
        shares_outstanding: Number of shares for per-share value
        net_debt: Net debt (positive = net debt, negative = net cash)

    Returns:
        DCF valuation dict with per-share intrinsic value and scenario analysis.
    """
    if wacc <= terminal_growth_rate:
        terminal_growth_rate = wacc - 0.01

    # Project FCFs
    projected_fcfs = []
    fcf = free_cash_flow
    for year in range(1, projection_years + 1):
        # Gradually taper growth toward terminal growth
        taper = (terminal_growth_rate - revenue_growth_rate) / projection_years
        year_growth = revenue_growth_rate + taper * (year - 1)
        fcf = fcf * (1 + year_growth)
        pv = fcf / ((1 + wacc) ** year)
        projected_fcfs.append({
            "year": year,
            "fcf": round(fcf, 2),
            "pv": round(pv, 2),
            "growth_rate": round(year_growth * 100, 2),
        })

    pv_sum = sum(p["pv"] for p in projected_fcfs)

    # Terminal value (Gordon Growth)
    terminal_fcf = fcf * (1 + terminal_growth_rate)
    terminal_value = terminal_fcf / (wacc - terminal_growth_rate)
    pv_terminal = terminal_value / ((1 + wacc) ** projection_years)

    enterprise_value = pv_sum + pv_terminal
    equity_value = enterprise_value - net_debt
    intrinsic_per_share = equity_value / shares_outstanding if shares_outstanding > 0 else 0

    # Scenario analysis (bear / base / bull)
    def _scenario(growth_adj: float, wacc_adj: float) -> float:
        pv_s = 0
        f = free_cash_flow
        for yr in range(1, projection_years + 1):
            taper = (terminal_growth_rate - (revenue_growth_rate + growth_adj)) / projection_years
            g = (revenue_growth_rate + growth_adj) + taper * (yr - 1)
            f = f * (1 + g)
            pv_s += f / ((1 + wacc + wacc_adj) ** yr)
        tv_f = f * (1 + terminal_growth_rate)
        tv = tv_f / ((wacc + wacc_adj) - terminal_growth_rate)
        return (pv_s + tv / ((1 + wacc + wacc_adj) ** projection_years) - net_debt) / max(shares_outstanding, 1)

    return {
        "intrinsic_value_per_share": round(intrinsic_per_share, 2),
        "enterprise_value": round(enterprise_value, 2),
        "equity_value": round(equity_value, 2),
        "pv_fcfs": round(pv_sum, 2),
        "pv_terminal": round(pv_terminal, 2),
        "terminal_value": round(terminal_value, 2),
        "projected_fcfs": projected_fcfs,
        "assumptions": {
            "wacc": wacc,
            "revenue_growth_rate": revenue_growth_rate,
            "terminal_growth_rate": terminal_growth_rate,
            "projection_years": projection_years,
        },
        "scenarios": {
            "bear": round(_scenario(-0.05, 0.02), 2),
            "base": round(intrinsic_per_share, 2),
            "bull": round(_scenario(0.05, -0.02), 2),
        },
    }


async def get_dcf_valuation(ticker: str, wacc: float = 0.12, growth_years: int = 10) -> dict[str, Any]:
    """Fetch live data and compute DCF valuation.

    Bug fix: previously called get_quote() and get_fundamentals() concurrently
    via asyncio.gather which triggered two .info requests to Yahoo for the same
    ticker.  Now uses _get_all() for a single shared .info call.
    """
    all_data = await _get_all(ticker)
    quote = all_data["quote"]
    fundamentals = all_data["fundamentals"]

    fcf = fundamentals.get("free_cash_flow") or 0
    revenue_growth = (fundamentals.get("revenue_growth") or 12) / 100
    current_price = quote.get("price", 0)
    # Prefer yfinance sharesOutstanding; fall back to market_cap/price as last resort.
    # NSE scraper returns market_cap=0 for most tickers, making the division useless.
    shares = (
        fundamentals.get("shares_outstanding")
        or (quote.get("market_cap", 0) / current_price if current_price > 0 else None)
        or 1
    )

    result = compute_dcf(
        free_cash_flow=fcf,
        revenue_growth_rate=revenue_growth,
        wacc=wacc,
        projection_years=growth_years,
        shares_outstanding=shares,
    )

    upside = None
    if current_price and result["intrinsic_value_per_share"]:
        upside = round((result["intrinsic_value_per_share"] - current_price) / current_price * 100, 2)

    result.update({
        "ticker": ticker,
        "current_price": current_price,
        "upside_pct": upside,
        "recommendation": "BUY" if (upside or 0) > 20 else ("HOLD" if (upside or 0) > -10 else "SELL"),
    })

    return result
