import { requestJson } from './http';

export async function fetchMutualFunds(category: string) {
  const categoryMap: Record<string, string> = {
    All: 'index', 'Flexi Cap': 'flexi_cap', 'Large Cap': 'large_cap',
    'Large & Mid Cap': 'mid_cap', 'Small Cap': 'small_cap', ELSS: 'elss', Debt: 'index',
  };
  return requestJson<Array<{
    ticker: string; name: string; nav: number; change_pct: number;
    aum?: number | null; expense_ratio?: number | null; returns_1y?: number | null;
  }>>(`/mutual-funds?category=${categoryMap[category] ?? 'index'}`);
}

export async function fetchSipProjection(monthlyAmount: number, expectedReturn: number, tenureYears: number) {
  return requestJson<{
    total_invested: number; future_value: number;
    total_returns: number; wealth_gain_pct: number;
  }>(`/mutual-funds/sip-calculator?monthly_amount=${monthlyAmount}&expected_return=${expectedReturn.toFixed(3)}&tenure_years=${tenureYears}`);
}
