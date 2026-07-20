import { apiFetch } from './client';

export type NotificationType =
  | 'message'
  | 'task_assigned'
  | 'project_invite'
  | 'task_comment';

export type AppNotification = {
  id: string;
  orgId: string;
  recipientId: string;
  actorId: string | null;
  actorName: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  meta: {
    projectId: string | null;
    taskId: string | null;
    taskKey: string | null;
    conversationId: string | null;
    messageId: string | null;
    commentId: string | null;
    href: string | null;
  };
};

export function fetchNotifications(opts?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const params = new URLSearchParams();
  if (opts?.unreadOnly) params.set('unread', '1');
  if (opts?.limit) params.set('limit', String(opts.limit));
  const q = params.toString();
  return apiFetch(`/api/notifications${q ? `?${q}` : ''}`, { auth: true });
}

export function fetchUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetch('/api/notifications/unread-count', { auth: true });
}

export function markNotificationReadRequest(
  id: string,
): Promise<{ notification: AppNotification }> {
  return apiFetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({}),
  });
}

export function markAllNotificationsReadRequest(): Promise<{
  ok: boolean;
  modified: number;
}> {
  return apiFetch('/api/notifications/read-all', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}
