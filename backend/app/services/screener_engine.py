"""Stock screener engine V2 — 500+ stock universe with NSE multi-index fetching.

Architecture:
  - STOCK_META: static directory of 250+ NSE stocks (name / sector / cap bucket)
  - NSE index API: fetches price data for entire indices in one HTTP call
    - /equity-stockIndices?index=NIFTY+500 → up to 500 stocks at once
  - Tiered universe: NIFTY_50 → NIFTY_200 → NSE_500 chosen by request
  - 5-min screener cache; 1-hr index-price cache (shared with get_bulk_price_data)
  - No per-ticker HTTP calls; fundamentals from conviction-score cache only
"""

import asyncio
import logging
from typing import Any

import httpx

from app.services.data_fetcher import _cache_get, _cache_set
from app.services.conviction_score import compute_conviction_score

logger = logging.getLogger(__name__)

SCREENER_CACHE_TTL = 300   # 5 minutes
INDEX_PRICE_TTL    = 3600  # 1 hour (NSE prices change slowly between market open/close)

# ─────────────────────────────────────────────────────────────────────────────
# STOCK_META  —  static directory of 250+ NSE-listed companies
#
# Fields:
#   name   — human-readable company name
#   sector — display sector for the screener filter chips
#   cap    — "large" | "mid" | "small" (approximate market-cap bucket)
# ─────────────────────────────────────────────────────────────────────────────
STOCK_META: dict[str, dict[str, str]] = {

    # ── Banking ──────────────────────────────────────────────────────────────
    "HDFCBANK":    {"name": "HDFC Bank",                     "sector": "Banking",     "cap": "large"},
    "ICICIBANK":   {"name": "ICICI Bank",                    "sector": "Banking",     "cap": "large"},
    "SBIN":        {"name": "State Bank of India",           "sector": "Banking",     "cap": "large"},
    "KOTAKBANK":   {"name": "Kotak Mahindra Bank",           "sector": "Banking",     "cap": "large"},
    "AXISBANK":    {"name": "Axis Bank",                     "sector": "Banking",     "cap": "large"},
    "INDUSINDBK":  {"name": "IndusInd Bank",                 "sector": "Banking",     "cap": "large"},
    "BANDHANBNK":  {"name": "Bandhan Bank",                  "sector": "Banking",     "cap": "mid"},
    "IDFCFIRSTB":  {"name": "IDFC First Bank",               "sector": "Banking",     "cap": "mid"},
    "FEDERALBNK":  {"name": "Federal Bank",                  "sector": "Banking",     "cap": "mid"},
    "CANBK":       {"name": "Canara Bank",                   "sector": "Banking",     "cap": "mid"},
    "BANKBARODA":  {"name": "Bank of Baroda",                "sector": "Banking",     "cap": "mid"},
    "PNB":         {"name": "Punjab National Bank",          "sector": "Banking",     "cap": "mid"},
    "UNIONBANK":   {"name": "Union Bank of India",           "sector": "Banking",     "cap": "mid"},
    "RBLBANK":     {"name": "RBL Bank",                      "sector": "Banking",     "cap": "small"},
    "DCBBANK":     {"name": "DCB Bank",                      "sector": "Banking",     "cap": "small"},
    "KARURVYSYA":  {"name": "Karur Vysya Bank",              "sector": "Banking",     "cap": "small"},
    "SOUTHBANK":   {"name": "South Indian Bank",             "sector": "Banking",     "cap": "small"},

    # ── IT / Technology ──────────────────────────────────────────────────────
    "TCS":         {"name": "Tata Consultancy Services",     "sector": "IT",          "cap": "large"},
    "INFY":        {"name": "Infosys",                       "sector": "IT",          "cap": "large"},
    "WIPRO":       {"name": "Wipro",                         "sector": "IT",          "cap": "large"},
    "HCLTECH":     {"name": "HCL Technologies",              "sector": "IT",          "cap": "large"},
    "TECHM":       {"name": "Tech Mahindra",                 "sector": "IT",          "cap": "large"},
    "MPHASIS":     {"name": "Mphasis",                       "sector": "IT",          "cap": "mid"},
    "PERSISTENT":  {"name": "Persistent Systems",            "sector": "IT",          "cap": "mid"},
    "COFORGE":     {"name": "Coforge",                       "sector": "IT",          "cap": "mid"},
    "LTIM":        {"name": "LTIMindtree",                   "sector": "IT",          "cap": "large"},
    "OFSS":        {"name": "Oracle Financial Services",     "sector": "IT",          "cap": "mid"},
    "MASTEK":      {"name": "Mastek",                        "sector": "IT",          "cap": "small"},
    "TATAELXSI":   {"name": "Tata Elxsi",                   "sector": "IT",          "cap": "mid"},
    "KPITTECH":    {"name": "KPIT Technologies",             "sector": "IT",          "cap": "mid"},
    "CYIENT":      {"name": "Cyient",                        "sector": "IT",          "cap": "mid"},
    "LTTS":        {"name": "L&T Technology Services",       "sector": "IT",          "cap": "mid"},
    "HAPPSTMNDS":  {"name": "Happiest Minds Technologies",   "sector": "IT",          "cap": "small"},
    "ZENSAR":      {"name": "Zensar Technologies",           "sector": "IT",          "cap": "small"},
    "INTELLECT":   {"name": "Intellect Design Arena",        "sector": "IT",          "cap": "small"},
    "BIRLASOFT":   {"name": "Birlasoft",                     "sector": "IT",          "cap": "small"},
    "TANLA":       {"name": "Tanla Platforms",               "sector": "IT",          "cap": "small"},

    # ── Energy ───────────────────────────────────────────────────────────────
    "RELIANCE":    {"name": "Reliance Industries",           "sector": "Energy",      "cap": "large"},
    "POWERGRID":   {"name": "Power Grid Corporation",        "sector": "Energy",      "cap": "large"},
    "NTPC":        {"name": "NTPC",                          "sector": "Energy",      "cap": "large"},
    "ONGC":        {"name": "ONGC",                          "sector": "Energy",      "cap": "large"},
    "BPCL":        {"name": "Bharat Petroleum Corp",         "sector": "Energy",      "cap": "large"},
    "COALINDIA":   {"name": "Coal India",                    "sector": "Energy",      "cap": "large"},
    "TATAPOWER":   {"name": "Tata Power Company",            "sector": "Energy",      "cap": "mid"},
    "ADANIENT":    {"name": "Adani Enterprises",             "sector": "Energy",      "cap": "large"},
    "ADANIGREEN":  {"name": "Adani Green Energy",            "sector": "Energy",      "cap": "large"},
    "TORNTPOWER":  {"name": "Torrent Power",                 "sector": "Energy",      "cap": "mid"},
    "CESC":        {"name": "CESC",                          "sector": "Energy",      "cap": "small"},
    "IGL":         {"name": "Indraprastha Gas",              "sector": "Energy",      "cap": "mid"},
    "MGL":         {"name": "Mahanagar Gas",                 "sector": "Energy",      "cap": "mid"},
    "PETRONET":    {"name": "Petronet LNG",                  "sector": "Energy",      "cap": "mid"},
    "GAIL":        {"name": "GAIL (India)",                  "sector": "Energy",      "cap": "large"},
    "IOC":         {"name": "Indian Oil Corporation",        "sector": "Energy",      "cap": "large"},
    "HINDPETRO":   {"name": "Hindustan Petroleum Corp",      "sector": "Energy",      "cap": "mid"},
    "ADANIPOWER":  {"name": "Adani Power",                   "sector": "Energy",      "cap": "mid"},
    "JPPOWER":     {"name": "Jaiprakash Power Ventures",     "sector": "Energy",      "cap": "small"},

    # ── Automobile ───────────────────────────────────────────────────────────
    "MARUTI":      {"name": "Maruti Suzuki India",           "sector": "Auto",        "cap": "large"},
    "TATAMOTORS":  {"name": "Tata Motors",                   "sector": "Auto",        "cap": "large"},
    "BAJAJ-AUTO":  {"name": "Bajaj Auto",                    "sector": "Auto",        "cap": "large"},
    "HEROMOTOCO":  {"name": "Hero MotoCorp",                 "sector": "Auto",        "cap": "large"},
    "EICHERMOT":   {"name": "Eicher Motors",                 "sector": "Auto",        "cap": "large"},
    "M&M":         {"name": "Mahindra & Mahindra",           "sector": "Auto",        "cap": "large"},
    "ASHOKLEY":    {"name": "Ashok Leyland",                 "sector": "Auto",        "cap": "mid"},
    "TVSMOTOR":    {"name": "TVS Motor Company",             "sector": "Auto",        "cap": "mid"},
    "MOTHERSON":   {"name": "Samvardhana Motherson",         "sector": "Auto",        "cap": "mid"},
    "BOSCHLTD":    {"name": "Bosch",                         "sector": "Auto",        "cap": "mid"},
    "EXIDEIND":    {"name": "Exide Industries",              "sector": "Auto",        "cap": "mid"},
    "BALKRISIND":  {"name": "Balkrishna Industries",         "sector": "Auto",        "cap": "mid"},
    "BHARATFORG":  {"name": "Bharat Forge",                  "sector": "Auto",        "cap": "mid"},
    "SUNDRMFAST":  {"name": "Sundram Fasteners",             "sector": "Auto",        "cap": "small"},
    "MINDAIND":    {"name": "Minda Industries",              "sector": "Auto",        "cap": "small"},

    # ── Pharma / Healthcare ──────────────────────────────────────────────────
    "SUNPHARMA":   {"name": "Sun Pharmaceutical Industries", "sector": "Pharma",      "cap": "large"},
    "DRREDDY":     {"name": "Dr. Reddy's Laboratories",      "sector": "Pharma",      "cap": "large"},
    "CIPLA":       {"name": "Cipla",                         "sector": "Pharma",      "cap": "large"},
    "DIVISLAB":    {"name": "Divi's Laboratories",           "sector": "Pharma",      "cap": "large"},
    "LUPIN":       {"name": "Lupin",                         "sector": "Pharma",      "cap": "large"},
    "TORNTPHARM":  {"name": "Torrent Pharmaceuticals",       "sector": "Pharma",      "cap": "mid"},
    "BIOCON":      {"name": "Biocon",                        "sector": "Pharma",      "cap": "mid"},
    "AUROPHARMA":  {"name": "Aurobindo Pharma",              "sector": "Pharma",      "cap": "mid"},
    "ABBOTINDIA":  {"name": "Abbott India",                  "sector": "Pharma",      "cap": "mid"},
    "PFIZER":      {"name": "Pfizer India",                  "sector": "Pharma",      "cap": "small"},
    "GLAXO":       {"name": "GlaxoSmithKline Pharma",        "sector": "Pharma",      "cap": "small"},
    "IPCALAB":     {"name": "IPCA Laboratories",             "sector": "Pharma",      "cap": "mid"},
    "ZYDUSLIFE":   {"name": "Zydus Lifesciences",            "sector": "Pharma",      "cap": "mid"},
    "ALKEM":       {"name": "Alkem Laboratories",            "sector": "Pharma",      "cap": "mid"},
    "GLENMARK":    {"name": "Glenmark Pharmaceuticals",      "sector": "Pharma",      "cap": "mid"},
    "NATCOPHARMA": {"name": "Natco Pharma",                  "sector": "Pharma",      "cap": "small"},
    "LAURUSLABS":  {"name": "Laurus Labs",                   "sector": "Pharma",      "cap": "small"},
    "APLLTD":      {"name": "Alembic Pharmaceuticals",       "sector": "Pharma",      "cap": "small"},
    "GRANULES":    {"name": "Granules India",                "sector": "Pharma",      "cap": "small"},

    # ── FMCG ─────────────────────────────────────────────────────────────────
    "HINDUNILVR":  {"name": "Hindustan Unilever",            "sector": "FMCG",        "cap": "large"},
    "ITC":         {"name": "ITC",                           "sector": "FMCG",        "cap": "large"},
    "NESTLEIND":   {"name": "Nestle India",                  "sector": "FMCG",        "cap": "large"},
    "BRITANNIA":   {"name": "Britannia Industries",          "sector": "FMCG",        "cap": "large"},
    "DABUR":       {"name": "Dabur India",                   "sector": "FMCG",        "cap": "large"},
    "MARICO":      {"name": "Marico",                        "sector": "FMCG",        "cap": "large"},
    "COLPAL":      {"name": "Colgate-Palmolive India",       "sector": "FMCG",        "cap": "large"},
    "TATACONSUM":  {"name": "Tata Consumer Products",        "sector": "FMCG",        "cap": "large"},
    "GODREJCP":    {"name": "Godrej Consumer Products",      "sector": "FMCG",        "cap": "large"},
    "EMAMILTD":    {"name": "Emami",                         "sector": "FMCG",        "cap": "mid"},
    "RADICO":      {"name": "Radico Khaitan",                "sector": "FMCG",        "cap": "mid"},
    "VARBEV":      {"name": "Varun Beverages",               "sector": "FMCG",        "cap": "mid"},
    "PGHH":        {"name": "Procter & Gamble",              "sector": "FMCG",        "cap": "mid"},
    "GILLETTE":    {"name": "Gillette India",                "sector": "FMCG",        "cap": "small"},
    "CCL":         {"name": "CCL Products India",            "sector": "FMCG",        "cap": "small"},

    # ── NBFC / Financial Services ─────────────────────────────────────────────
    "BAJFINANCE":  {"name": "Bajaj Finance",                 "sector": "NBFC",        "cap": "large"},
    "BAJAJFINSV":  {"name": "Bajaj Finserv",                 "sector": "NBFC",        "cap": "large"},
    "CHOLAFIN":    {"name": "Cholamandalam Investment",      "sector": "NBFC",        "cap": "mid"},
    "MUTHOOTFIN":  {"name": "Muthoot Finance",               "sector": "NBFC",        "cap": "mid"},
    "MANAPPURAM":  {"name": "Manappuram Finance",            "sector": "NBFC",        "cap": "mid"},
    "SBICARD":     {"name": "SBI Cards & Payment Services",  "sector": "NBFC",        "cap": "mid"},
    "LTFH":        {"name": "L&T Finance Holdings",          "sector": "NBFC",        "cap": "mid"},
    "M&MFIN":      {"name": "Mahindra & Mahindra Financial", "sector": "NBFC",        "cap": "mid"},
    "POONAWALLA":  {"name": "Poonawalla Fincorp",            "sector": "NBFC",        "cap": "small"},
    "AAVAS":       {"name": "AAVAS Financiers",              "sector": "NBFC",        "cap": "small"},
    "HOMEFIRST":   {"name": "Home First Finance Company",    "sector": "NBFC",        "cap": "small"},

    # ── Insurance ────────────────────────────────────────────────────────────
    "HDFCLIFE":    {"name": "HDFC Life Insurance",           "sector": "Insurance",   "cap": "large"},
    "SBILIFE":     {"name": "SBI Life Insurance",            "sector": "Insurance",   "cap": "large"},
    "ICICIPRULI":  {"name": "ICICI Prudential Life Ins.",    "sector": "Insurance",   "cap": "large"},
    "LICI":        {"name": "Life Insurance Corp of India",  "sector": "Insurance",   "cap": "large"},
    "NIACL":       {"name": "New India Assurance",           "sector": "Insurance",   "cap": "mid"},
    "GICRE":       {"name": "GIC Re",                        "sector": "Insurance",   "cap": "mid"},
    "STARHEALTH":  {"name": "Star Health & Allied Insurance","sector": "Insurance",   "cap": "mid"},

    # ── Infrastructure / Capital Goods ───────────────────────────────────────
    "LT":          {"name": "Larsen & Toubro",               "sector": "Infrastructure","cap":"large"},
    "ADANIPORTS":  {"name": "Adani Ports & SEZ",             "sector": "Infrastructure","cap":"large"},
    "IRCTC":       {"name": "IRCTC",                         "sector": "Infrastructure","cap":"large"},
    "HAL":         {"name": "Hindustan Aeronautics",         "sector": "Defence",     "cap": "large"},
    "BEL":         {"name": "Bharat Electronics",            "sector": "Defence",     "cap": "large"},
    "BHEL":        {"name": "Bharat Heavy Electricals",      "sector": "Infrastructure","cap":"mid"},
    "NBCC":        {"name": "NBCC (India)",                  "sector": "Infrastructure","cap":"mid"},
    "RVNL":        {"name": "Rail Vikas Nigam",              "sector": "Infrastructure","cap":"mid"},
    "IRFC":        {"name": "Indian Railway Finance Corp",   "sector": "Infrastructure","cap":"mid"},
    "CONCOR":      {"name": "Container Corp of India",       "sector": "Infrastructure","cap":"mid"},
    "SIEMENS":     {"name": "Siemens India",                 "sector": "Industrial",  "cap": "large"},
    "ABB":         {"name": "ABB India",                     "sector": "Industrial",  "cap": "mid"},
    "CUMMINSIND":  {"name": "Cummins India",                 "sector": "Industrial",  "cap": "mid"},
    "THERMAX":     {"name": "Thermax",                       "sector": "Industrial",  "cap": "mid"},
    "TIINDIA":     {"name": "Tube Investments of India",     "sector": "Industrial",  "cap": "mid"},
    "COCHINSHIP":  {"name": "Cochin Shipyard",               "sector": "Defence",     "cap": "small"},
    "MAZDOCK":     {"name": "Mazagon Dock Shipbuilders",     "sector": "Defence",     "cap": "mid"},
    "BDL":         {"name": "Bharat Dynamics",               "sector": "Defence",     "cap": "mid"},
    "GRSE":        {"name": "Garden Reach Shipbuilders",     "sector": "Defence",     "cap": "small"},
    "AIAENG":      {"name": "AIA Engineering",               "sector": "Industrial",  "cap": "mid"},

    # ── Consumer Durables ─────────────────────────────────────────────────────
    "TITAN":       {"name": "Titan Company",                 "sector": "Consumer",    "cap": "large"},
    "HAVELLS":     {"name": "Havells India",                 "sector": "Consumer",    "cap": "large"},
    "VOLTAS":      {"name": "Voltas",                        "sector": "Consumer",    "cap": "mid"},
    "BLUESTARCO":  {"name": "Blue Star",                     "sector": "Consumer",    "cap": "mid"},
    "WHIRLPOOL":   {"name": "Whirlpool of India",            "sector": "Consumer",    "cap": "mid"},
    "CROMPTON":    {"name": "Crompton Greaves Consumer",     "sector": "Consumer",    "cap": "mid"},
    "VGUARD":      {"name": "V-Guard Industries",            "sector": "Consumer",    "cap": "small"},
    "HINDWAREAP":  {"name": "Hindware Home Innovation",      "sector": "Consumer",    "cap": "small"},
    "PGHL":        {"name": "Procter & Gamble Hygiene",      "sector": "Consumer",    "cap": "mid"},
    "SYMPHONY":    {"name": "Symphony",                      "sector": "Consumer",    "cap": "small"},
    "POLYCAB":     {"name": "Polycab India",                 "sector": "Consumer",    "cap": "mid"},
    "CENTURYPLY":  {"name": "Century Plyboards",             "sector": "Consumer",    "cap": "small"},

    # ── Materials / Metals / Cement ──────────────────────────────────────────
    "ULTRACEMCO":  {"name": "UltraTech Cement",              "sector": "Materials",   "cap": "large"},
    "JSWSTEEL":    {"name": "JSW Steel",                     "sector": "Materials",   "cap": "large"},
    "TATASTEEL":   {"name": "Tata Steel",                    "sector": "Materials",   "cap": "large"},
    "HINDALCO":    {"name": "Hindalco Industries",           "sector": "Materials",   "cap": "large"},
    "GRASIM":      {"name": "Grasim Industries",             "sector": "Materials",   "cap": "large"},
    "JKCEMENT":    {"name": "JK Cement",                     "sector": "Materials",   "cap": "mid"},
    "AMBUJACEM":   {"name": "Ambuja Cements",                "sector": "Materials",   "cap": "large"},
    "ACC":         {"name": "ACC",                           "sector": "Materials",   "cap": "large"},
    "RAMCOCEM":    {"name": "Ramco Cements",                 "sector": "Materials",   "cap": "mid"},
    "DALMIACMT":   {"name": "Dalmia Bharat",                 "sector": "Materials",   "cap": "mid"},
    "SHREECEM":    {"name": "Shree Cement",                  "sector": "Materials",   "cap": "large"},
    "NATIONALUM":  {"name": "National Aluminium Company",    "sector": "Materials",   "cap": "mid"},
    "VEDL":        {"name": "Vedanta",                       "sector": "Materials",   "cap": "large"},
    "NMDC":        {"name": "NMDC",                          "sector": "Materials",   "cap": "mid"},
    "SAIL":        {"name": "Steel Authority of India",      "sector": "Materials",   "cap": "mid"},
    "WELCORP":     {"name": "Welspun Corp",                  "sector": "Materials",   "cap": "small"},
    "RATNAMANI":   {"name": "Ratnamani Metals & Tubes",      "sector": "Materials",   "cap": "small"},

    # ── Chemicals ────────────────────────────────────────────────────────────
    "PIDILITIND":  {"name": "Pidilite Industries",           "sector": "Chemicals",   "cap": "large"},
    "ATUL":        {"name": "Atul",                          "sector": "Chemicals",   "cap": "mid"},
    "GNFC":        {"name": "Gujarat Narmada Valley Fert",   "sector": "Chemicals",   "cap": "small"},
    "DEEPAKNITRI": {"name": "Deepak Nitrite",                "sector": "Chemicals",   "cap": "mid"},
    "SRF":         {"name": "SRF",                           "sector": "Chemicals",   "cap": "mid"},
    "TATACHEMICALS":{"name":"Tata Chemicals",                "sector": "Chemicals",   "cap": "mid"},
    "VINATI":      {"name": "Vinati Organics",               "sector": "Chemicals",   "cap": "mid"},
    "GALAXYSURF":  {"name": "Galaxy Surfactants",            "sector": "Chemicals",   "cap": "small"},
    "FINEORG":     {"name": "Fine Organic Industries",       "sector": "Chemicals",   "cap": "small"},
    "ALKYLAMINE":  {"name": "Alkyl Amines Chemicals",        "sector": "Chemicals",   "cap": "small"},
    "GUJGASLTD":   {"name": "Gujarat Gas",                   "sector": "Chemicals",   "cap": "mid"},
    "GHCL":        {"name": "GHCL",                          "sector": "Chemicals",   "cap": "small"},
    "NAVINFLUOR":  {"name": "Navin Fluorine International",  "sector": "Chemicals",   "cap": "mid"},

    # ── Consumer / Paint / Other ─────────────────────────────────────────────
    "ASIANPAINT":  {"name": "Asian Paints",                  "sector": "Consumer",    "cap": "large"},
    "BERGEPAINT":  {"name": "Berger Paints India",           "sector": "Consumer",    "cap": "large"},
    "KANSAINER":   {"name": "Kansai Nerolac Paints",         "sector": "Consumer",    "cap": "mid"},
    "INDIGO":      {"name": "InterGlobe Aviation (IndiGo)",  "sector": "Aviation",    "cap": "large"},

    # ── Retail / Lifestyle ───────────────────────────────────────────────────
    "DMART":       {"name": "Avenue Supermarts (DMart)",     "sector": "Retail",      "cap": "large"},
    "TRENT":       {"name": "Trent",                         "sector": "Retail",      "cap": "large"},
    "VMART":       {"name": "V-Mart Retail",                 "sector": "Retail",      "cap": "small"},
    "NYKAA":       {"name": "FSN E-Commerce Ventures (Nykaa)","sector":"Retail",      "cap": "mid"},
    "VEDANT":      {"name": "Vedant Fashions",               "sector": "Retail",      "cap": "mid"},

    # ── Real Estate ──────────────────────────────────────────────────────────
    "GODREJPROP":  {"name": "Godrej Properties",             "sector": "Real Estate", "cap": "large"},
    "DLF":         {"name": "DLF",                           "sector": "Real Estate", "cap": "large"},
    "OBEROIRLTY":  {"name": "Oberoi Realty",                 "sector": "Real Estate", "cap": "mid"},
    "PRESTIGE":    {"name": "Prestige Estates Projects",     "sector": "Real Estate", "cap": "mid"},
    "BRIGADE":     {"name": "Brigade Enterprises",           "sector": "Real Estate", "cap": "mid"},
    "LODHA":       {"name": "Macrotech Developers (Lodha)",  "sector": "Real Estate", "cap": "large"},
    "PHOENIXLTD":  {"name": "The Phoenix Mills",             "sector": "Real Estate", "cap": "mid"},

    # ── Telecom ──────────────────────────────────────────────────────────────
    "BHARTIARTL":  {"name": "Bharti Airtel",                 "sector": "Telecom",     "cap": "large"},
    "TATACOMM":    {"name": "Tata Communications",           "sector": "Telecom",     "cap": "mid"},
    "HFCL":        {"name": "HFCL",                          "sector": "Telecom",     "cap": "small"},

    # ── Capital Markets / Fintech ─────────────────────────────────────────────
    "HDFCAMC":     {"name": "HDFC Asset Management",         "sector": "Capital Mkts","cap": "large"},
    "NAUKRI":      {"name": "Info Edge (Naukri)",            "sector": "Capital Mkts","cap": "large"},
    "PAYTM":       {"name": "Paytm (One97 Communications)",  "sector": "Fintech",     "cap": "mid"},
    "POLICYBZR":   {"name": "PB Fintech (Policybazaar)",     "sector": "Fintech",     "cap": "mid"},
    "CAMS":        {"name": "Computer Age Management Svcs",  "sector": "Capital Mkts","cap": "mid"},
    "BSE":         {"name": "BSE",                           "sector": "Capital Mkts","cap": "mid"},
    "MCX":         {"name": "Multi Commodity Exchange",      "sector": "Capital Mkts","cap": "mid"},
    "CDSL":        {"name": "Central Depository Services",   "sector": "Capital Mkts","cap": "mid"},
    "ANGELONE":    {"name": "Angel One",                     "sector": "Capital Mkts","cap": "mid"},
    "5PAISA":      {"name": "5paisa Capital",                "sector": "Capital Mkts","cap": "small"},

    # ── Hospitality / Tourism ─────────────────────────────────────────────────
    "INDHOTEL":    {"name": "Indian Hotels Company",         "sector": "Hospitality", "cap": "mid"},
    "LEMONTREE":   {"name": "Lemon Tree Hotels",             "sector": "Hospitality", "cap": "small"},
    "MHRIL":       {"name": "Mahindra Holidays & Resorts",   "sector": "Hospitality", "cap": "small"},
    "CHALET":      {"name": "Chalet Hotels",                 "sector": "Hospitality", "cap": "small"},

    # ── Conglomerates / Holding Cos ───────────────────────────────────────────
    "ZOMATO":      {"name": "Zomato",                        "sector": "Consumer",    "cap": "large"},

    # ── Specialty / Others ───────────────────────────────────────────────────
    "MCDOWELL-N":  {"name": "United Spirits (Diageo India)", "sector": "FMCG",        "cap": "mid"},
    "UNITDSPR":    {"name": "United Spirits",                "sector": "FMCG",        "cap": "mid"},
    "PAGEIND":     {"name": "Page Industries (Jockey)",      "sector": "Consumer",    "cap": "mid"},
    "RAYMOND":     {"name": "Raymond",                       "sector": "Consumer",    "cap": "small"},
    "VBL":         {"name": "Varun Beverages",               "sector": "FMCG",        "cap": "mid"},
    "ALEMBICLTD":  {"name": "Alembic",                       "sector": "Pharma",      "cap": "small"},
    "ESCORTS":     {"name": "Escorts Kubota",                "sector": "Auto",        "cap": "mid"},
    "APOLLOTYRE":  {"name": "Apollo Tyres",                  "sector": "Auto",        "cap": "mid"},
    "MRF":         {"name": "MRF",                           "sector": "Auto",        "cap": "large"},
    "CAMLINFINE":  {"name": "Camlin Fine Sciences",          "sector": "Chemicals",   "cap": "small"},
    "FLUOROCHEM":  {"name": "Gujarat Fluorochemicals",       "sector": "Chemicals",   "cap": "mid"},
    "IREDA":       {"name": "IREDA",                         "sector": "Energy",      "cap": "mid"},
    "PFC":         {"name": "Power Finance Corporation",     "sector": "Energy",      "cap": "large"},
    "RECLTD":      {"name": "REC",                           "sector": "Energy",      "cap": "large"},
    "HUDCO":       {"name": "Housing & Urban Dev Corp",      "sector": "Infrastructure","cap":"mid"},
    "ZEEL":        {"name": "Zee Entertainment Enterprises", "sector": "Media",       "cap": "mid"},
    "SUNCLAYLTD":  {"name": "Sun TV Network",                "sector": "Media",       "cap": "mid"},
    "NETWORK18":   {"name": "Network18 Media & Investments", "sector": "Media",       "cap": "small"},
    "PVRINOX":     {"name": "PVR INOX",                      "sector": "Media",       "cap": "mid"},
    "SUNTV":       {"name": "Sun TV Network",                "sector": "Media",       "cap": "mid"},
    "NAZARA":      {"name": "Nazara Technologies",           "sector": "Media",       "cap": "small"},
    "SAREGAMA":    {"name": "Saregama India",                "sector": "Media",       "cap": "small"},
    "LALPATHLAB":  {"name": "Dr. Lal PathLabs",              "sector": "Healthcare",  "cap": "mid"},
    "METROPOLIS":  {"name": "Metropolis Healthcare",         "sector": "Healthcare",  "cap": "mid"},
    "FORTIS":      {"name": "Fortis Healthcare",             "sector": "Healthcare",  "cap": "mid"},
    "APOLLOHOSP":  {"name": "Apollo Hospitals Enterprise",   "sector": "Healthcare",  "cap": "large"},
    "MAXHEALTH":   {"name": "Max Healthcare Institute",      "sector": "Healthcare",  "cap": "mid"},
    "NARAYANA":    {"name": "Narayana Hrudayalaya",          "sector": "Healthcare",  "cap": "mid"},
    "KIMS":        {"name": "Krishna Institute of Medical",  "sector": "Healthcare",  "cap": "mid"},
    "SYNGENE":     {"name": "Syngene International",         "sector": "Healthcare",  "cap": "mid"},
    "DELHIVERY":   {"name": "Delhivery",                     "sector": "Logistics",   "cap": "mid"},
    "BLUEDART":    {"name": "Blue Dart Express",             "sector": "Logistics",   "cap": "mid"},
    "GESHIP":      {"name": "Great Eastern Shipping",        "sector": "Logistics",   "cap": "mid"},
    "GLAND":       {"name": "Gland Pharma",                  "sector": "Pharma",      "cap": "mid"},
}

# ─────────────────────────────────────────────────────────────────────────────
# Universe lists  —  symbols used by each screener tier
# ─────────────────────────────────────────────────────────────────────────────

# NIFTY 50 components
NSE_NIFTY_50 = [
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
    "BHARTIARTL", "SBIN", "BAJFINANCE", "HINDUNILVR", "ITC",
    "KOTAKBANK", "LT", "WIPRO", "HCLTECH", "ASIANPAINT",
    "MARUTI", "TITAN", "SUNPHARMA", "AXISBANK", "NESTLEIND",
    "POWERGRID", "NTPC", "ONGC", "TATAMOTORS", "ZOMATO",
    "BAJAJFINSV", "ADANIPORTS", "ULTRACEMCO", "TECHM", "DIVISLAB",
    "JSWSTEEL", "TATASTEEL", "HINDALCO", "BPCL", "COALINDIA",
    "EICHERMOT", "BAJAJ-AUTO", "HEROMOTOCO", "DRREDDY", "CIPLA",
    "GRASIM", "INDUSINDBK", "M&M", "ADANIENT", "TATACONSUM",
    "SHREECEM", "HDFCLIFE", "VEDL", "BRITANNIA", "APOLLOHOSP",
]

# NIFTY Next 50 (large-caps just outside NIFTY 50)
NSE_NIFTY_NEXT_50 = [
    "LUPIN", "HAVELLS", "PIDILITIND", "DMART", "SIEMENS",
    "DABUR", "MARICO", "COLPAL", "GODREJCP", "BERGEPAINT",
    "TORNTPHARM", "BIOCON", "AUROPHARMA", "ZYDUSLIFE", "ALKEM",
    "INDIGO", "GODREJPROP", "DLF", "LODHA", "NAUKRI",
    "SBILIFE", "ICICIPRULI", "LICI", "HDFCAMC", "SBICARD",
    "TVSMOTOR", "ASHOKLEY", "BALKRISIND", "MOTHERSON", "BHARATFORG",
    "CHOLAFIN", "MUTHOOTFIN", "LTFH", "AMBUJACEM", "ACC",
    "DALMIACMT", "JKCEMENT", "RAMCOCEM", "SRF", "TATAELXSI",
    "LTIM", "PERSISTENT", "MPHASIS", "COFORGE", "LTTS",
    "CAMS", "CDSL", "MCX", "BSE", "POLYCAB",
]

# NIFTY Midcap 100 (representative sample)
NSE_MIDCAP_100 = [
    "FEDERALBNK", "IDFCFIRSTB", "CANBK", "BANKBARODA", "PNB",
    "UNIONBANK", "BANDHANBNK", "RBLBANK", "KARURVYSYA", "SOUTHBANK",
    "KPITTECH", "CYIENT", "HAPPSTMNDS", "ZENSAR", "BIRLASOFT",
    "TANLA", "INTELLECT", "MASTEK", "OFSS", "NAZARA",
    "TATAPOWER", "TORNTPOWER", "CESC", "IGL", "MGL",
    "PETRONET", "GAIL", "IOC", "HINDPETRO", "ADANIPOWER",
    "ASHOKLEY", "TVSMOTOR", "BOSCHLTD", "EXIDEIND", "ESCORTS",
    "APOLLOTYRE", "TORNTPHARM", "IPCALAB", "GLENMARK", "ZYDUSLIFE",
    "EMAMILTD", "RADICO", "VARBEV", "PGHH", "VBL",
    "MANAPPURAM", "M&MFIN", "POONAWALLA", "AAVAS", "HOMEFIRST",
    "STARHEALTH", "NIACL", "GICRE", "RVNL", "IRFC",
    "NBCC", "BHEL", "CONCOR", "COCHINSHIP", "MAZDOCK",
    "BDL", "GRSE", "AIAENG", "CUMMINSIND", "THERMAX",
    "TIINDIA", "ABB", "VOLTAS", "BLUESTARCO", "CROMPTON",
    "VGUARD", "POLYCAB", "SYMPHONY", "CENTURYPLY", "PAGEIND",
    "KANSAINER", "TRENT", "VMART", "NYKAA", "VEDANT",
    "OBEROIRLTY", "PRESTIGE", "BRIGADE", "PHOENIXLTD", "CHALET",
    "TATACOMM", "DEEPAKNITRI", "ATUL", "NAVINFLUOR", "VINATI",
    "GNFC", "FLUOROCHEM", "ALKYLAMINE", "GHCL", "GUJGASLTD",
    "NATIONALUM", "NMDC", "SAIL", "RATNAMANI", "WELCORP",
    "LALPATHLAB", "METROPOLIS", "FORTIS", "MAXHEALTH", "APOLLOHOSP",
]

# NIFTY Smallcap sample (liquid small-caps)
NSE_SMALLCAP_SAMPLE = [
    "DCBBANK", "SOUTHBANK", "RBLBANK", "KARURVYSYA",
    "MASTEK", "HAPPSTMNDS", "ZENSAR", "INTELLECT", "BIRLASOFT",
    "GRANULES", "NATCOPHARMA", "APLLTD", "LAURUSLABS",
    "GILLETTE", "CCL", "PGHH",
    "CAMLINFINE", "GALAXYSURF", "FINEORG", "NAVINFLUOR",
    "NAZARA", "SAREGAMA", "ZEEL", "NETWORK18",
    "PVRINOX", "LEMONTREE", "MHRIL",
    "GRSE", "COCHINSHIP", "MAZDOCK",
    "VMART", "VGUARD", "CENTURYPLY",
    "HFCL", "5PAISA", "ANGELONE",
    "WELCORP", "RATNAMANI",
    "KIMS", "NARAYANA", "SYNGENE",
    "DELHIVERY", "BLUEDART",
]

# Full NSE universe (all tiers combined, de-duplicated)
_all = NSE_NIFTY_50 + NSE_NIFTY_NEXT_50 + NSE_MIDCAP_100 + NSE_SMALLCAP_SAMPLE
NSE_500_UNIVERSE = list(dict.fromkeys(_all))   # preserves insertion order, removes dups

# Legacy aliases kept for backwards compatibility
NSE_UNIVERSE          = NSE_NIFTY_50
NSE_UNIVERSE_EXTENDED = NSE_NIFTY_50 + NSE_NIFTY_NEXT_50


# ─────────────────────────────────────────────────────────────────────────────
# NSE multi-index price fetcher
# ─────────────────────────────────────────────────────────────────────────────

_NSE_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.nseindia.com/",
}
_NSE_BASE = "https://www.nseindia.com"

# NSE index URL keys → human names
_NSE_INDEX_KEYS = {
    "NIFTY 50":        "NIFTY+50",
    "NIFTY NEXT 50":   "NIFTY+NEXT+50",
    "NIFTY MIDCAP 150":"NIFTY+MIDCAP+150",
    "NIFTY SMALLCAP 250":"NIFTY+SMALLCAP+250",
    "NIFTY 200":       "NIFTY+200",
    "NIFTY 500":       "NIFTY+500",
}


async def _get_nse_cookies() -> dict:
    cached = _cache_get("screener_nse_cookies")
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            r = await c.get(_NSE_BASE + "/", headers=_NSE_HEADERS)
            cookies = dict(r.cookies)
            _cache_set("screener_nse_cookies", cookies, 900)  # 15 min
            return cookies
    except Exception as exc:
        logger.debug("NSE cookie fetch failed for screener: %s", exc)
        return {}


async def _fetch_index_prices(index_key: str) -> dict[str, dict]:
    """Fetch all stock prices from a single NSE index endpoint.

    Returns {SYMBOL: {price, change, change_pct, volume, market_cap}}
    """
    cache_key = f"screener_idx:{index_key}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    url_key = _NSE_INDEX_KEYS.get(index_key, index_key.replace(" ", "+"))
    url     = f"{_NSE_BASE}/api/equity-stockIndices?index={url_key}"
    cookies = await _get_nse_cookies()

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            resp = await c.get(url, headers=_NSE_HEADERS, cookies=cookies)
            if resp.status_code != 200 or not resp.content:
                logger.warning("NSE index %s returned %s", index_key, resp.status_code)
                return {}
            data   = resp.json().get("data", [])
            result = {}
            for s in data:
                sym = str(s.get("symbol", "")).upper().strip()
                if not sym or sym == index_key.upper():
                    continue
                try:
                    price  = float(s.get("lastPrice", 0) or 0)
                    prev   = float(s.get("previousClose", price) or price)
                    result[sym] = {
                        "price":      round(price, 2),
                        "change":     round(price - prev, 2),
                        "change_pct": round(float(s.get("pChange", 0) or 0), 2),
                        "volume":     int(s.get("totalTradedVolume", 0) or 0),
                        "market_cap": float(s.get("ffmc", 0) or 0) * 1e7,
                    }
                except Exception:
                    pass
            if result:
                _cache_set(cache_key, result, INDEX_PRICE_TTL)
            logger.info("NSE index '%s' → %d tickers", index_key, len(result))
            return result
    except Exception as exc:
        logger.warning("NSE index '%s' fetch error: %s", index_key, exc)
        return {}


async def _fetch_broad_universe_prices() -> dict[str, dict]:
    """Fetch prices for the full NIFTY 500 universe using 3 parallel NSE calls.

    Falls back gracefully: if NIFTY 500 fails, merge NIFTY 200 + MIDCAP 150.
    """
    cache_key = "screener_broad_prices"
    cached    = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Primary: NIFTY 500 (single call)
    prices = await _fetch_index_prices("NIFTY 500")
    if not prices:
        # Fallback: merge three smaller indices in parallel
        n200, mid150, sm250 = await asyncio.gather(
            _fetch_index_prices("NIFTY 200"),
            _fetch_index_prices("NIFTY MIDCAP 150"),
            _fetch_index_prices("NIFTY SMALLCAP 250"),
        )
        prices = {**sm250, **mid150, **n200}  # higher-quality indices win

    if prices:
        _cache_set(cache_key, prices, INDEX_PRICE_TTL)
    return prices


# ─────────────────────────────────────────────────────────────────────────────
# Row builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_screener_row(
    ticker: str,
    price_data: dict[str, Any],
    cached_fundamentals: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Build a single screener result row.

    price_data: {price, change, change_pct, volume, market_cap}
    cached_fundamentals: fetched by the stock-detail page; may be None
    """
    meta  = STOCK_META.get(ticker, {"name": ticker, "sector": "Other", "cap": "mid"})
    price = price_data.get("price", 0)
    if not price:
        return None

    quote = {
        "ticker":     ticker,
        "name":       meta["name"],
        "price":      price,
        "change":     price_data.get("change", 0),
        "change_pct": price_data.get("change_pct", 0),
        "volume":     price_data.get("volume", 0),
        "market_cap": price_data.get("market_cap", 0),
        "sector":     meta["sector"],
    }

    fundamentals = cached_fundamentals or {
        "pe_ratio": None, "pb_ratio": None, "eps": None,
        "roe": None, "roce": None, "debt_equity": None,
        "promoter_holding": None, "revenue_growth": None,
        "dividend_yield": None, "free_cash_flow": None, "beta": None,
    }

    cs         = compute_conviction_score(quote, fundamentals)
    target_12m = round(price * (1 + (cs["score"] - 5) * 0.04), 2) if price else 0
    upside     = round((target_12m - price) / price * 100, 2) if price else None

    return {
        "ticker":            ticker,
        "name":              meta["name"],
        "sector":            meta["sector"],
        "cap":               meta.get("cap", "mid"),
        "price":             price,
        "change_pct":        price_data.get("change_pct", 0),
        "conviction_score":  cs["score"],
        "pe_ratio":          fundamentals.get("pe_ratio"),
        "roce":              fundamentals.get("roce"),
        "debt_equity":       fundamentals.get("debt_equity"),
        "promoter_holding":  fundamentals.get("promoter_holding"),
        "revenue_growth":    fundamentals.get("revenue_growth"),
        "target_12m":        target_12m,
        "upside":            upside,
        "risk":              cs["risk"],
        "market_cap":        price_data.get("market_cap", 0),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main screener entry point
# ─────────────────────────────────────────────────────────────────────────────

async def run_screener(filters: dict) -> list[dict]:
    """Run the stock screener.

    Supported filters (all optional):
      universe             — "nifty50" | "nifty200" | "nifty500" (default: nifty200)
      limit                — int, max results to return (default: 25)
      min_conviction_score — float
      max_pe               — float
      min_roce             — float
      max_debt_equity      — float
      min_promoter_holding — float
      min_revenue_growth   — float
      sector               — str (case-insensitive)
      cap                  — "large" | "mid" | "small"
      sort_by              — "conviction_score" | "upside" | "change_pct" | "pe_ratio" | "market_cap"
    """
    universe_key = (filters.get("universe") or "nifty200").lower()
    limit        = int(filters.get("limit", 25))

    # ── Choose universe list ─────────────────────────────────────────────────
    if universe_key == "nifty50":
        universe = NSE_NIFTY_50
    elif universe_key == "nifty500":
        universe = NSE_500_UNIVERSE
    else:
        universe = NSE_UNIVERSE_EXTENDED   # nifty200 (100 stocks)

    # ── Check screener-level cache ───────────────────────────────────────────
    screen_key = f"screener_run:{universe_key}"
    cached_run = _cache_get(screen_key)

    if cached_run is not None:
        logger.info("Screener[%s]: serving %d rows from cache", universe_key, len(cached_run))
        all_enriched = cached_run
    else:
        # ── Fetch prices ─────────────────────────────────────────────────────
        if universe_key == "nifty500":
            price_map = await _fetch_broad_universe_prices()
        elif universe_key == "nifty200":
            price_map = await _fetch_index_prices("NIFTY 200")
            if not price_map:
                price_map = await _fetch_index_prices("NIFTY 50")
        else:  # nifty50
            price_map = await _fetch_index_prices("NIFTY 50")

        if not price_map:
            # Last-resort: bulk price map via the market-data provider seam
            from app.services.market_data import get_market_data_provider
            price_map = await get_market_data_provider().get_bulk_price_data(universe[:50])

        if not price_map:
            logger.warning("Screener[%s]: no price data — empty result", universe_key)
            return []

        # ── Build rows ───────────────────────────────────────────────────────
        all_enriched: list[dict[str, Any]] = []
        for ticker in universe:
            pd = price_map.get(ticker)
            if pd is None:
                continue
            cached_f = _cache_get(f"fundamentals:{ticker}")
            row = _build_screener_row(ticker, pd, cached_f)
            if row:
                all_enriched.append(row)

        # Also add any NSE-returned tickers not in our static universe list
        # (handles index rebalancing gracefully)
        known = {r["ticker"] for r in all_enriched}
        for sym, pd in price_map.items():
            if sym in known:
                continue
            cached_f = _cache_get(f"fundamentals:{sym}")
            row = _build_screener_row(sym, pd, cached_f)
            if row:
                all_enriched.append(row)

        _cache_set(screen_key, all_enriched, SCREENER_CACHE_TTL)
        logger.info("Screener[%s]: built %d rows", universe_key, len(all_enriched))

    # ── Apply filters ────────────────────────────────────────────────────────
    min_score = float(filters.get("min_conviction_score") or 0)
    max_pe    = float(filters.get("max_pe")               or 200)
    min_roce  = float(filters.get("min_roce")             or 0)
    max_de    = float(filters.get("max_debt_equity")      or 5)
    min_promo = float(filters.get("min_promoter_holding") or 0)
    min_rev_g = float(filters.get("min_revenue_growth")   or -50)
    sector    = (filters.get("sector")  or "").strip().lower()
    cap_filter= (filters.get("cap")     or "").strip().lower()

    filtered = []
    for r in all_enriched:
        if r["conviction_score"] < min_score:
            continue
        if r["pe_ratio"] is not None and r["pe_ratio"] > max_pe:
            continue
        if r["roce"] is not None and r["roce"] < min_roce:
            continue
        if r["debt_equity"] is not None and r["debt_equity"] > max_de:
            continue
        if r["promoter_holding"] is not None and r["promoter_holding"] < min_promo:
            continue
        if r["revenue_growth"] is not None and r["revenue_growth"] < min_rev_g:
            continue
        if sector and r["sector"].lower() != sector:
            continue
        if cap_filter and r.get("cap", "").lower() != cap_filter:
            continue
        filtered.append(r)

    # ── Sort ─────────────────────────────────────────────────────────────────
    sort_by = filters.get("sort_by", "conviction_score")
    reverse  = True
    sort_key: Any
    if sort_by == "upside":
        sort_key = lambda x: x.get("upside") or 0
    elif sort_by == "change_pct":
        sort_key = lambda x: x.get("change_pct") or 0
    elif sort_by == "pe_ratio":
        sort_key = lambda x: x.get("pe_ratio") or 9999
        reverse  = False
    elif sort_by == "market_cap":
        sort_key = lambda x: x.get("market_cap") or 0
    else:
        sort_key = lambda x: x.get("conviction_score") or 0

    filtered.sort(key=sort_key, reverse=reverse)
    return filtered[:limit]
