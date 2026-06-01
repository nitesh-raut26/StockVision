/**
 * lib/services/subscriptionService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Subscription plans, Razorpay checkout, and payment verification.
 * Endpoint prefix: /subscriptions
 */

import { requestJson } from '../core';

export async function fetchSubscription(token?: string | null) {
  if (!token) return null;
  try {
    return await requestJson<{
      plan: string;
      status: string;
      billing_provider: string;
      payments_configured: boolean;
    }>('/subscriptions/me', { token });
  } catch {
    return null;
  }
}

export async function createCheckoutSession(
  planId: 'premium' | 'pro' | 'enterprise',
  billingCycle: 'monthly' | 'yearly',
  token?: string | null,
) {
  return requestJson<{
    key_id: string;
    order_id: string;
    amount: number;       // paise
    currency: string;
    plan_id: string;
    plan_name: string;
    billing_cycle: string;
    prefill: { name: string; email: string };
  }>('/subscriptions/checkout', {
    method: 'POST',
    token,
    body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
  });
}

export async function verifyPayment(
  payload: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    plan_id: string;
  },
  token?: string | null,
) {
  return requestJson<{ plan: string; status: string }>('/subscriptions/verify-payment', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function cancelSubscription(token?: string | null) {
  return requestJson<{ plan: string; message: string }>('/subscriptions/cancel', {
    method: 'POST',
    token,
  });
}
