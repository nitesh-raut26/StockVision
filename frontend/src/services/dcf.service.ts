import { requestJson } from './http';

export async function fetchDcf(ticker: string, wacc: number, growthYears: number) {
  return requestJson<{
    intrinsic_value_per_share: number; enterprise_value: number;
    equity_value: number; pv_fcfs: number; pv_terminal: number;
    terminal_value: number; scenarios: { bear: number; base: number; bull: number };
    assumptions: { wacc: number; revenue_growth_rate: number; terminal_growth_rate: number; projection_years: number };
    current_price: number; upside_pct: number | null; recommendation: string;
    projected_fcfs: Array<{ year: number; fcf: number; pv: number; growth_rate: number }>;
  }>(`/dcf/${ticker}?wacc=${wacc.toFixed(3)}&growth_years=${growthYears}`);
}
