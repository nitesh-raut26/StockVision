"""Unit tests for RAG grounding + 'no citation, no claim' guardrail (no network)."""

import pytest

from app.services.rag import (
    RetrievedChunk,
    StubRetriever,
    _extractive_answer,
    answer_question,
)

pytestmark = pytest.mark.unit


async def test_retriever_returns_cited_chunks_for_covered_ticker():
    chunks = await StubRetriever().retrieve("debt and margins", "RELIANCE")
    assert chunks
    assert all(c.source for c in chunks)


async def test_retriever_empty_for_unknown_ticker():
    assert await StubRetriever().retrieve("anything", "NOSUCH") == []


async def test_guardrail_no_chunks_means_no_claim():
    out = await answer_question("what is the 12-month price target?", "NOSUCH")
    assert out["grounded"] is False
    assert out["citations"] == []
    assert "speculate" in out["answer"].lower() or "don't have" in out["answer"].lower()


async def test_grounded_answer_is_cited():
    out = await answer_question("how is the order book?", "HAL")
    assert out["grounded"] is True
    assert len(out["citations"]) >= 1
    assert all("source" in c and "snippet" in c for c in out["citations"])
    # No Anthropic key in test env → extractive path, which cites inline.
    assert "[1]" in out["answer"]


def test_extractive_answer_cites_every_chunk():
    chunks = [RetrievedChunk("alpha", "Src A"), RetrievedChunk("beta", "Src B")]
    ans = _extractive_answer(chunks)
    assert "[1]" in ans and "[2]" in ans
    assert "Src A" in ans and "Src B" in ans
    assert "not investment advice" in ans
