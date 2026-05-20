import { requestJson } from './http';

export interface ScreenerFilters {
  min_conviction_score: number;
  max_pe: number;
  min_roce: number;
  max_debt_equity: number;
  min_promoter_holding: number;
  min_revenue_growth: number;
  sector?: string | null;
  sort_by: string;
  limit?: number;
}

export interface ScreenerResult {
  ticker: string; name: string; sector: string;
  price: number; change_pct: number; conviction_score: number;
  pe_ratio?: number | null; roce?: number | null;
  debt_equity?: number | null; promoter_holding?: number | null;
  revenue_growth?: number | null; target_12m?: number | null;
  upside?: number | null; risk: string;
}

export async function runScreener(filters: ScreenerFilters) {
  return requestJson<ScreenerResult[]>('/screener/run', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}
