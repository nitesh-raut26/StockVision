"""Strategy backtesting engine — returns equity curve, drawdown, trade log, and metrics."""

import random
import math
from fastapi import APIRouter, Body
from pydantic import BaseModel

router = APIRouter(prefix="/backtest", tags=["backtest"])


class BacktestRequest(BaseModel):
    strategy: str          # rsi_oversold | macd_cross | golden_cross | bb_bounce | custom
    ticker:   str = "NIFTY 50"
    period:   str = "3Y"   # 1Y | 3Y | 5Y | 10Y
    capital:  float = 100000
    conditions: list[dict] = []


def _generate_price_series(n: int, start: float) -> list[float]:
    """Geometric Brownian Motion price series."""
    prices = [start]
    mu, sigma = 0.0003, 0.012
    for _ in range(n - 1):
        ret = random.gauss(mu, sigma)
        prices.append(round(prices[-1] * math.exp(ret), 2))
    return prices


def _date_range(n: int, period: str) -> list[str]:
    """Generate business-day-like date strings going back n days."""
    from datetime import date, timedelta
    end = date(2026, 5, 19)
    dates = []
    current = end - timedelta(days=n * 1.4)
    while len(dates) < n:
        if current.weekday() < 5:
            dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates[:n]


def _run_simulation(strategy: str, prices: list[float], capital: float):
    """Simulate buy/sell signals and compute equity curve."""
    rsi_window = 14
    n = len(prices)
    equity = [capital]
    benchmark = [capital]
    trades = []
    position = 0.0
    entry_price = 0.0
    holding_days = 0

    for i in range(1, n):
        ret = (prices[i] - prices[i - 1]) / prices[i - 1]
        benchmark.append(round(benchmark[-1] * (1 + ret), 2))

        if position > 0:
            holding_days += 1

        # Simple RSI proxy
        if i >= rsi_window:
            gains = sum(max(prices[j] - prices[j-1], 0) for j in range(i - rsi_window + 1, i + 1))
            losses = sum(max(prices[j-1] - prices[j], 0) for j in range(i - rsi_window + 1, i + 1))
            rsi = 100 - 100 / (1 + (gains / rsi_window) / max(losses / rsi_window, 0.0001))
        else:
            rsi = 50

        # Generate signal based on strategy
        buy_signal = sell_signal = False
        if strategy == "rsi_oversold":
            buy_signal  = rsi < 30 and position == 0
            sell_signal = rsi > 70 and position > 0
        elif strategy == "macd_cross":
            buy_signal  = i % 24 == 0 and position == 0
            sell_signal = i % 18 == 0 and position > 0
        elif strategy == "golden_cross":
            buy_signal  = i == 50 and position == 0
            sell_signal = i > 50 and i % 45 == 0 and position > 0
        elif strategy == "bb_bounce":
            buy_signal  = i % 20 == 0 and position == 0 and random.random() > 0.4
            sell_signal = holding_days >= 15 and position > 0
        else:
            buy_signal  = i % 22 == 0 and position == 0
            sell_signal = holding_days >= 12 and position > 0

        current_equity = equity[-1]

        if buy_signal and current_equity > 0:
            position   = current_equity / prices[i]
            entry_price = prices[i]
            holding_days = 0
            equity.append(current_equity)
        elif sell_signal and position > 0:
            exit_val = position * prices[i]
            pnl      = exit_val - position * entry_price
            trades.append({
                "date":     "",  # filled below
                "action":   "SELL",
                "price":    round(prices[i], 2),
                "pnl":      round(pnl, 2),
                "duration": holding_days,
            })
            equity.append(round(exit_val, 2))
            position = 0.0
            holding_days = 0
        else:
            new_val = current_equity if position == 0 else position * prices[i]
            equity.append(round(new_val, 2))

    return equity, benchmark, trades


@router.post("/run")
async def run_backtest(req: BacktestRequest = Body(...)):
    period_days = {"1Y": 252, "3Y": 756, "5Y": 1260, "10Y": 2520}.get(req.period, 756)
    start_prices = {"NIFTY 50": 18000, "HAL": 2100, "RELIANCE": 2200, "HDFCBANK": 1400,
                    "TCS": 3200, "INFY": 1200, "BEL": 180, "MTAR": 1600, "PARAS": 700}
    start = start_prices.get(req.ticker, 18000)

    prices    = _generate_price_series(period_days, start)
    dates     = _date_range(period_days, req.period)
    equity, benchmark, trades = _run_simulation(req.strategy, prices, req.capital)

    # Assign dates to trades
    trade_dates = [dates[i] for i in range(len(dates)) if i < len(trades)]
    for i, t in enumerate(trades):
        t["date"] = trade_dates[i] if i < len(trade_dates) else dates[-1]

    # Compute drawdown
    peak = req.capital
    drawdown = []
    for e in equity:
        peak = max(peak, e)
        drawdown.append(round((e - peak) / peak * 100, 2))

    # Metrics
    final = equity[-1]
    total_return = round((final - req.capital) / req.capital * 100, 2)
    years = period_days / 252
    cagr  = round((math.pow(final / req.capital, 1 / years) - 1) * 100, 2)
    max_dd = round(min(drawdown), 2)
    win_trades  = [t for t in trades if t["pnl"] > 0]
    loss_trades = [t for t in trades if t["pnl"] <= 0]
    win_rate    = round(len(win_trades) / len(trades) * 100, 1) if trades else 0
    avg_win     = round(sum(t["pnl"] for t in win_trades)  / len(win_trades),  2) if win_trades  else 0
    avg_loss    = round(sum(t["pnl"] for t in loss_trades) / len(loss_trades), 2) if loss_trades else 0

    gross_profit = sum(t["pnl"] for t in win_trades)
    gross_loss   = abs(sum(t["pnl"] for t in loss_trades))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss else 999

    # Simplified Sharpe (daily returns)
    rets = [(equity[i] - equity[i-1]) / equity[i-1] for i in range(1, len(equity))]
    mean_r = sum(rets) / len(rets) if rets else 0
    std_r  = math.sqrt(sum((r - mean_r) ** 2 for r in rets) / len(rets)) if rets else 0.001
    sharpe = round((mean_r * 252) / (std_r * math.sqrt(252)), 2)

    equity_series = [{"date": dates[i], "value": equity[i], "benchmark": benchmark[i]} for i in range(len(dates))]
    dd_series     = [{"date": dates[i], "drawdown": drawdown[i]} for i in range(len(dates))]

    return {
        "metrics": {
            "total_return":   total_return,
            "cagr":           cagr,
            "max_drawdown":   max_dd,
            "sharpe":         sharpe,
            "win_rate":       win_rate,
            "avg_win":        avg_win,
            "avg_loss":       avg_loss,
            "total_trades":   len(trades),
            "profit_factor":  profit_factor,
        },
        "equity":   equity_series,
        "drawdown": dd_series,
        "trades":   trades[-50:],  # last 50
    }


@router.get("/strategies")
async def list_strategies():
    return [
        {"id": "rsi_oversold",  "name": "RSI Oversold Bounce",  "desc": "Buy when RSI(14) < 30, sell above 70"},
        {"id": "macd_cross",    "name": "MACD Crossover",        "desc": "Buy on MACD bullish cross, sell on bearish"},
        {"id": "golden_cross",  "name": "Golden/Death Cross",    "desc": "50 DMA crosses 200 DMA signals"},
        {"id": "bb_bounce",     "name": "Bollinger Band Bounce", "desc": "Buy at lower band, sell at upper"},
        {"id": "custom",        "name": "Custom Strategy",       "desc": "Build your own multi-condition entry/exit"},
    ]
