const BASE_URL = 'https://stockvision.com/v1';

export interface RequestOptions extends RequestInit {
  token?: string | null;
}

export function buildHeaders(token?: string | null, headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  if (!merged.has('Content-Type')) merged.set('Content-Type', 'application/json');
  if (token) merged.set('Authorization', `Bearer ${token}`);
  return merged;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...init } = options;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(token, init.headers),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
