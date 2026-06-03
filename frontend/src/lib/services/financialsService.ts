/**
 * lib/services/financialsService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Financial statements (income / balance sheet / cash flow).
 * Endpoint prefix: /financials  (public — no auth required)
 *
 * Returns `null` when the API is unreachable so callers can fall back to demo
 * figures. All monetary fields are already in ₹ crore; EPS is in ₹.
 */

import { requestJson } from '../core';

export interface IncomeStatementRow {
  period_label: string;
  period_end:   string;
  revenue:      number | null;
  ebitda:       number | null;
  pat:          number | null;
  eps_basic:    number | null;
  eps_diluted:  number | null;
}

export async function fetchIncomeStatement(
  ticker: string,
  period: 'quarterly' | 'annual' = 'quarterly',
  limit = 8,
): Promise<IncomeStatementRow[] | null> {
  try {
    const r = await requestJson<{ data: IncomeStatementRow[] }>(
      `/financials/${encodeURIComponent(ticker)}/income?period=${period}&limit=${limit}`,
    );
    return r.data?.length ? r.data : null;
  } catch {
    return null;
  }
}
