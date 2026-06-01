"""AI Financial Assistant + Stock Report Generator.

Architecture:
  ┌─ POST /ai/chat ─────────────────────────────────────────────────┐
  │  Streaming response via Server-Sent Events (SSE)                 │
  │  Claude claude-3-5-haiku (fast, cheap) for conversational flow   │
  │  Claude claude-3-7-sonnet for deep research queries              │
  │  Function calling: get_price, get_fundamentals, get_indicators   │
  │  Rate limit: 20 msg/min (free), 100 msg/min (premium/pro)       │
  └─────────────────────────────────────────────────────────────────┘

  ┌─ POST /ai/report/{ticker} ──────────────────────────────────────┐
  │  Generates structured research report (JSON → PDF)              │
  │  Claude claude-3-7-sonnet with full context window               │
  │  Cached 24h — expensive to generate                             │
  │  Rate limit: 5/day free, 50/day premium, unlimited pro          │
  └─────────────────────────────────────────────────────────────────┘

Security:
  - All AI endpoints require authentication
  - Plan gating enforced server-side (not just client-side PlanGate)
  - Claude API key never exposed to frontend

Performance:
  - SSE streaming avoids 10-30s wait for long responses
  - Tool call results are cached in Redis TTL=5min
  - Report generation is async background task (webhook on complete)
"""

import json
import logging
import time
from typing import AsyncGenerator

# Allowed Claude model IDs — prevent arbitrary model injection
_ALLOWED_MODELS = {
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
}

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.services.data_fetcher import get_quote, get_fundamentals
from app.services.indicators_engine import compute_indicators

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

# ── Plan gating ───────────────────────────────────────────────────────────────

_PLAN_LIMITS: dict[str, int] = {
    "free":       3,
    "premium":   20,
    "pro":      100,
    "enterprise": 999999,
}

_rate_store: dict[str, list[float]] = {}  # in-process fallback only


async def _check_rate_limit(user_id: str, plan: str, window: int = 60) -> bool:
    """Redis sliding-window rate limiter; falls back to in-memory if Redis is unavailable."""
    limit = _PLAN_LIMITS.get(plan, 3)
    key = f"ai_rate:{user_id}"
    now = time.time()

    try:
        import redis.asyncio as aioredis
        from app.core.config import settings as _s
        r = aioredis.from_url(_s.redis_url, decode_responses=True)
        async with r:
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, "-inf", now - window)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, window + 5)
            results = await pipe.execute()
        count_before_add = results[1]
        return count_before_add < limit
    except Exception:
        # In-memory fallback (single-worker only)
        calls = [t for t in _rate_store.get(user_id, []) if now - t < window]
        if len(calls) >= limit:
            return False
        calls.append(now)
        _rate_store[user_id] = calls
        return True


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    ticker: str | None = None
    model: str = "claude-haiku-4-5-20251001"


class ReportRequest(BaseModel):
    detail_level: str = Field("standard", pattern="^(brief|standard|deep)$")


# ── Claude function definitions ────────────────────────────────────────────────

_TOOLS = [
    {
        "name": "get_stock_price",
        "description": "Get the current market price and daily change for an NSE-listed stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "NSE ticker symbol, e.g. RELIANCE, TCS, HDFC"}
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_fundamentals",
        "description": "Get fundamental analysis data: PE ratio, ROE, debt/equity, revenue growth, EPS, dividend yield, description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "NSE ticker symbol"}
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_technical_signals",
        "description": "Get technical analysis signals: RSI, MACD, EMA crossover, Bollinger Bands, and an overall bullish/bearish signal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "NSE ticker symbol"},
                "period": {"type": "string", "enum": ["1mo", "3mo", "6mo", "1y"], "default": "3mo"},
            },
            "required": ["ticker"],
        },
    },
]

_SYSTEM_PROMPT = """You are StockVision AI — an expert Indian stock market analyst built into the StockVision platform.

You have access to real-time NSE market data, technical indicators, and fundamental analysis via tool calls.

Your responsibilities:
• Analyse Indian stocks (NSE/BSE listed) with data-driven insights
• Use tool calls to fetch live prices, fundamentals, and technical signals before answering questions about specific stocks
• Format numbers in Indian convention: ₹, Cr (crores), L (lakhs)
• Reference SEBI regulations when discussing investment advice
• Always add a disclaimer: "This is for educational purposes only — not investment advice. Please consult a SEBI-registered advisor."
• Keep responses concise for conversational queries; detailed for research queries
• Use markdown formatting with headers, tables, and bullet points

Language: English by default. Switch to Hindi if user writes in Hindi (Devanagari).

Disclaimer trigger: Always include "⚠️ Educational purposes only — not investment advice" at the end of any stock recommendation or analysis.
"""


# ── Tool execution ────────────────────────────────────────────────────────────

async def _execute_tool(name: str, inputs: dict) -> str:
    try:
        ticker = inputs.get("ticker", "").upper()
        if name == "get_stock_price":
            q = await get_quote(ticker)
            return json.dumps({
                "ticker":     q.get("ticker", ticker),
                "price":      q.get("price"),
                "change":     q.get("change"),
                "change_pct": q.get("change_pct"),
                "volume":     q.get("volume"),
                "market_cap": q.get("market_cap"),
            })

        elif name == "get_fundamentals":
            f = await get_fundamentals(ticker)
            return json.dumps({k: v for k, v in f.items() if k != "description"} | {"description": (f.get("description") or "")[:300]})

        elif name == "get_technical_signals":
            period = inputs.get("period", "3mo")
            ind = await compute_indicators(ticker, period)
            return json.dumps(ind.get("signals", {}) | {"current": ind.get("current", {})})

    except Exception as exc:
        logger.warning("AI tool %s failed: %s", name, exc)
        return json.dumps({"error": str(exc)})

    return json.dumps({"error": "Unknown tool"})


# ── Streaming SSE generator ───────────────────────────────────────────────────

async def _stream_claude(
    messages: list[dict],
    model: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    """Stream Claude response with tool calling support via httpx."""
    import httpx

    headers = {
        "x-api-key":         api_key,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
    }

    payload = {
        "model":      model,
        "max_tokens": 2048,
        "system":     _SYSTEM_PROMPT,
        "messages":   messages,
        "tools":      _TOOLS,
        "stream":     True,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                logger.error("Claude API error %d: %s", resp.status_code, body[:200])
                yield f"data: {json.dumps({'type': 'error', 'text': 'AI service error'})}\n\n"
                return

            tool_calls: list[dict] = []
            tool_input_acc = ""
            current_tool_name = ""
            current_tool_id   = ""

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:]
                if raw == "[DONE]":
                    break
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                etype = event.get("type", "")

                if etype == "content_block_start":
                    blk = event.get("content_block", {})
                    if blk.get("type") == "tool_use":
                        current_tool_name = blk.get("name", "")
                        current_tool_id   = blk.get("id", "")
                        tool_input_acc    = ""

                elif etype == "content_block_delta":
                    delta = event.get("delta", {})
                    dtype = delta.get("type", "")
                    if dtype == "text_delta":
                        yield f"data: {json.dumps({'type': 'text', 'text': delta.get('text', '')})}\n\n"
                    elif dtype == "input_json_delta":
                        tool_input_acc += delta.get("partial_json", "")

                elif etype == "content_block_stop":
                    if current_tool_name:
                        try:
                            tool_input = json.loads(tool_input_acc) if tool_input_acc else {}
                        except json.JSONDecodeError:
                            tool_input = {}
                        tool_calls.append({
                            "id":     current_tool_id,
                            "name":   current_tool_name,
                            "inputs": tool_input,
                        })
                        current_tool_name = ""

                elif etype == "message_stop":
                    break

            # Execute tool calls and continue conversation
            if tool_calls:
                yield f"data: {json.dumps({'type': 'tool_use', 'tools': [t['name'] for t in tool_calls]})}\n\n"

                tool_results = []
                for tc in tool_calls:
                    result = await _execute_tool(tc["name"], tc["inputs"])
                    tool_results.append({
                        "type":        "tool_result",
                        "tool_use_id": tc["id"],
                        "content":     result,
                    })

                # Second turn — Claude incorporates tool results
                new_messages = messages + [
                    {"role": "assistant", "content": [
                        {"type": "tool_use", "id": tc["id"], "name": tc["name"], "input": tc["inputs"]}
                        for tc in tool_calls
                    ]},
                    {"role": "user", "content": tool_results},
                ]

                payload2 = {
                    "model":      model,
                    "max_tokens": 2048,
                    "system":     _SYSTEM_PROMPT,
                    "messages":   new_messages,
                    "stream":     True,
                    # No tools in second turn — avoid infinite tool loops
                }

                async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload2) as resp2:
                    async for line2 in resp2.aiter_lines():
                        if not line2.startswith("data: "):
                            continue
                        raw2 = line2[6:]
                        if raw2 == "[DONE]":
                            break
                        try:
                            event2 = json.loads(raw2)
                        except json.JSONDecodeError:
                            continue
                        if event2.get("type") == "content_block_delta":
                            delta2 = event2.get("delta", {})
                            if delta2.get("type") == "text_delta":
                                yield f"data: {json.dumps({'type': 'text', 'text': delta2.get('text', '')})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Streaming AI chat endpoint.

    Returns Server-Sent Events stream:
      data: {"type": "text",     "text": "..."}
      data: {"type": "tool_use", "tools": ["get_stock_price"]}
      data: {"type": "done"}
      data: {"type": "error",    "text": "..."}
    """
    api_key = settings.anthropic_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant is not configured. Add ANTHROPIC_API_KEY to enable.",
        )

    if not await _check_rate_limit(str(current_user.id), current_user.plan):
        plan_limit = _PLAN_LIMITS.get(current_user.plan, 3)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI rate limit reached ({plan_limit} messages/min on {current_user.plan} plan). Upgrade for more.",
        )

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    # Validate requested model against allowlist; default to haiku for non-pro
    requested = body.model if body.model in _ALLOWED_MODELS else "claude-haiku-4-5-20251001"
    model = (
        "claude-sonnet-4-6"
        if requested == "claude-sonnet-4-6" and current_user.plan in ("pro", "enterprise")
        else "claude-haiku-4-5-20251001"
    )

    return StreamingResponse(
        _stream_claude(messages, model, api_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control":  "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/report/{ticker}")
async def generate_report(
    ticker: str,
    body: ReportRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a structured AI research report.

    Returns JSON with sections: summary, bull_thesis, bear_thesis, risks,
    valuation, technicals, recommendation.

    Cached 24h — expensive call. Pro/Enterprise only for 'deep' level.
    """
    api_key = settings.anthropic_api_key
    if not api_key:
        raise HTTPException(status_code=503, detail="AI not configured")

    if body.detail_level == "deep" and current_user.plan not in ("pro", "enterprise"):
        raise HTTPException(status_code=403, detail="Deep research reports require Pro plan or above")

    # Check daily report limit
    if not await _check_rate_limit(f"report:{current_user.id}", current_user.plan, window=86400):
        raise HTTPException(status_code=429, detail="Daily report limit reached. Upgrade your plan.")

    ticker_u = ticker.upper()

    # Fetch all context data in parallel
    import asyncio
    quote_t = get_quote(ticker_u)
    fund_t  = get_fundamentals(ticker_u)
    ind_t   = compute_indicators(ticker_u, "1y")

    quote, fund, ind = await asyncio.gather(quote_t, fund_t, ind_t, return_exceptions=True)

    quote   = quote if isinstance(quote, dict) else {}
    fund    = fund  if isinstance(fund,  dict) else {}
    signals = (ind.get("signals", {}) if isinstance(ind, dict) else {})
    current = (ind.get("current", {}) if isinstance(ind, dict) else {})

    context = f"""
Stock: {ticker_u}
Current Price: ₹{quote.get('price', 'N/A')}
Change Today:  {quote.get('change_pct', 0):+.2f}%
Market Cap:    ₹{quote.get('market_cap', 0):,.0f} Cr

Fundamentals:
  PE Ratio: {fund.get('pe_ratio', 'N/A')}
  PB Ratio: {fund.get('pb_ratio', 'N/A')}
  ROE: {fund.get('roe', 'N/A')}
  Debt/Equity: {fund.get('debt_equity', 'N/A')}
  Revenue Growth: {fund.get('revenue_growth', 'N/A')}%
  EPS: ₹{fund.get('eps', 'N/A')}
  Dividend Yield: {fund.get('dividend_yield', 'N/A')}%
  52W High: ₹{quote.get('week_52_high', 'N/A')} | 52W Low: ₹{quote.get('week_52_low', 'N/A')}

Technical Signals:
  RSI: {current.get('rsi', 'N/A')}
  MACD: {current.get('macd', 'N/A')} (Signal: {current.get('macd_signal', 'N/A')})
  EMA20: ₹{current.get('ema_20', 'N/A')} | EMA50: ₹{current.get('ema_50', 'N/A')}
  Overall Signal: {signals.get('overall', 'N/A')} (Buys: {signals.get('buy_count', 0)}, Sells: {signals.get('sell_count', 0)})
  ATR (14): {current.get('atr', 'N/A')}

Business Description:
{(fund.get('description') or 'No description available.')[:600]}
"""

    prompt = f"""Generate a structured stock research report for {ticker_u} in JSON format.

{context}

Return ONLY valid JSON with these fields:
{{
  "ticker": "{ticker_u}",
  "generated_at": "ISO8601 datetime",
  "detail_level": "{body.detail_level}",
  "summary": "2-3 sentence company overview",
  "bull_thesis": ["point1", "point2", "point3"],
  "bear_thesis": ["risk1", "risk2", "risk3"],
  "key_risks": ["risk1", "risk2"],
  "valuation_analysis": "paragraph on current valuation vs peers",
  "technical_analysis": "paragraph on current technical setup",
  "recommendation": "Buy | Hold | Sell",
  "target_price_12m": number,
  "confidence_score": number between 1 and 10,
  "disclaimer": "Educational purposes only — not investment advice"
}}

Base your analysis on the provided data. Be specific with numbers. Format prices in INR.
"""

    try:
        import httpx
        response = await httpx.AsyncClient(timeout=60).post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json={
                "model":      "claude-sonnet-4-6",
                "max_tokens": 2048,
                "messages":   [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        content = response.json()["content"][0]["text"]
        # Robustly extract JSON — handle ``` fences and leading/trailing prose
        import re
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if json_match:
            content = json_match.group(1)
        else:
            # Find first { ... } block
            brace_match = re.search(r"\{.*\}", content, re.DOTALL)
            if brace_match:
                content = brace_match.group(0)
        report = json.loads(content)
        return report
    except json.JSONDecodeError as exc:
        logger.error("Report JSON parse error for %s: %s", ticker_u, exc)
        raise HTTPException(status_code=500, detail="Report generation failed — invalid AI response")
    except Exception as exc:
        logger.error("Report generation failed for %s: %s", ticker_u, exc)
        raise HTTPException(status_code=502, detail="AI service error — please try again")


@router.get("/report/{ticker}/status")
async def report_status(
    ticker: str,
    current_user: User = Depends(get_current_user),
):
    """Check if a cached report exists for this ticker."""
    from app.core.config import settings as _s
    ticker_u = ticker.upper()
    cache_key = f"report:{ticker_u}"
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(_s.redis_url, decode_responses=True)
        async with r:
            cached_at = await r.get(f"{cache_key}:ts")
            exists = await r.exists(cache_key)
        return {"ticker": ticker_u, "cached": bool(exists), "cached_at": cached_at}
    except Exception:
        return {"ticker": ticker_u, "cached": False, "cached_at": None}
