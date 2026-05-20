"""Indian capital gains tax calculator (STCG / LTCG) with tax-loss harvesting."""

from datetime import date
from typing import Any

# Indian tax rates (FY 2024-25, post Budget 2024)
STCG_RATE = 0.20   # 20% for equity STCG (held < 12 months)
LTCG_RATE = 0.125  # 12.5% for equity LTCG above 1.25 lakh
LTCG_EXEMPTION = 125_000  # INR 1,25,000 per FY


def _is_long_term(buy_date: date, sell_date: date | None = None) -> bool:
    sell_date = sell_date or date.today()
    return (sell_date - buy_date).days > 365


def compute_tax_summary(holdings: list[dict], transactions: list[dict]) -> dict[str, Any]:
    """
    Compute STCG/LTCG tax liability from transactions.

    holdings: [{ ticker, qty, avg_price, current_price, buy_date }]
    transactions: [{ ticker, action, qty, price, transaction_date }]
    """
    stcg_gains = 0.0
    ltcg_gains = 0.0

    # Process completed sell transactions this FY
    fy_start = date(date.today().year if date.today().month >= 4 else date.today().year - 1, 4, 1)

    sells = [t for t in transactions if t.get("action") == "SELL" and
             date.fromisoformat(str(t["transaction_date"])) >= fy_start]

    buys_map: dict[str, list] = {}
    for t in transactions:
        if t.get("action") == "BUY":
            buys_map.setdefault(t["ticker"], []).append(t)

    for sell in sells:
        ticker = sell["ticker"]
        sell_price = float(sell["price"])
        sell_qty = int(sell["qty"])
        sell_date = date.fromisoformat(str(sell["transaction_date"]))

        # FIFO cost basis
        cost_basis = 0.0
        buy_date_used = None
        remaining = sell_qty
        for buy in sorted(buys_map.get(ticker, []), key=lambda x: x["transaction_date"]):
            if remaining <= 0:
                break
            b_qty = min(int(buy["qty"]), remaining)
            cost_basis += b_qty * float(buy["price"])
            buy_date_used = date.fromisoformat(str(buy["transaction_date"]))
            remaining -= b_qty

        gain = (sell_price * sell_qty) - cost_basis
        if buy_date_used and _is_long_term(buy_date_used, sell_date):
            ltcg_gains += gain
        else:
            stcg_gains += gain

    # Unrealised gains / loss-harvesting suggestions
    harvesting_suggestions = []
    for h in holdings:
        current_price = float(h.get("current_price", 0))
        avg_price = float(h.get("avg_price", 0))
        qty = int(h.get("qty", 0))
        unrealised_pnl = (current_price - avg_price) * qty
        buy_date = h.get("buy_date")
        if buy_date:
            buy_date = date.fromisoformat(str(buy_date))
            lt = _is_long_term(buy_date)
        else:
            lt = False

        # Suggest harvesting losses > 5000 INR
        if unrealised_pnl < -5000:
            harvesting_suggestions.append({
                "ticker": h["ticker"],
                "unrealised_loss": round(unrealised_pnl, 2),
                "term": "LTCG" if lt else "STCG",
                "tax_saving": round(abs(unrealised_pnl) * (LTCG_RATE if lt else STCG_RATE), 2),
                "action": f"Book loss on {h['ticker']} to offset {('LTCG' if lt else 'STCG')} gains",
            })

    # Tax calculations
    taxable_ltcg = max(0, ltcg_gains - LTCG_EXEMPTION)
    stcg_tax = max(0, stcg_gains * STCG_RATE)
    ltcg_tax = taxable_ltcg * LTCG_RATE
    total_tax = stcg_tax + ltcg_tax

    potential_savings = sum(s["tax_saving"] for s in harvesting_suggestions)

    return {
        "stcg_gains": round(stcg_gains, 2),
        "ltcg_gains": round(ltcg_gains, 2),
        "stcg_tax": round(stcg_tax, 2),
        "ltcg_tax": round(ltcg_tax, 2),
        "total_tax": round(total_tax, 2),
        "tax_saved_potential": round(potential_savings, 2),
        "harvesting_suggestions": sorted(harvesting_suggestions, key=lambda x: x["tax_saving"], reverse=True)[:5],
    }
