/**
 * lib/services/marketDataService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FII/DII flows, market breadth, and top movers.
 * Endpoint prefix: /market
 */

import { requestJson } from '../core';

export interface FiiDiiRow {
  date:      string;
  fii_buy:   number;
  fii_sell:  number;
  fii_net:   number;
  dii_buy:   number;
  dii_sell:  number;
  dii_net:   number;
  total_net: number;
  sentiment: string;
}

export interface MarketBreadth {
  total:          number;
  advances:       number;
  declines:       number;
  unchanged:      number;
  ad_ratio:       number;
  breadth_signal: string;
  top_gainer:     Record<string, unknown> | null;
  top_loser:      Record<string, unknown> | null;
}

export async function fetchFiiDii(
  days = 30,
  token?: string | null,
): Promise<{ data: FiiDiiRow[]; count: number }> {
  try {
    return await requestJson<{ data: FiiDiiRow[]; count: number }>(
      `/market/fii-dii?days=${days}`,
      { token },
    );
  } catch {
    return { data: [], count: 0 };
  }
}

export async function fetchFiiDiiSummary(days = 10, token?: string | null) {
  try {
    return await requestJson<{
      days: number;
      fii_net_total: number;
      dii_net_total: number;
      combined_net: number;
      trend: string;
      fii_buy_streak: number;
      last_date: string | null;
    }>(`/market/fii-dii/summary?days=${days}`, { token });
  } catch {
    return null;
  }
}

export async function fetchMarketBreadth(token?: string | null): Promise<MarketBreadth | null> {
  try {
    return await requestJson<MarketBreadth>('/market/breadth', { token });
  } catch {
    return null;
  }
}

export async function fetchTopMovers(type: 'gainers' | 'losers', token?: string | null) {
  try {
    return await requestJson<{ count: number; data: Record<string, unknown>[] }>(
      `/market/top-${type}?limit=5`,
      { token },
    );
  } catch {
    return { count: 0, data: [] };
  }
}
