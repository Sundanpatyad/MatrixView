import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBell } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import {
  useNotifications,
} from '@/lib/notifications/NotificationsContext';
import type { AppNotification } from '@/lib/api/notifications';

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function notificationHref(n: AppNotification): string {
  if (n.meta.href) return n.meta.href;
  if (n.type === 'message' && n.meta.conversationId) {
    return `/chat?c=${n.meta.conversationId}`;
  }
  if (n.meta.projectId) {
    const params = new URLSearchParams({ project: n.meta.projectId });
    if (n.meta.taskId) params.set('task', n.meta.taskId);
    return `/board?${params.toString()}`;
  }
  if (n.type === 'message') return '/chat';
  return '/board';
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function openNotification(n: AppNotification) {
    if (!n.readAt) void markRead(n.id);
    setOpen(false);
    navigate(notificationHref(n));
  }

  const badge =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Notifications"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-600 bg-ink-800 text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-700 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          open && 'border-ink-500 bg-ink-700 text-ink-50',
        )}
      >
        <IconBell className="h-4 w-4" />
        {badge ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-xl shadow-black/40"
        >
          <div className="flex items-center justify-between border-b border-ink-800 px-3 py-2.5">
            <p className="text-sm font-semibold text-ink-50">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-400">
                You’re all caught up
              </p>
            ) : (
              <ul className="py-1">
                {notifications.map((n) => {
                  const unread = !n.readAt;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className={cn(
                          'flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-800',
                          unread && 'bg-brand-500/5',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            unread ? 'bg-brand-500' : 'bg-transparent',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-50">
                            {n.title}
                          </span>
                          {n.body ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-ink-300">
                              {n.body}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[10px] text-ink-400">
                            {relativeTime(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
