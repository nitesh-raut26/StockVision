import { requestJson } from './http';

export async function fetchPortfolioSummary(token: string) {
  return requestJson<{
    total_value: number;
    total_invested: number;
    total_gain: number;
    gain_pct: number;
    xirr: number | null;
    holdings: Array<{
      ticker: string; name: string; qty: number;
      avg_price: number; current_price: number; current_value: number;
      pnl: number; pnl_pct: number; broker: string; sector: string;
    }>;
    broker_breakdown: Array<{ broker: string; value: number; invested: number; pnl: number }>;
  }>('/portfolio/summary', { token });
}

export async function createTransaction(
  payload: { ticker: string; action: 'BUY' | 'SELL'; qty: number; price: number; broker?: string; trade_date?: string; charges?: number },
  token: string,
) {
  return requestJson('/portfolio/transactions/', {
    method: 'POST', token, body: JSON.stringify(payload),
  });
}

export async function fetchTaxSummary(token: string) {
  return requestJson<{
    stcg_gains: number; ltcg_gains: number; stcg_tax: number; ltcg_tax: number;
    total_tax: number; tax_saved_potential: number;
    harvesting_suggestions: Array<{ ticker: string; loss: number; tax_saving?: number; taxSaving?: number; deadline?: string; name?: string }>;
  }>('/portfolio/tax', { token });
}

export interface GoalPayload {
  name: string;
  goal_type: 'education' | 'home' | 'retirement' | 'emergency' | 'custom';
  target_amount: number;
  target_date: string;
  monthly_sip: number;
}

export async function fetchGoals(token: string) {
  return requestJson<Array<{
    id: string; name: string; goal_type: string;
    target_amount: number; target_date: string; monthly_sip: number;
    current_corpus: number; projected_corpus: number; on_track: boolean;
    completion_pct: number; suggested_allocation: Array<{ asset: string; pct: number }>;
  }>>('/portfolio/goals', { token });
}

export async function saveGoal(payload: GoalPayload, token: string) {
  return requestJson('/portfolio/goals', { method: 'POST', token, body: JSON.stringify(payload) });
}
