"""Options chain data — PCR, OI, IV surface, Greeks."""

import math
import random
from fastapi import APIRouter, Query

router = APIRouter(prefix="/options", tags=["options"])

UNDERLYINGS = {
    "NIFTY":     {"spot": 24834.85, "lot": 50},
    "BANKNIFTY": {"spot": 53218.40, "lot": 15},
    "FINNIFTY":  {"spot": 23412.60, "lot": 40},
    "SENSEX":    {"spot": 81426.80, "lot": 10},
    "HAL":       {"spot": 4215.30,  "lot": 75},
    "RELIANCE":  {"spot": 2920.45,  "lot": 250},
    "HDFCBANK":  {"spot": 1682.30,  "lot": 550},
    "TCS":       {"spot": 3892.10,  "lot": 150},
}

EXPIRIES = [
    "2026-05-29", "2026-06-05", "2026-06-12",
    "2026-06-26", "2026-09-25", "2026-12-25",
]


def _bs_price(S: float, K: float, T: float, r: float, sigma: float, opt: str) -> tuple[float, dict]:
    """Black-Scholes price + Greeks (simplified, T in years)."""
    if T <= 0:
        intrinsic = max(S - K, 0) if opt == "call" else max(K - S, 0)
        return intrinsic, {"delta": 1.0 if opt == "call" else -1.0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0}
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    def N(x: float) -> float:
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    def n(x: float) -> float:
        return math.exp(-0.5 * x ** 2) / math.sqrt(2 * math.pi)

    if opt == "call":
        price = S * N(d1) - K * math.exp(-r * T) * N(d2)
        delta = N(d1)
        rho   = K * T * math.exp(-r * T) * N(d2) / 100
    else:
        price = K * math.exp(-r * T) * N(-d2) - S * N(-d1)
        delta = N(d1) - 1
        rho   = -K * T * math.exp(-r * T) * N(-d2) / 100

    gamma = n(d1) / (S * sigma * math.sqrt(T))
    vega  = S * n(d1) * math.sqrt(T) / 100
    theta = (-(S * n(d1) * sigma) / (2 * math.sqrt(T)) - r * K * math.exp(-r * T) * N(d2)) / 365

    return max(price, 0.05), {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega":  round(vega, 4),
        "rho":   round(rho, 4),
    }


def _generate_chain(symbol: str, expiry: str) -> list[dict]:
    info  = UNDERLYINGS.get(symbol, UNDERLYINGS["NIFTY"])
    spot  = info["spot"]
    # Approx T based on expiry (days until)
    T = max(0.003, 10 / 365)  # demo: ~10 days
    r, sigma = 0.065, 0.18

    step  = round(spot * 0.005 / 50) * 50 if spot > 1000 else round(spot * 0.01 / 10) * 10
    step  = max(step, 50)
    strikes = [round(spot / step) * step + i * step for i in range(-8, 9)]

    rows = []
    for K in strikes:
        call_px, call_g = _bs_price(spot, K, T, r, sigma * (1 + random.uniform(-0.02, 0.02)), "call")
        put_px,  put_g  = _bs_price(spot, K, T, r, sigma * (1 + random.uniform(-0.02, 0.02)), "put")
        call_oi = int(random.uniform(5000, 200000) * (1 + max(0, (spot - K) / spot * 3)))
        put_oi  = int(random.uniform(5000, 200000) * (1 + max(0, (K - spot) / spot * 3)))
        rows.append({
            "strike":     K,
            "call_ltp":   round(call_px, 2),
            "call_oi":    call_oi,
            "call_vol":   int(call_oi * random.uniform(0.05, 0.4)),
            "call_iv":    round((sigma + random.uniform(-0.03, 0.06)) * 100, 1),
            "call_delta": call_g["delta"],
            "call_gamma": call_g["gamma"],
            "call_theta": call_g["theta"],
            "call_vega":  call_g["vega"],
            "put_ltp":    round(put_px, 2),
            "put_oi":     put_oi,
            "put_vol":    int(put_oi * random.uniform(0.05, 0.4)),
            "put_iv":     round((sigma + random.uniform(-0.03, 0.06)) * 100, 1),
            "put_delta":  put_g["delta"],
            "put_gamma":  put_g["gamma"],
            "put_theta":  put_g["theta"],
            "put_vega":   put_g["vega"],
            "atm":        abs(K - spot) < step * 0.6,
        })
    return rows


@router.get("/chain")
async def get_chain(
    symbol: str = Query("NIFTY"),
    expiry: str = Query("2026-05-29"),
):
    symbol = symbol.upper()
    chain  = _generate_chain(symbol, expiry)
    info   = UNDERLYINGS.get(symbol, UNDERLYINGS["NIFTY"])
    spot   = info["spot"]

    total_call_oi = sum(r["call_oi"] for r in chain)
    total_put_oi  = sum(r["put_oi"]  for r in chain)
    pcr = round(total_put_oi / total_call_oi, 2) if total_call_oi else 1.0

    max_put_strike  = max(chain, key=lambda r: r["put_oi"])["strike"]
    max_call_strike = max(chain, key=lambda r: r["call_oi"])["strike"]

    return {
        "symbol":     symbol,
        "expiry":     expiry,
        "spot":       spot,
        "pcr":        pcr,
        "max_pain":   round(spot / 100) * 100,
        "support":    max_put_strike,
        "resistance": max_call_strike,
        "chain":      chain,
    }


@router.get("/expiries")
async def get_expiries():
    return EXPIRIES


@router.get("/underlyings")
async def get_underlyings():
    return [{"symbol": k, "spot": v["spot"], "lot": v["lot"]} for k, v in UNDERLYINGS.items()]
