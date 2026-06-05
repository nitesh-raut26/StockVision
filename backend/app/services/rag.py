"""RAG-grounded answering with a hard "no citation, no claim" guardrail.

Retrieval is pluggable: a small canned `StubRetriever` ships today so answers are
grounded + cited even offline; a pgvector retriever over filings/transcripts/news
drops in behind the same interface later (set RAG_RETRIEVER).

Contract:
  • Answers are composed ONLY from retrieved, cited chunks.
  • If nothing is retrieved, we say so — we never speculate.
  • With ANTHROPIC_API_KEY set, Claude composes the answer constrained to the cited
    context; otherwise an extractive cited summary is returned (works offline).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.core.config import settings

_DISCLAIMER = "⚠️ Educational only — not investment advice."


@dataclass
class RetrievedChunk:
    text: str
    source: str
    url: str | None = None
    score: float = 0.0


class Retriever(ABC):
    @abstractmethod
    async def retrieve(self, query: str, ticker: str | None = None, k: int = 4) -> list[RetrievedChunk]:
        ...


# A tiny canned corpus so the assistant is grounded + cited without a vector store.
_CORPUS: dict[str, list[RetrievedChunk]] = {
    "RELIANCE": [
        RetrievedChunk(
            "Reliance's O2C segment EBITDA was about ₹62,000 cr in FY24, with Jio ARPU at ₹181.7 "
            "and retail revenue up roughly 18% YoY.",
            "RELIANCE FY24 Annual Report", "https://www.ril.com/ar2024", 0.92,
        ),
        RetrievedChunk(
            "Consolidated net debt was about ₹1.16 lakh cr; management guided capex moderation and "
            "a new-energy giga-complex ramp through FY25.",
            "RELIANCE Q4FY24 Earnings Call", None, 0.86,
        ),
    ],
    "HAL": [
        RetrievedChunk(
            "HAL's order book exceeded ₹94,000 cr in FY24, with the Tejas Mk1A and additional engine "
            "orders supporting a multi-year manufacturing pipeline.",
            "HAL FY24 Annual Report", None, 0.93,
        ),
        RetrievedChunk(
            "Defence indigenisation policy and record domestic production support HAL's double-digit "
            "revenue growth guidance.",
            "MoD Defence Production Note 2024", None, 0.81,
        ),
    ],
    "TCS": [
        RetrievedChunk(
            "TCS reported FY24 revenue growth in constant currency in the low single digits, with an "
            "operating margin around 24-25% and a strong deal TCV.",
            "TCS FY24 Annual Report", None, 0.9,
        ),
    ],
    "INFY": [
        RetrievedChunk(
            "Infosys guided cautiously on FY25 revenue growth amid soft discretionary IT spend, while "
            "maintaining margins via cost discipline and large-deal momentum.",
            "INFY Q4FY24 Earnings Call", None, 0.88,
        ),
    ],
}


class StubRetriever(Retriever):
    name = "stub"

    async def retrieve(self, query: str, ticker: str | None = None, k: int = 4) -> list[RetrievedChunk]:
        chunks = list(_CORPUS.get((ticker or "").upper(), []))
        # Light keyword boost so query terms nudge ranking on top of the canned score.
        terms = {t for t in query.lower().split() if len(t) > 3}

        def rank(c: RetrievedChunk) -> float:
            overlap = sum(1 for t in terms if t in c.text.lower())
            return c.score + 0.05 * overlap

        return sorted(chunks, key=rank, reverse=True)[:k]


def get_retriever() -> Retriever:
    # Swap to a pgvector retriever when RAG_RETRIEVER=pgvector and embeddings are wired.
    return StubRetriever()


def _citations(chunks: list[RetrievedChunk]) -> list[dict[str, Any]]:
    return [
        {"n": i, "source": c.source, "url": c.url, "snippet": c.text[:220]}
        for i, c in enumerate(chunks, 1)
    ]


def _extractive_answer(chunks: list[RetrievedChunk]) -> str:
    """Offline composition — cite each retrieved chunk explicitly."""
    lines = ["Based on the available sources:"]
    for i, c in enumerate(chunks, 1):
        lines.append(f"[{i}] {c.text} (— {c.source})")
    lines.append(_DISCLAIMER)
    return "\n".join(lines)


async def _claude_grounded(query: str, chunks: list[RetrievedChunk]) -> str:
    import httpx

    context = "\n\n".join(f"[{i}] ({c.source}) {c.text}" for i, c in enumerate(chunks, 1))
    system = (
        "You answer ONLY from the numbered context provided. Cite sources inline as [n]. "
        "If the context does not contain the answer, say you don't have grounded information — "
        "never invent figures or make claims beyond the context. "
        f"End every answer with: {_DISCLAIMER}"
    )
    try:
        resp = await httpx.AsyncClient(timeout=30).post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 700,
                "system": system,
                "messages": [{"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}],
            },
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]
    except Exception:
        return _extractive_answer(chunks)  # graceful fallback — still grounded + cited


async def answer_question(query: str, ticker: str | None = None) -> dict[str, Any]:
    chunks = await get_retriever().retrieve(query, ticker)

    # GUARDRAIL: no retrieved context → no claim.
    if not chunks:
        return {
            "grounded": False,
            "answer": (
                "I don't have grounded sources on that yet, so I won't speculate. "
                "Try a covered stock (e.g. RELIANCE, HAL, TCS, INFY) or rephrase your question."
            ),
            "citations": [],
            "disclaimer": _DISCLAIMER,
        }

    answer = await _claude_grounded(query, chunks) if settings.anthropic_api_key else _extractive_answer(chunks)
    return {
        "grounded": True,
        "answer": answer,
        "citations": _citations(chunks),
        "disclaimer": _DISCLAIMER,
    }
