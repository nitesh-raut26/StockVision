/**
 * lib/services/notificationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app notifications — list, mark-read, dismiss (DB-backed, auth required).
 * Endpoint prefix: /notifications
 *
 * Read calls return `null` when there is no auth token or the API is
 * unreachable, so callers can fall back to local/demo content. Mutations are
 * best-effort and never throw.
 */

import { API_BASE_URL, buildHeaders, requestJson } from '../core';

export interface ApiNotification {
  id:    string;
  type:  string;
  title: string;
  body:  string;
  read:  boolean;
  ts:    string;
}

async function sendNoContent(path: string, method: string, token: string) {
  try {
    await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: buildHeaders(token),
    });
  } catch {
    /* best-effort — UI already updated optimistically */
  }
}

export async function fetchNotifications(token?: string | null): Promise<ApiNotification[] | null> {
  if (!token) return null;
  try {
    return await requestJson<ApiNotification[]>('/notifications', { token });
  } catch {
    return null;
  }
}

export async function markAllNotificationsRead(token?: string | null) {
  if (!token) return;
  await sendNoContent('/notifications/read-all', 'POST', token);
}

export async function markNotificationRead(id: string, token?: string | null) {
  if (!token) return;
  await sendNoContent(`/notifications/${id}/read`, 'PATCH', token);
}

export async function dismissNotification(id: string, token?: string | null) {
  if (!token) return;
  await sendNoContent(`/notifications/${id}`, 'DELETE', token);
}
