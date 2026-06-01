/**
 * lib/services/backtestService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy backtesting — run a backtest and list available strategies.
 * Endpoint prefix: /backtest
 */

import { requestJson } from '../core';

export interface BacktestPayload {
  strategy:   string;
  ticker:     string;
  period:     string;
  capital:    number;
  conditions?: Record<string, unknown>[];
}

export async function runBacktest(payload: BacktestPayload) {
  try {
    return await requestJson<{
      metrics:  Record<string, number>;
      equity:   { date: string; value: number; benchmark: number }[];
      drawdown: { date: string; drawdown: number }[];
      trades:   Record<string, unknown>[];
    }>('/backtest/run', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    return null;
  }
}

export async function fetchBacktestStrategies() {
  try {
    return await requestJson<{ id: string; name: string; desc: string }[]>(
      '/backtest/strategies',
    );
  } catch {
    return null;
  }
}
