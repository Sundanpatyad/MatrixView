import { apiFetch } from './client';
import type { AppNotification } from './types';

export function listNotifications(params: { limit?: number; cursor?: string; unreadOnly?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.unreadOnly) search.set('unreadOnly', '1');
  const query = search.toString();
  return apiFetch<{ notifications: AppNotification[]; nextCursor: string | null; unreadCount: number }>(
    `/api/notifications${query ? `?${query}` : ''}`,
    { auth: true },
  );
}

export function getUnreadCount() {
  return apiFetch<{ count: number }>('/api/notifications/unread-count', { auth: true });
}

export function markNotificationsRead(ids: string[]) {
  return apiFetch<{ updated: number; unreadCount: number }>('/api/notifications/read', {
    method: 'POST',
    body: { ids },
    auth: true,
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number; unreadCount: number }>('/api/notifications/read-all', {
    method: 'POST',
    auth: true,
  });
}

export function deleteNotification(id: string) {
  return apiFetch<{ ok: true; unreadCount: number }>(`/api/notifications/${id}`, { method: 'DELETE', auth: true });
}
