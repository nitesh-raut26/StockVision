/**
 * lib/services/stockService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stock market data — quotes, search, screener, stock details, DCF, heatmap.
 * Endpoint prefixes: /stocks, /screener, /dcf
 */

import {
  requestJson,
  normalizeToCrores,
} from '../core';
import {
  mockHeatmapData,
  mockMarketIndices,
  mockMutualFunds,
  mockStocks,
} from '../../data/mockData';

export interface SearchResult {
  id: string;
  label: string;
  subtitle: string;
  path: string;
  type: 'stock' | 'fund';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type MockStock = (typeof mockStocks)[number];

function buildSyntheticStock(ticker: string): MockStock {
  return {
    id: ticker,
    ticker,
    name: ticker,
    price: 0,
    change: 0,
    changePct: 0,
    marketCap: 0,
    sector: 'Unknown',
    pe: 0,
    roce: 0,
    debtEquity: 0,
    promoterHolding: 0,
    revenue: 0,
    revenueGrowth: 0,
    convictionScore: 5,
    target12m: 0,
    upside: 0,
    risk: 'Medium',
    high52w: 0,
    low52w: 0,
    evEbitda: 0,
    description: 'Live market data is unavailable for this stock right now.',
    volumeSpike: false,
    analystRating: 'Hold',
  };
}

export function findMockStock(ticker: string) {
  return (
    mockStocks.find((s) => s.ticker === ticker.toUpperCase()) ??
    buildSyntheticStock(ticker.toUpperCase())
  );
}

function mapScreenerResultToStock(result: {
  ticker: string;
  name: string;
  sector: string;
  cap?: string;
  price: number;
  change_pct: number;
  conviction_score: number;
  pe_ratio?: number | null;
  roce?: number | null;
  debt_equity?: number | null;
  promoter_holding?: number | null;
  revenue_growth?: number | null;
  target_12m?: number | null;
  upside?: number | null;
  risk: string;
  market_cap?: number | null;
}) {
  const fallback = findMockStock(result.ticker);
  const absoluteChange = result.price * (result.change_pct / 100);

  return {
    ...fallback,
    id: result.ticker,
    ticker: result.ticker,
    name: result.name,
    sector: result.sector || fallback.sector,
    cap: result.cap ?? 'mid',
    price: result.price,
    change: Number.isFinite(absoluteChange) ? absoluteChange : fallback.change,
    changePct: result.change_pct ?? fallback.changePct,
    convictionScore: result.conviction_score ?? fallback.convictionScore,
    pe: result.pe_ratio ?? fallback.pe,
    roce: result.roce ?? fallback.roce,
    debtEquity: result.debt_equity ?? fallback.debtEquity,
    promoterHolding: result.promoter_holding ?? fallback.promoterHolding,
    revenueGrowth: result.revenue_growth ?? fallback.revenueGrowth,
    target12m: result.target_12m ?? fallback.target12m,
    upside: result.upside ?? fallback.upside,
    risk: result.risk ?? fallback.risk,
    marketCap: result.market_cap ?? (fallback as any).marketCap ?? 0,
    description:
      fallback.description ||
      `${result.name} is currently screened as a ${result.risk.toLowerCase()}-risk ${result.sector} opportunity.`,
  };
}

function filterMockStocks(filters: {
  min_conviction_score: number;
  max_pe: number;
  min_roce: number;
  max_debt_equity: number;
  min_promoter_holding: number;
  min_revenue_growth: number;
  sector?: string | null;
  sort_by: string;
}) {
  const matches = mockStocks.filter(
    (s) =>
      s.convictionScore >= filters.min_conviction_score &&
      s.pe <= filters.max_pe &&
      s.roce >= filters.min_roce &&
      s.debtEquity <= filters.max_debt_equity &&
      s.promoterHolding >= filters.min_promoter_holding &&
      s.revenueGrowth >= filters.min_revenue_growth &&
      (!filters.sector || s.sector.toLowerCase() === filters.sector.toLowerCase()),
  );

  if (filters.sort_by === 'upside') matches.sort((a, b) => b.upside - a.upside);
  else if (filters.sort_by === 'change_pct') matches.sort((a, b) => b.changePct - a.changePct);
  else if (filters.sort_by === 'pe_ratio') matches.sort((a, b) => a.pe - b.pe);
  else matches.sort((a, b) => b.convictionScore - a.convictionScore);

  return matches;
}

export function buildConvictionBreakdown(factors?: Record<string, number>) {
  if (!factors) {
    return [
      { name: 'Fundamentals', value: 38, color: '#4361EE' },
      { name: 'Technicals',   value: 34, color: '#22D3EE' },
      { name: 'Sentiment',    value: 28, color: 'var(--gain)' },
    ];
  }

  const fund = [
    factors.pe_attractiveness,
    factors.pb_attractiveness,
    factors.revenue_growth,
    factors.roe,
    factors.debt_equity,
    factors.dividend_yield,
    factors.free_cash_flow,
  ].filter((v) => v !== undefined);

  const tech = [
    factors.price_momentum_1m,
    factors.price_momentum_3m,
    factors.week_52_position,
    factors.volume_signal,
  ].filter((v) => v !== undefined);

  const sent = [factors.beta_risk].filter((v) => v !== undefined);

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) : 0;

  return [
    { name: 'Fundamentals', value: avg(fund), color: '#4361EE' },
    { name: 'Technicals',   value: avg(tech), color: '#22D3EE' },
    { name: 'Sentiment',    value: avg(sent), color: 'var(--gain)' },
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchIndices() {
  const fallback = mockMarketIndices;
  try {
    const indices = await requestJson<Array<{ price: number; change: number; change_pct: number }>>(
      '/stocks/indices',
    );
    return fallback.map((index, i) => ({
      ...index,
      value:     indices[i]?.price      ?? index.value,
      change:    indices[i]?.change     ?? index.change,
      changePct: indices[i]?.change_pct ?? index.changePct,
    }));
  } catch {
    return fallback;
  }
}

export async function searchMarket(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const fundMatches = mockMutualFunds
    .filter(
      (f) =>
        f.name.toLowerCase().includes(trimmed) ||
        f.amc.toLowerCase().includes(trimmed),
    )
    .slice(0, 3)
    .map((f) => ({
      id:       f.id,
      label:    f.name,
      subtitle: `${f.amc} · ${f.category}`,
      path:     '/app/mutual-funds',
      type:     'fund' as const,
    }));

  try {
    const stocks = await requestJson<Array<{ ticker: string; name: string; exchange: string }>>(
      `/stocks/search?q=${encodeURIComponent(query)}&limit=6`,
    );
    return [
      ...stocks.map((s) => ({
        id:       s.ticker,
        label:    s.ticker,
        subtitle: s.name || s.exchange,
        path:     `/app/stock/${s.ticker}`,
        type:     'stock' as const,
      })),
      ...fundMatches,
    ].slice(0, 8);
  } catch {
    const stockMatches = mockStocks
      .filter(
        (s) =>
          s.ticker.toLowerCase().includes(trimmed) ||
          s.name.toLowerCase().includes(trimmed),
      )
      .slice(0, 5)
      .map((s) => ({
        id:       s.ticker,
        label:    s.ticker,
        subtitle: s.name,
        path:     `/app/stock/${s.ticker}`,
        type:     'stock' as const,
      }));
    return [...stockMatches, ...fundMatches].slice(0, 8);
  }
}

export async function fetchScreener(
  filters: {
    min_conviction_score: number;
    max_pe: number;
    min_roce: number;
    max_debt_equity: number;
    min_promoter_holding: number;
    min_revenue_growth: number;
    sector?: string | null;
    cap?: string | null;
    universe?: string;
    sort_by: string;
    limit?: number;
  },
  token?: string | null,
) {
  try {
    const response = await requestJson<
      Array<{
        ticker: string;
        name: string;
        sector: string;
        cap?: string;
        price: number;
        change_pct: number;
        conviction_score: number;
        pe_ratio?: number | null;
        roce?: number | null;
        debt_equity?: number | null;
        promoter_holding?: number | null;
        revenue_growth?: number | null;
        target_12m?: number | null;
        upside?: number | null;
        risk: string;
        market_cap?: number | null;
      }>
    >('/screener/run', {
      method: 'POST',
      token,
      body: JSON.stringify(filters),
    });

    return response.map(mapScreenerResultToStock);
  } catch {
    return filterMockStocks(filters);
  }
}

export async function fetchStockDetails(ticker: string) {
  const fallbackStock = findMockStock(ticker);

  try {
    const [quote, history, conviction] = await Promise.all([
      requestJson<{
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
      }>(`/stocks/quote/${ticker}`),
      requestJson<Array<{ date: string; close: number; volume: number }>>(
        `/stocks/history/${ticker}?period=1y`,
      ),
      requestJson<{
        score: number;
        factors: Record<string, number>;
        rationale: string;
        last_updated: string;
      }>(`/stocks/conviction/${ticker}`),
    ]);

    const target12m =
      fallbackStock.target12m ||
      Number((quote.price * (1 + (conviction.score - 5) * 0.08)).toFixed(2));

    const stock = {
      ...fallbackStock,
      id:             quote.ticker,
      ticker:         quote.ticker,
      name:           quote.name || fallbackStock.name,
      price:          quote.price,
      change:         quote.change,
      changePct:      quote.change_pct,
      marketCap:      normalizeToCrores(quote.market_cap) || fallbackStock.marketCap,
      sector:         quote.sector || fallbackStock.sector,
      pe:             quote.pe_ratio ?? fallbackStock.pe,
      high52w:        quote.week_52_high ?? fallbackStock.high52w,
      low52w:         quote.week_52_low  ?? fallbackStock.low52w,
      convictionScore: conviction.score,
      target12m,
      upside:         quote.price
        ? Number((((target12m - quote.price) / quote.price) * 100).toFixed(1))
        : fallbackStock.upside,
      description: conviction.rationale || fallbackStock.description,
    };

    return {
      stock,
      history:   history.map((p) => ({ date: p.date, price: p.close, volume: p.volume })),
      conviction,
      breakdown: buildConvictionBreakdown(conviction.factors),
    };
  } catch {
    return {
      stock:     fallbackStock,
      history:   [],
      conviction: {
        score:    fallbackStock.convictionScore,
        factors:  undefined,
        rationale: fallbackStock.description,
      },
      breakdown: buildConvictionBreakdown(),
    };
  }
}

export async function fetchDcf(ticker: string, wacc: number, growthYears: number) {
  try {
    return await requestJson<{
      intrinsic_value_per_share: number;
      enterprise_value: number;
      equity_value: number;
      pv_fcfs: number;
      pv_terminal: number;
      terminal_value: number;
      scenarios: { bear: number; base: number; bull: number };
      assumptions: {
        wacc: number;
        revenue_growth_rate: number;
        terminal_growth_rate: number;
        projection_years: number;
      };
      current_price: number;
      upside_pct: number | null;
      recommendation: string;
      projected_fcfs: Array<{ year: number; fcf: number; pv: number; growth_rate: number }>;
    }>(`/dcf/${ticker}?wacc=${wacc.toFixed(3)}&growth_years=${growthYears}`);
  } catch {
    return null;
  }
}

export async function fetchHeatmap() {
  const tickers = mockHeatmapData.map((s) => s.ticker).join(',');
  try {
    const quotes = await requestJson<
      Array<{ ticker: string; change_pct: number; market_cap: number }>
    >(`/stocks/heatmap?tickers=${encodeURIComponent(tickers)}`);
    const map = new Map(quotes.map((q) => [q.ticker, q]));
    return mockHeatmapData.map((s) => ({
      ...s,
      change:    map.get(s.ticker)?.change_pct ?? s.change,
      marketCap: normalizeToCrores(map.get(s.ticker)?.market_cap) || s.marketCap,
    }));
  } catch {
    return mockHeatmapData;
  }
}
