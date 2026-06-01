/**
 * lib/services/portfolioService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Portfolio, transactions, tax, goals, and portfolio health.
 * Endpoint prefix: /portfolio
 */

import { requestJson } from '../core';
import { mockPortfolio, mockTaxData } from '../../data/mockData';

const LOCAL_GOALS_KEY = 'stockvision-local-goals';

export interface GoalPayload {
  name: string;
  goal_type: 'education' | 'home' | 'retirement' | 'emergency' | 'custom';
  target_amount: number;
  target_date: string;
  monthly_sip: number;
}

// ── Local-storage goal helpers ────────────────────────────────────────────────

function readLocalGoals() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_GOALS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocalGoals(goals: unknown[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(goals));
}

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function buildFallbackPortfolioSummary() {
  const totalValue    = mockPortfolio.holdings.reduce((s, h) => s + h.currentPrice * h.qty, 0);
  const totalInvested = mockPortfolio.holdings.reduce((s, h) => s + h.avgPrice    * h.qty, 0);

  return {
    totalValue,
    totalInvested,
    totalGain: totalValue - totalInvested,
    gainPct:   totalInvested ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    xirr:      mockPortfolio.xirr,
    holdings:  mockPortfolio.holdings.map((h) => ({
      ticker:       h.ticker,
      name:         h.name,
      qty:          h.qty,
      avgPrice:     h.avgPrice,
      currentPrice: h.currentPrice,
      currentValue: h.currentPrice * h.qty,
      pnl:          h.pnl,
      pnlPct:       h.pnlPct,
      broker:       h.broker,
      sector:       h.sector,
    })),
    brokerBreakdown: mockPortfolio.brokers.map((b) => ({
      broker:   b.name,
      value:    b.value,
      invested: b.value - (mockPortfolio.totalPnl * b.value) / mockPortfolio.totalValue,
      pnl:      (mockPortfolio.totalPnl * b.value) / mockPortfolio.totalValue,
    })),
  };
}

function buildFallbackTaxSummary() {
  return {
    stcgGains:             mockTaxData.stcgGains,
    ltcgGains:             mockTaxData.ltcgGains,
    stcgTax:               mockTaxData.stcgTax,
    ltcgTax:               mockTaxData.ltcgTax,
    totalTax:              mockTaxData.stcgTax + mockTaxData.ltcgTax,
    taxSavedPotential:     mockTaxData.taxSaved,
    harvestingSuggestions: mockTaxData.harvestingSuggestions,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchPortfolioSummary(token?: string | null) {
  if (!token) return buildFallbackPortfolioSummary();

  try {
    const r = await requestJson<{
      total_value: number;
      total_invested: number;
      total_gain: number;
      gain_pct: number;
      xirr: number | null;
      holdings: Array<{
        ticker: string;
        name: string;
        qty: number;
        avg_price: number;
        current_price: number;
        current_value: number;
        pnl: number;
        pnl_pct: number;
        broker: string;
        sector: string;
      }>;
      broker_breakdown: Array<{ broker: string; value: number; invested: number; pnl: number }>;
    }>('/portfolio/summary', { token });

    return {
      totalValue:      r.total_value,
      totalInvested:   r.total_invested,
      totalGain:       r.total_gain,
      gainPct:         r.gain_pct,
      xirr:            r.xirr,
      holdings:        r.holdings.map((h) => ({
        ticker:       h.ticker,
        name:         h.name,
        qty:          h.qty,
        avgPrice:     h.avg_price,
        currentPrice: h.current_price,
        currentValue: h.current_value,
        pnl:          h.pnl,
        pnlPct:       h.pnl_pct,
        broker:       h.broker,
        sector:       h.sector,
      })),
      brokerBreakdown: r.broker_breakdown,
    };
  } catch {
    return buildFallbackPortfolioSummary();
  }
}

export async function createTransaction(
  payload: {
    ticker: string;
    action: 'BUY' | 'SELL';
    qty: number;
    price: number;
    broker?: string;
    trade_date?: string;
    charges?: number;
  },
  token?: string | null,
) {
  if (!token) return null;
  return requestJson('/portfolio/transactions/', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function fetchTaxSummary(token?: string | null) {
  if (!token) return buildFallbackTaxSummary();

  try {
    const r = await requestJson<{
      stcg_gains: number;
      ltcg_gains: number;
      stcg_tax: number;
      ltcg_tax: number;
      total_tax: number;
      tax_saved_potential: number;
      harvesting_suggestions: Array<{
        ticker: string;
        loss: number;
        taxSaving?: number;
        tax_saving?: number;
        deadline?: string;
        name?: string;
      }>;
    }>('/portfolio/tax', { token });

    return {
      stcgGains:         r.stcg_gains,
      ltcgGains:         r.ltcg_gains,
      stcgTax:           r.stcg_tax,
      ltcgTax:           r.ltcg_tax,
      totalTax:          r.total_tax,
      taxSavedPotential: r.tax_saved_potential,
      harvestingSuggestions: r.harvesting_suggestions.map((s) => ({
        ticker:    s.ticker,
        name:      s.name ?? s.ticker,
        loss:      s.loss,
        taxSaving: s.tax_saving ?? s.taxSaving ?? 0,
        deadline:  s.deadline ?? 'Mar 31',
      })),
    };
  } catch {
    return buildFallbackTaxSummary();
  }
}

export async function fetchGoals(token?: string | null) {
  if (!token) return readLocalGoals();

  try {
    return await requestJson<
      Array<{
        id: string;
        name: string;
        goal_type: string;
        target_amount: number;
        target_date: string;
        monthly_sip: number;
        current_corpus: number;
        projected_corpus: number;
        on_track: boolean;
        completion_pct: number;
        suggested_allocation: Array<{ asset: string; pct: number }>;
      }>
    >('/portfolio/goals', { token });
  } catch {
    return readLocalGoals();
  }
}

export async function saveGoal(payload: GoalPayload, token?: string | null) {
  if (!token) {
    const goals = readLocalGoals();
    const months = Math.max(
      1,
      Math.round((new Date(payload.target_date).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)),
    );
    const projectedCorpus = payload.monthly_sip * months;
    const goal = {
      id: `goal-${Date.now()}`,
      ...payload,
      current_corpus:      0,
      projected_corpus:    projectedCorpus,
      on_track:            projectedCorpus >= payload.target_amount,
      completion_pct:      0,
      suggested_allocation: [
        { asset: 'Equity',       pct: 60 },
        { asset: 'Mutual Funds', pct: 30 },
        { asset: 'Debt',         pct: 10 },
      ],
    };
    writeLocalGoals([goal, ...goals]);
    return goal;
  }

  return requestJson('/portfolio/goals', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

/** Pure computation — no API call. Can be used anywhere. */
export function computePortfolioHealth(
  holdings: Array<{ sector: string; currentValue: number; pnlPct: number }>,
) {
  if (!holdings.length) return { score: 0, grade: 'N/A', insights: [] };

  const total     = holdings.reduce((a, h) => a + h.currentValue, 0);
  const sectors   = new Set(holdings.map((h) => h.sector)).size;
  const sectorMap = holdings.reduce((acc, h) => {
    acc[h.sector] = (acc[h.sector] || 0) + h.currentValue;
    return acc;
  }, {} as Record<string, number>);
  const topWeight = (Math.max(...Object.values(sectorMap)) / total) * 100;
  const avgReturn = holdings.reduce((a, h) => a + h.pnlPct, 0) / holdings.length;

  let score = 50;
  if (sectors >= 5) score += 20;
  else if (sectors >= 3) score += 10;
  if (topWeight < 30) score += 15;
  else if (topWeight > 60) score -= 10;
  if (avgReturn > 15) score += 15;
  else if (avgReturn > 5) score += 8;
  else if (avgReturn < -10) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const grade    = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
  const insights: string[] = [];
  if (sectors < 3) insights.push(`Only ${sectors} sector(s) — add more for diversification`);
  if (topWeight > 50) insights.push(`Top sector is ${topWeight.toFixed(0)}% of portfolio — consider trimming`);
  if (avgReturn > 20) insights.push('Strong returns — review if any position is oversized');
  if (!insights.length) insights.push('Portfolio looks well balanced');

  return { score, grade, insights };
}
