/**
 * useBackendHealth — lightweight liveness probe for the FastAPI backend.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pings `GET {API_ROOT}/health` on an interval. While the backend is unreachable
 * (dependencies not installed, server not started, DB down, etc.) the app runs in
 * Demo Mode with mock data. As soon as the probe succeeds every <SystemStatus />
 * badge flips to a green "Live" indicator automatically — no reload required.
 *
 * One shared React-Query key means N badges trigger only ONE network ping.
 */
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/core';

// API_BASE_URL is e.g. "http://localhost:8000/api/v1" — /health is mounted at the
// application root (see backend/app/main.py), not under the versioned API prefix.
export const HEALTH_URL = `${API_BASE_URL.replace(/\/api\/v\d+$/, '')}/health`;

export type BackendStatus = 'checking' | 'live' | 'down';

export interface BackendHealth {
  status: BackendStatus;
  version?: string;
  env?: string;
}

interface HealthPayload {
  status: string;
  version?: string;
  env?: string;
}

async function pingHealth(): Promise<HealthPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET', signal: controller.signal });
    if (!res.ok) throw new Error(`health check failed: ${res.status}`);
    const body = (await res.json()) as HealthPayload;
    // Signature guard: the StockVision /health endpoint always reports a `version`
    // (see backend/app/main.py). If it's absent, some *other* service is occupying
    // the port — treat that as "backend unavailable" rather than a false "Live".
    if (typeof body.version !== 'string') {
      throw new Error('unrecognized /health payload — not the StockVision backend');
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function useBackendHealth(): BackendHealth {
  const query = useQuery({
    queryKey: ['backend-health'],
    queryFn: pingHealth,
    // Poll faster while down so the UI recovers to "Live" within ~15s of the
    // backend coming up; back off to 60s once we have a healthy connection.
    refetchInterval: (q) => (q.state.status === 'success' ? 60_000 : 15_000),
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 10_000,
    gcTime: Infinity,
  });

  if (query.isSuccess) {
    return { status: 'live', version: query.data?.version, env: query.data?.env };
  }
  if (query.isError) {
    return { status: 'down' };
  }
  return { status: 'checking' };
}
