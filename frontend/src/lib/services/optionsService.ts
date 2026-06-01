/**
 * lib/services/optionsService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Options chain data and expiry dates.
 * Endpoint prefix: /options
 */

import { requestJson } from '../core';

export async function fetchOptionsChain(symbol: string, expiry: string) {
  try {
    return await requestJson<{
      symbol:     string;
      expiry:     string;
      spot:       number;
      pcr:        number;
      max_pain:   number;
      support:    number;
      resistance: number;
      chain:      Record<string, unknown>[];
    }>(
      `/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,
    );
  } catch {
    return null;
  }
}

export async function fetchOptionExpiries() {
  try {
    return await requestJson<string[]>('/options/expiries');
  } catch {
    return null;
  }
}
