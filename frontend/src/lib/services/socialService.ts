/**
 * lib/services/socialService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Research reports, leaderboard, and family portfolio.
 * Endpoint prefixes: /research, /leaderboard, /family
 */

import { requestJson } from '../core';
import { mockResearchReports, mockLeaderboard } from '../../data/mockData';

// ── Research ──────────────────────────────────────────────────────────────────

export async function fetchResearchReports(token?: string | null) {
  if (!token) return mockResearchReports;

  try {
    const reports = await requestJson<
      Array<{
        id: string;
        title: string;
        sector: string;
        ticker?: string | null;
        report_type: string;
        confidence: number;
        published_at: string;
        tags: string[];
      }>
    >('/research/', { token });

    return reports.map((r, i) => ({
      id:            r.id,
      title:         r.title,
      date:          new Date(r.published_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      }),
      stocksCovered: r.ticker ? [r.ticker] : r.tags.filter((t) => t.length <= 12).slice(0, 5),
      theme:         r.sector.split('/')[0].trim() || r.report_type,
      confidence:    r.confidence,
      downloads:     1200 + i * 420,
      shares:        280  + i * 120,
    }));
  } catch {
    return mockResearchReports;
  }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function fetchLeaderboard(token?: string | null) {
  if (!token) return mockLeaderboard;

  try {
    const entries = await requestJson<
      Array<{
        rank: number;
        display_name: string;
        returns_pct: number;
        portfolio_value: number;
        is_user: boolean;
      }>
    >('/leaderboard/', { token });

    return entries.map((e, i) => ({
      rank:           e.rank,
      username:       e.display_name,
      xirr:           e.returns_pct,
      portfolioValue: e.portfolio_value,
      percentile:     Math.max(1, 100 - i * 2),
      followers:      Math.max(8, 380 - i * 37),
      isUser:         e.is_user,
    }));
  } catch {
    return mockLeaderboard;
  }
}

// ── Family portfolio ──────────────────────────────────────────────────────────

export async function fetchFamilyAggregate(token?: string | null) {
  if (!token) return null;

  try {
    const agg = await requestJson<{
      total_value: number;
      total_invested: number;
      total_pnl: number;
      pnl_pct: number;
      members: Array<{
        id: string;
        name: string;
        relation: string;
        total_value: number;
        total_invested: number;
        total_pnl: number;
        pnl_pct: number;
        xirr: number;
        color: string;
        invite_status: string;
      }>;
    }>('/family/aggregate', { token });

    return {
      totalValue:    agg.total_value,
      totalInvested: agg.total_invested,
      totalPnl:      agg.total_pnl,
      pnlPct:        agg.pnl_pct,
      members:       agg.members.map((m) => ({
        id:        m.id,
        name:      m.name,
        relation:  m.relation,
        portfolio: m.total_value,
        invested:  m.total_invested,
        gain:      m.pnl_pct,
        xirr:      m.xirr,
        color:     m.color,
        status:    m.invite_status,
      })),
    };
  } catch {
    return null;
  }
}

export async function addFamilyMember(
  payload: { name: string; relation: string; phone?: string; email?: string },
  token?: string | null,
) {
  return requestJson('/family/members', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}
