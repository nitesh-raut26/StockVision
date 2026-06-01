/**
 * lib/services/brokerService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Broker connections and CA client portal.
 * Endpoint prefixes: /broker, /ca
 */

import { requestJson } from '../core';

// ── Broker accounts ───────────────────────────────────────────────────────────

export async function fetchBrokerAccounts(token?: string | null) {
  if (!token) return null;
  try {
    return await requestJson<
      Array<{
        id: string | null;
        broker: string;
        status: string;
        access_mode: string;
        holdings_synced: number;
        last_sync_at: string | null;
        message: string;
      }>
    >('/broker/connected', { token });
  } catch {
    return null;
  }
}

export async function connectBroker(broker: string, token?: string | null) {
  return requestJson('/broker/connect', {
    method: 'POST',
    token,
    body: JSON.stringify({ broker }),
  });
}

// ── CA portal ─────────────────────────────────────────────────────────────────

export async function fetchCaClients(token?: string | null) {
  if (!token) return null;
  try {
    return await requestJson<
      Array<{
        id: string;
        name: string;
        pan: string;
        email?: string | null;
        filing_status: 'PENDING' | 'IN_PROGRESS' | 'FILED' | 'OVERDUE';
        tax_year: string;
        total_gains: number;
        total_tax: number;
        last_updated: string;
      }>
    >('/ca/clients', { token });
  } catch {
    return null;
  }
}
