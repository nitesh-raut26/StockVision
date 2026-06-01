/**
 * lib/services/mutualFundService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mutual funds — list, SIP projection, ELSS.
 * Endpoint prefix: /mutual-funds
 */

import { requestJson } from '../core';
import { mockMutualFunds } from '../../data/mockData';

// ── SIP helper ────────────────────────────────────────────────────────────────

function calculateSipProjection(
  monthlyAmount: number,
  expectedReturn: number,
  tenureYears: number,
) {
  const monthlyRate  = expectedReturn / 12;
  const totalMonths  = tenureYears * 12;
  const futureValue  = monthlyRate > 0
    ? monthlyAmount * ((((1 + monthlyRate) ** totalMonths) - 1) / monthlyRate) * (1 + monthlyRate)
    : monthlyAmount * totalMonths;
  const totalInvested = monthlyAmount * totalMonths;

  return {
    monthlyAmount,
    tenureYears,
    expectedReturnPct: expectedReturn * 100,
    totalInvested,
    futureValue,
    totalReturns: futureValue - totalInvested,
    wealthGainPct: totalInvested ? ((futureValue - totalInvested) / totalInvested) * 100 : 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchMutualFunds(category: string) {
  const categoryMap: Record<string, string> = {
    All:               'index',
    'Flexi Cap':       'flexi_cap',
    'Large Cap':       'large_cap',
    'Large & Mid Cap': 'mid_cap',
    'Small Cap':       'small_cap',
    ELSS:              'elss',
    Debt:              'index',
  };

  const fallbackPool =
    category === 'All'
      ? mockMutualFunds
      : mockMutualFunds.filter((f) => f.category === category);

  try {
    const funds = await requestJson<
      Array<{
        ticker: string;
        name: string;
        nav: number;
        change_pct: number;
        aum?: number | null;
        expense_ratio?: number | null;
        returns_1y?: number | null;
      }>
    >(`/mutual-funds?category=${categoryMap[category] ?? 'index'}`);

    return funds.map((fund, i) => {
      const fallback =
        fallbackPool[i % Math.max(1, fallbackPool.length)] ??
        mockMutualFunds[i % mockMutualFunds.length];
      return {
        ...fallback,
        id:           fund.ticker,
        name:         fund.name || fallback.name,
        aum:          fund.aum ?? fallback.aum,
        returns1y:    fund.returns_1y ?? fallback.returns1y,
        expenseRatio: fund.expense_ratio
          ? Number((fund.expense_ratio * 100).toFixed(2))
          : fallback.expenseRatio,
      };
    });
  } catch {
    return fallbackPool.length ? fallbackPool : mockMutualFunds;
  }
}

export async function fetchSipProjection(
  monthlyAmount: number,
  expectedReturn: number,
  tenureYears: number,
) {
  try {
    const r = await requestJson<{
      total_invested: number;
      future_value: number;
      total_returns: number;
      wealth_gain_pct: number;
    }>(
      `/mutual-funds/sip-calculator?monthly_amount=${monthlyAmount}&expected_return=${expectedReturn.toFixed(3)}&tenure_years=${tenureYears}`,
    );

    return {
      totalInvested: r.total_invested,
      futureValue:   r.future_value,
      totalReturns:  r.total_returns,
      wealthGainPct: r.wealth_gain_pct,
    };
  } catch {
    return calculateSipProjection(monthlyAmount, expectedReturn, tenureYears);
  }
}

export async function fetchELSSFunds() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/elss');
  } catch {
    return null;
  }
}
