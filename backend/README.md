# StockVision — FastAPI Backend

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI 0.115 + Uvicorn |
| Database | PostgreSQL (Supabase) via asyncpg |
| ORM | SQLAlchemy 2 (async) |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Market Data | yfinance (NSE/BSE) |
| Validation | Pydantic v2 + pydantic-settings |
| Rate Limiting | slowapi |

## Project Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app, middleware, routers
│   ├── core/
│   │   ├── config.py         # Pydantic settings (reads .env)
│   │   ├── database.py       # Async SQLAlchemy engine + session
│   │   └── security.py       # JWT create/decode + bcrypt
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── user.py
│   │   └── portfolio.py      # Portfolio, Holding, Goal, Alert, WatchlistItem
│   ├── schemas/              # Pydantic request/response schemas
│   │   ├── auth.py
│   │   ├── stock.py
│   │   └── portfolio.py
│   ├── services/             # Business logic
│   │   ├── data_fetcher.py   # yfinance wrapper (async)
│   │   ├── conviction_score.py  # 40-factor AI score (1–10)
│   │   ├── screener_engine.py   # NSE universe screener
│   │   ├── dcf_calculator.py    # DCF + scenario analysis
│   │   ├── tax_calculator.py    # STCG/LTCG + harvesting
│   │   ├── portfolio_service.py # P&L, XIRR, broker breakdown
│   │   └── auth_service.py      # Register, login, token
│   └── api/
│       ├── deps.py           # FastAPI dependencies (auth guard, DB)
│       └── v1/
│           ├── router.py     # Aggregates all route modules
│           └── routes/
│               ├── auth.py          # POST /auth/register, login; GET /auth/me
│               ├── stocks.py        # GET /stocks/quote, history, search, heatmap
│               ├── screener.py      # POST /screener/run; GET /screener/presets
│               ├── portfolio.py     # GET /portfolio/summary, tax, goals
│               ├── dcf.py           # GET /dcf/{ticker}
│               ├── mutual_funds.py  # GET /mutual-funds + /sip-calculator
│               └── watchlist.py     # Watchlist + price alerts CRUD
├── alembic/                  # DB migration scripts
├── requirements.txt
├── .env                      # Local env vars (never commit)
├── .env.example              # Template
└── run.py                    # Dev startup: python run.py
```

## Quick Start

### 1. Create virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL, JWT_SECRET_KEY
```

### 3. Run database migrations

```bash
alembic upgrade head
```

### 4. Start the server

```bash
python run.py
# OR
uvicorn app.main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT token |
| GET | `/api/v1/auth/me` | Current user profile |
| GET | `/api/v1/stocks/quote/{ticker}` | Live NSE quote |
| GET | `/api/v1/stocks/history/{ticker}` | OHLCV history |
| GET | `/api/v1/stocks/search?q=` | Ticker search |
| GET | `/api/v1/stocks/conviction/{ticker}` | AI conviction score |
| GET | `/api/v1/stocks/heatmap?tickers=` | Bulk quotes for heatmap |
| POST | `/api/v1/screener/run` | Run stock screener |
| GET | `/api/v1/screener/presets/{name}` | Named filter presets |
| GET | `/api/v1/portfolio/summary` | Portfolio with live P&L |
| GET | `/api/v1/portfolio/tax` | STCG/LTCG tax summary |
| GET | `/api/v1/portfolio/goals` | Financial goals |
| POST | `/api/v1/portfolio/goals` | Create goal |
| GET | `/api/v1/dcf/{ticker}` | DCF valuation |
| GET | `/api/v1/mutual-funds/sip-calculator` | SIP calculator |
| GET | `/api/v1/watchlist/` | User watchlist |
| GET | `/api/v1/watchlist/alerts` | Price alerts |
| GET | `/health` | Health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Supabase/Postgres connection |
| `JWT_SECRET_KEY` | *(required)* | Secret for signing JWTs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | 7 days |
| `CORS_ORIGINS` | `[localhost:5173]` | Allowed frontend origins |
| `REDIS_URL` | `redis://localhost:6379` | Optional Redis cache |
| `DEBUG` | `false` | Enable Swagger UI + SQL echo |
