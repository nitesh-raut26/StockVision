/**
 * lib/services/watchlistService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Watchlist items and price/volume alerts.
 * Endpoint prefixes: /watchlist, /alerts
 */

import { requestJson } from '../core';

// ── Mock fallback data ────────────────────────────────────────────────────────

const MOCK_WATCHLIST = [
  { id: 'w1', ticker: 'IDEAFORGE', name: 'IdeaForge Technologies', price: 842,  change: 2.62,  changePct: 2.62,  sector: 'Defence', convictionScore: 9.1, notes: '' },
  { id: 'w2', ticker: 'HAL',       name: 'Hindustan Aeronautics',  price: 4200, change: -1.08, changePct: -1.08, sector: 'Defence', convictionScore: 8.7, notes: 'Watching for Q4 results' },
  { id: 'w3', ticker: 'RELIANCE',  name: 'Reliance Industries',    price: 2920, change: 0.83,  changePct: 0.83,  sector: 'Energy',  convictionScore: 7.8, notes: '' },
  { id: 'w4', ticker: 'BAJFINANCE',name: 'Bajaj Finance',          price: 7820, change: 3.24,  changePct: 3.24,  sector: 'NBFC',   convictionScore: 8.2, notes: 'Alert set at ₹8,000' },
];

const MOCK_ALERTS = [
  { id: 'a1', ticker: 'HAL',        condition: 'above',      threshold: 4500, active: true,  triggered: false },
  { id: 'a2', ticker: 'BAJFINANCE', condition: 'above',      threshold: 8000, active: true,  triggered: false },
  { id: 'a3', ticker: 'RELIANCE',   condition: 'below',      threshold: 2700, active: true,  triggered: false },
  { id: 'a4', ticker: 'IDEAFORGE',  condition: 'pct_change', threshold: 10,   active: false, triggered: true  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchWatchlist(token?: string | null) {
  if (!token) return MOCK_WATCHLIST;
  try {
    return await requestJson<typeof MOCK_WATCHLIST>('/watchlist/', { token });
  } catch {
    return MOCK_WATCHLIST;
  }
}

export async function addToWatchlist(ticker: string, notes: string, token?: string | null) {
  if (!token) return { id: `w${Date.now()}`, ticker: ticker.toUpperCase(), notes };
  try {
    return await requestJson('/watchlist/', {
      method: 'POST',
      token,
      body: JSON.stringify({ ticker, notes }),
    });
  } catch {
    return { id: `w${Date.now()}`, ticker: ticker.toUpperCase(), notes };
  }
}

export async function removeFromWatchlist(ticker: string, token?: string | null) {
  if (!token) return;
  try {
    await requestJson(`/watchlist/${ticker}`, { method: 'DELETE', token });
  } catch { /* ignore */ }
}

export async function fetchAlerts(token?: string | null) {
  if (!token) return MOCK_ALERTS;
  try {
    return await requestJson<typeof MOCK_ALERTS>('/alerts', { token });
  } catch {
    return MOCK_ALERTS;
  }
}

export async function createAlert(
  ticker: string,
  condition: string,
  threshold: number,
  token?: string | null,
) {
  if (!token) {
    return { id: `a${Date.now()}`, ticker, condition, threshold, active: true, triggered: false };
  }
  try {
    return await requestJson('/alerts', {
      method: 'POST',
      token,
      body: JSON.stringify({ ticker, condition, threshold }),
    });
  } catch {
    return { id: `a${Date.now()}`, ticker, condition, threshold, active: true, triggered: false };
  }
}

export async function toggleAlert(alertId: string, active: boolean, token?: string | null) {
  if (!token) return;
  try {
    return await requestJson(`/alerts/${alertId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ active }),
    });
  } catch { /* ignore */ }
}

export async function deleteAlert(alertId: string, token?: string | null) {
  if (!token) return;
  try {
    await requestJson(`/alerts/${alertId}`, { method: 'DELETE', token });
  } catch { /* ignore */ }
}
