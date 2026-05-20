import { requestJson } from './http';

export async function fetchCaClients(token: string) {
  return requestJson<Array<{
    id: string; name: string; pan: string; email?: string | null;
    filing_status: 'PENDING' | 'IN_PROGRESS' | 'FILED' | 'OVERDUE';
    tax_year: string; total_gains: number; total_tax: number; last_updated: string;
  }>>('/ca/clients', { token });
}
