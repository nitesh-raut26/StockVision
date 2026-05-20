import { requestJson } from './http';

export async function fetchWatchlist(token: string) {
  return requestJson<Array<{ id: string; ticker: string; name: string; price: number; change: number; changePct: number; sector: string; convictionScore: number; notes: string }>>(
    '/watchlist/', { token },
  );
}

export async function addToWatchlist(ticker: string, notes: string, token: string) {
  return requestJson('/watchlist/', { method: 'POST', token, body: JSON.stringify({ ticker, notes }) });
}

export async function removeFromWatchlist(ticker: string, token: string) {
  return requestJson(`/watchlist/${ticker}`, { method: 'DELETE', token });
}

export async function fetchAlerts(token: string) {
  return requestJson<Array<{ id: string; ticker: string; condition: string; threshold: number; active: boolean; triggered: boolean }>>(
    '/watchlist/alerts', { token },
  );
}

export async function createAlert(ticker: string, condition: string, threshold: number, token: string) {
  return requestJson('/watchlist/alerts', { method: 'POST', token, body: JSON.stringify({ ticker, condition, threshold }) });
}

export async function deleteAlert(alertId: string, token: string) {
  return requestJson(`/watchlist/alerts/${alertId}`, { method: 'DELETE', token });
}
