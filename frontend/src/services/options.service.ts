import { requestJson } from './http';

export async function fetchOptionsChain(symbol: string, expiry: string) {
  return requestJson<{
    symbol: string; expiry: string; spot: number; pcr: number;
    max_pain: number; support: number; resistance: number;
    chain: Record<string, unknown>[];
  }>(`/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`);
}

export async function fetchOptionExpiries() {
  return requestJson<string[]>('/options/expiries');
}

export async function fetchOptionUnderlyings() {
  return requestJson<Array<{ symbol: string; spot: number; lot: number }>>('/options/underlyings');
}
