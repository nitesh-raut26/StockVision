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

    # Build mutable FIFO lot queue per ticker (consumed across multiple sells)
    buy_lots: dict[str, list[dict]] = {}
    for t in sorted(transactions, key=lambda x: x["transaction_date"]):
        if t.get("action") == "BUY":
            ticker_key = t["ticker"]
            buy_lots.setdefault(ticker_key, []).append({
                "price": float(t["price"]),
                "buy_date": date.fromisoformat(str(t["transaction_date"])),
                "remaining": int(t["qty"]),
            })

    for sell in sorted(sells, key=lambda x: x["transaction_date"]):
        ticker = sell["ticker"]
        sell_price = float(sell["price"])
        sell_qty = int(sell["qty"])
        sell_date = date.fromisoformat(str(sell["transaction_date"]))

        # Consume lots FIFO, classifying each consumed portion independently
        remaining = sell_qty
        for lot in buy_lots.get(ticker, []):
            if remaining <= 0 or lot["remaining"] <= 0:
                continue
            consumed = min(lot["remaining"], remaining)
            lot_gain = consumed * (sell_price - lot["price"])
            if _is_long_term(lot["buy_date"], sell_date):
                ltcg_gains += lot_gain
            else:
                stcg_gains += lot_gain
            lot["remaining"] -= consumed
            remaining -= consumed

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
