import { requestJson } from './http';

export async function fetchIndices() {
  return requestJson<Array<{ price: number; change: number; change_pct: number }>>('/stocks/indices');
}

export async function searchStocks(query: string) {
  return requestJson<Array<{ ticker: string; name: string; exchange: string }>>(
    `/stocks/search?q=${encodeURIComponent(query)}&limit=6`,
  );
}

export async function fetchStockQuote(ticker: string) {
  return requestJson<{
    ticker: string;
    name: string;
    price: number;
    change: number;
    change_pct: number;
    market_cap: number;
    pe_ratio?: number | null;
    week_52_high?: number | null;
    week_52_low?: number | null;
    sector?: string | null;
  }>(`/stocks/quote/${ticker}`);
}

export async function fetchStockHistory(ticker: string, period = '1y') {
  return requestJson<Array<{ date: string; close: number; volume: number }>>(
    `/stocks/history/${ticker}?period=${period}`,
  );
}

export async function fetchConviction(ticker: string) {
  return requestJson<{ score: number; factors: Record<string, number>; rationale: string; last_updated: string }>(
    `/stocks/conviction/${ticker}`,
  );
}

export async function fetchHeatmap(tickers: string) {
  return requestJson<Array<{ ticker: string; change_pct: number; market_cap: number }>>(
    `/stocks/heatmap?tickers=${encodeURIComponent(tickers)}`,
  );
}
