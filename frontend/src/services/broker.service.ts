import { requestJson } from './http';

export async function fetchBrokerAccounts(token: string) {
  return requestJson<Array<{
    id: string | null; broker: string; status: string;
    access_mode: string; holdings_synced: number;
    last_sync_at: string | null; message: string;
  }>>('/broker/connected', { token });
}

export async function connectBroker(broker: string, token: string) {
  return requestJson('/broker/connect', { method: 'POST', token, body: JSON.stringify({ broker }) });
}

export async function fetchBrokerOrders(token: string) {
  return requestJson<Record<string, unknown>[]>('/broker/orders', { token });
}
