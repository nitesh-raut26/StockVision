import { requestJson } from './http';

export async function fetchFamilyAggregate(token: string) {
  return requestJson<{
    total_value: number; total_invested: number; total_pnl: number; pnl_pct: number;
    members: Array<{
      id: string; name: string; relation: string;
      total_value: number; total_invested: number; total_pnl: number;
      pnl_pct: number; xirr: number; color: string; invite_status: string;
    }>;
  }>('/family/aggregate', { token });
}

export async function addFamilyMember(
  payload: { name: string; relation: string; phone?: string; email?: string },
  token: string,
) {
  return requestJson('/family/members', { method: 'POST', token, body: JSON.stringify(payload) });
}
