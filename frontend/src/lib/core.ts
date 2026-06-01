/**
 * lib/core.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared HTTP primitives and domain types used by every service file.
 * Nothing is exported from here that a page component should import directly —
 * use the service files or the top-level api.ts barrel instead.
 */

import type { AppUser } from '../store/useStore';

// ── API base URL ──────────────────────────────────────────────────────────────
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
).replace(/\/$/, '');

// ── Shared internal types ─────────────────────────────────────────────────────
export interface BackendUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  language: string;
  investing_style: string | null;
  risk_appetite: number | null;
  sectors: string[];
  onboarding_completed: boolean;
}

export interface BackendTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: BackendUser;
}

export interface RequestOptions extends RequestInit {
  token?: string | null;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
export function buildHeaders(token?: string | null, headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (!merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }
  if (token) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly auth cookie on every request
    headers: buildHeaders(options.token, options.headers),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ── User mapping helpers ──────────────────────────────────────────────────────
export function mapPlan(plan: string | null | undefined): AppUser['plan'] {
  if (plan === 'enterprise' || plan === 'pro') return plan;
  if (plan === 'premium') return 'premium';
  return 'free';
}

export function buildUserFromBackend(user: BackendUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    plan: mapPlan(user.plan),
    language: user.language === 'hi' ? 'hi' : 'en',
    investingStyle:
      user.investing_style === 'pro'
        ? 'pro'
        : user.investing_style === 'beginner'
          ? 'beginner'
          : 'intermediate',
    riskAppetite: user.risk_appetite ?? 5,
    sectors: user.sectors ?? [],
  };
}

// ── Misc shared helpers ───────────────────────────────────────────────────────
export function normalizeToCrores(value: number | null | undefined) {
  if (!value) return 0;
  return value > 1_000_000_000 ? value / 10_000_000 : value;
}
