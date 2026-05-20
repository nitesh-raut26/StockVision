import { requestJson } from './http';

export async function fetchOpenIPOs() {
  return requestJson<Record<string, unknown>[]>('/ipo/open');
}

export async function fetchUpcomingIPOs() {
  return requestJson<Record<string, unknown>[]>('/ipo/upcoming');
}

export async function fetchListedIPOs(limit = 20) {
  return requestJson<Record<string, unknown>[]>(`/ipo/listed?limit=${limit}`);
}

export async function fetchSMEIPOs() {
  return requestJson<Record<string, unknown>[]>('/ipo/sme');
}

export async function fetchELSSFunds() {
  return requestJson<Record<string, unknown>[]>('/ipo/elss');
}

export async function fetchIPOStats() {
  return requestJson<{ open_count: number; upcoming_count: number; sme_count: number; total_raised_fy: string; avg_listing_gain: number }>(
    '/ipo/stats',
  );
}
