import { requestJson } from './http';

export async function fetchSubscription(token: string) {
  return requestJson<{
    plan: string; status: string;
    billing_provider: string; payments_configured: boolean;
  }>('/subscriptions/me', { token });
}
