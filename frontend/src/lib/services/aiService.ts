/**
 * lib/services/aiService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AI assistant endpoints. `askGrounded` hits the RAG endpoint that answers only
 * from retrieved, cited sources ("no citation, no claim").
 * Endpoint prefix: /ai
 */

import { requestJson } from '../core';

export interface GroundedCitation {
  n:       number;
  source:  string;
  url:     string | null;
  snippet: string;
}

export interface GroundedAnswer {
  grounded:   boolean;
  answer:     string;
  citations:  GroundedCitation[];
  disclaimer: string;
}

export async function askGrounded(
  query: string,
  ticker?: string | null,
  token?: string | null,
): Promise<GroundedAnswer | null> {
  if (!token) return null;
  try {
    return await requestJson<GroundedAnswer>('/ai/ask', {
      method: 'POST',
      token,
      body: JSON.stringify({ query, ticker: ticker ?? null }),
    });
  } catch {
    return null;
  }
}
