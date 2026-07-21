import { apiFetch } from './client';

export type NotificationType =
  | 'task.assigned'
  | 'task.commented'
  | 'message.new'
  | 'project.added'
  | 'project.invited'
  | 'team.added';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  actorId: string | null;
  actorName: string;
  projectId: string | null;
  taskId: string | null;
  conversationId: string | null;
  messageId: string | null;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export async function listNotifications(opts?: {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.unreadOnly) params.set('unreadOnly', '1');
  const qs = params.toString();
  return apiFetch<{
    notifications: AppNotification[];
    nextCursor: string | null;
    unreadCount: number;
  }>(`/api/notifications${qs ? `?${qs}` : ''}`);
}

export async function getNotification(id: string) {
  return apiFetch<{ notification: AppNotification }>(`/api/notifications/${id}`);
}

export async function getUnreadCount() {
  return apiFetch<{ count: number }>('/api/notifications/unread-count');
}

export async function markNotificationsRead(ids: string[]) {
  return apiFetch<{ updated: number; unreadCount: number }>('/api/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function markAllNotificationsRead() {
  return apiFetch<{ updated: number; unreadCount: number }>('/api/notifications/read-all', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function deleteNotification(id: string) {
  return apiFetch<{ ok: boolean; unreadCount: number }>(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
}
