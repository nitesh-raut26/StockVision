import { requestJson } from './http';

export interface BacktestPayload {
  strategy: string;
  ticker: string;
  period: string;
  capital: number;
  conditions?: Record<string, unknown>[];
}

export async function runBacktest(payload: BacktestPayload) {
  return requestJson<{
    metrics: Record<string, number>;
    equity: { date: string; value: number; benchmark: number }[];
    drawdown: { date: string; drawdown: number }[];
    trades: Record<string, unknown>[];
  }>('/backtest/run', { method: 'POST', body: JSON.stringify(payload) });
}

export async function fetchBacktestStrategies() {
  return requestJson<{ id: string; name: string; desc: string }[]>('/backtest/strategies');
}
