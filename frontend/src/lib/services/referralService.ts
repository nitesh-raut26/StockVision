/**
 * lib/services/referralService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Refer-and-Earn — referral code, stats, milestones, and claim.
 * Endpoint prefix: /referrals
 *
 * `fetchReferralStats` returns `null` when there is no auth token or the API is
 * unreachable, so the UI can fall back to a locally-derived code + demo stats.
 */

import { requestJson } from '../core';

export interface ReferralMilestone {
  target:   number;
  reward:   string;
  achieved: boolean;
  premium_days?: number;
}

export interface ReferralStats {
  code:       string;
  invited:    number;
  qualified?: number;
  earnedInr:  number;
  pendingInr: number;
  premiumDaysEarned?: number;
  milestones: ReferralMilestone[];
}

export async function fetchReferralStats(token?: string | null): Promise<ReferralStats | null> {
  if (!token) return null;
  try {
    const r = await requestJson<{
      code:        string;
      invited:     number;
      qualified?:  number;
      earned_inr:  number;
      pending_inr: number;
      premium_days_earned?: number;
      milestones:  ReferralMilestone[];
    }>('/referrals/me', { token });

    return {
      code:       r.code,
      invited:    r.invited,
      qualified:  r.qualified,
      earnedInr:  r.earned_inr,
      pendingInr: r.pending_inr,
      premiumDaysEarned: r.premium_days_earned,
      milestones: r.milestones ?? [],
    };
  } catch {
    return null;
  }
}

export async function claimReferral(referralCode: string, token?: string | null) {
  return requestJson<{ message: string }>('/referrals/claim', {
    method: 'POST',
    token,
    body: JSON.stringify({ referral_code: referralCode }),
  });
}
