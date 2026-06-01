/**
 * lib/services/ipoService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IPO tracker — open, upcoming, listed, and SME issues.
 * Endpoint prefix: /ipo
 */

import { requestJson } from '../core';

export async function fetchOpenIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/open');
  } catch {
    return null;
  }
}

export async function fetchUpcomingIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/upcoming');
  } catch {
    return null;
  }
}

export async function fetchListedIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/listed');
  } catch {
    return null;
  }
}

export async function fetchSMEIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/sme');
  } catch {
    return null;
  }
}
