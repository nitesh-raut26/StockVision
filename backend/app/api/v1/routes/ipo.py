"""IPO Tracker — mainboard, SME, ELSS, GMP, subscription status."""

from fastapi import APIRouter, Query

router = APIRouter(prefix="/ipo", tags=["ipo"])

_OPEN_IPOS = [
    {
        "id": "ntpc-green",
        "name": "NTPC Green Energy",
        "sector": "Renewable",
        "exchange": "NSE/BSE",
        "price_band": "₹108–114",
        "issue_size": "₹10,000 Cr",
        "open_date": "2026-05-20",
        "close_date": "2026-05-22",
        "gmp": 18,
        "gmp_pct": 15.8,
        "rating": 4.2,
        "subscription": {"overall": 4.82, "qib": 8.4, "nii": 3.1, "retail": 2.9},
        "type": "mainboard",
        "status": "open",
        "icon": "🌞",
    },
    {
        "id": "ola-electric",
        "name": "Ola Electric 2.0",
        "sector": "EV / Auto",
        "exchange": "BSE",
        "price_band": "₹145–152",
        "issue_size": "₹5,500 Cr",
        "open_date": "2026-05-21",
        "close_date": "2026-05-23",
        "gmp": 22,
        "gmp_pct": 14.5,
        "rating": 3.8,
        "subscription": {"overall": 2.14, "qib": 3.2, "nii": 1.8, "retail": 1.6},
        "type": "mainboard",
        "status": "open",
        "icon": "⚡",
    },
]

_UPCOMING_IPOS = [
    {"id": "tata-capital",  "name": "Tata Capital",      "sector": "NBFC",      "price_band": "₹TBD",      "issue_size": "₹15,000 Cr", "open_date": "2026-06-02", "gmp": None, "rating": 4.6, "icon": "🏦"},
    {"id": "bajaj-allianz", "name": "Bajaj Allianz Gen", "sector": "Insurance", "price_band": "₹380–400",   "issue_size": "₹4,200 Cr",  "open_date": "2026-06-05", "gmp": 35,   "rating": 4.1, "icon": "🛡️"},
    {"id": "indigo-paints", "name": "IndiGo Paints",     "sector": "FMCG",     "price_band": "₹TBD",       "issue_size": "₹2,800 Cr",  "open_date": "2026-06-10", "gmp": None, "rating": 3.9, "icon": "🎨"},
    {"id": "zepto-ipo",     "name": "Zepto",              "sector": "Q-commerce","price_band": "₹TBD",      "issue_size": "₹6,000 Cr",  "open_date": "2026-06-18", "gmp": None, "rating": 3.5, "icon": "🛒"},
]

_LISTED_IPOS = [
    {"id": "hyundai",      "name": "Hyundai India",    "sector": "Auto",     "issue_price": 1960, "cmp": 1724, "list_date": "2025-10-22"},
    {"id": "swiggy",       "name": "Swiggy",           "sector": "Foodtech", "issue_price": 390,  "cmp": 328,  "list_date": "2025-11-13"},
    {"id": "tata-tech",    "name": "Tata Technologies","sector": "IT",       "issue_price": 500,  "cmp": 718,  "list_date": "2024-11-30"},
    {"id": "ireda",        "name": "IREDA",            "sector": "Finance",  "issue_price": 32,   "cmp": 185,  "list_date": "2024-11-29"},
    {"id": "gpsk",         "name": "GPSK",             "sector": "Defence",  "issue_price": 128,  "cmp": 292,  "list_date": "2025-09-12"},
    {"id": "jio-financial","name": "Jio Financial",    "sector": "NBFC",     "issue_price": 261,  "cmp": 218,  "list_date": "2024-08-21"},
]

_SME_IPOS = [
    {"id": "sme-1", "name": "Avant Foods",        "sector": "FMCG",         "price_band": "₹52–55",  "issue_size": "₹48 Cr",   "open_date": "2026-05-21", "gmp": 12,   "subscription": 42.3, "icon": "🍫"},
    {"id": "sme-2", "name": "Bharat Wire Ropes",  "sector": "Manufacturing","price_band": "₹110–118","issue_size": "₹120 Cr",  "open_date": "2026-05-22", "gmp": 8,    "subscription": 28.1, "icon": "🔩"},
    {"id": "sme-3", "name": "Nandan Terry",       "sector": "Textiles",     "price_band": "₹82–86",  "issue_size": "₹64 Cr",   "open_date": "2026-05-23", "gmp": 5,    "subscription": 18.6, "icon": "🧵"},
    {"id": "sme-4", "name": "Nexgen Infracon",    "sector": "Infra",        "price_band": "₹44–48",  "issue_size": "₹32 Cr",   "open_date": "2026-05-26", "gmp": None, "subscription": 7.4,  "icon": "🏗️"},
]

_ELSS_FUNDS = [
    {"id": "mf-1", "name": "Mirae Asset ELSS",      "aum": "₹21,400 Cr", "returns_1y": 38.2, "returns_3y": 22.4, "returns_5y": 19.8, "expense": 0.52, "rating": 5, "category": "Large Cap ELSS"},
    {"id": "mf-2", "name": "Quant ELSS",            "aum": "₹8,620 Cr",  "returns_1y": 42.1, "returns_3y": 28.6, "returns_5y": 26.3, "expense": 0.48, "rating": 5, "category": "Multi Cap ELSS"},
    {"id": "mf-3", "name": "HDFC ELSS Tax Saver",   "aum": "₹15,840 Cr", "returns_1y": 29.4, "returns_3y": 18.2, "returns_5y": 16.7, "expense": 1.12, "rating": 4, "category": "Large Cap ELSS"},
    {"id": "mf-4", "name": "SBI Long Term Equity",  "aum": "₹25,100 Cr", "returns_1y": 24.8, "returns_3y": 16.4, "returns_5y": 14.9, "expense": 0.88, "rating": 4, "category": "Large Cap ELSS"},
    {"id": "mf-5", "name": "Axis Long Term Equity", "aum": "₹34,200 Cr", "returns_1y": 18.6, "returns_3y": 12.8, "returns_5y": 13.4, "expense": 0.54, "rating": 3, "category": "Large & Mid ELSS"},
]


@router.get("/open")
async def open_ipos():
    return _OPEN_IPOS


@router.get("/upcoming")
async def upcoming_ipos():
    return _UPCOMING_IPOS


@router.get("/listed")
async def listed_ipos(limit: int = Query(20)):
    enriched = []
    for ipo in _LISTED_IPOS[:limit]:
        gain = ipo["cmp"] - ipo["issue_price"]
        gain_pct = round(gain / ipo["issue_price"] * 100, 1)
        enriched.append({**ipo, "gain": gain, "gain_pct": gain_pct})
    return enriched


@router.get("/sme")
async def sme_ipos():
    return _SME_IPOS


@router.get("/elss")
async def elss_funds():
    return _ELSS_FUNDS


@router.get("/stats")
async def ipo_stats():
    return {
        "open_count":     len(_OPEN_IPOS),
        "upcoming_count": len(_UPCOMING_IPOS),
        "sme_count":      len(_SME_IPOS),
        "total_raised_fy": "₹1,24,600 Cr",
        "avg_listing_gain": 18.4,
    }
