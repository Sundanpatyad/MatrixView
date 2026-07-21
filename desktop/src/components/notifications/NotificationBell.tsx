import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconBell, IconCheck } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { AppNotification, NotificationType } from '@/lib/api/notifications';
import { useNotifications } from '@/lib/notifications/NotificationContext';

function formatRelative(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function typeAccent(type: NotificationType) {
  switch (type) {
    case 'task.assigned':
      return 'bg-[#5865f2]/15 text-[#5865f2]';
    case 'task.commented':
      return 'bg-[#00a8fc]/15 text-[#00a8fc]';
    case 'message.new':
      return 'bg-[#23a559]/15 text-[#23a559]';
    case 'project.added':
    case 'project.invited':
      return 'bg-[#f0b232]/15 text-[#f0b232]';
    case 'team.added':
      return 'bg-[#eb459e]/15 text-[#eb459e]';
    default:
      return 'bg-ink-700 text-ink-300';
  }
}

function typeLabel(type: NotificationType) {
  switch (type) {
    case 'task.assigned':
      return 'Task';
    case 'task.commented':
      return 'Comment';
    case 'message.new':
      return 'Message';
    case 'project.added':
      return 'Project';
    case 'project.invited':
      return 'Invite';
    case 'team.added':
      return 'Team';
    default:
      return 'Update';
  }
}

export function NotificationRow({
  item,
  onOpen,
  dense,
}: {
  item: AppNotification;
  onOpen: (n: AppNotification) => void;
  dense?: boolean;
}) {
  const unread = !item.readAt;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full gap-3 text-left transition-colors',
        dense ? 'px-3 py-2.5' : 'px-4 py-3',
        unread ? 'bg-brand-500/5' : 'hover:bg-ink-700/60',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase',
          typeAccent(item.type),
        )}
      >
        {typeLabel(item.type).slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'truncate text-[13px]',
              unread ? 'font-semibold text-ink-50' : 'font-medium text-ink-100',
            )}
          >
            {item.title}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-ink-400">
            {formatRelative(item.createdAt)}
          </span>
        </span>
        {item.body ? (
          <span className="mt-0.5 line-clamp-2 text-[12px] text-ink-400">{item.body}</span>
        ) : null}
      </span>
      {unread ? (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
      ) : (
        <span className="mt-2 h-2 w-2 shrink-0" aria-hidden />
      )}
    </button>
  );
}

export function NotificationBell() {
  const { items, unreadCount, markAllRead, openNotification, refresh } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, refresh]);

  const preview = items.slice(0, 8);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        title="Notifications"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-50',
          open && 'bg-ink-700 text-ink-50',
        )}
      >
        <IconBell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-ink-600 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-ink-50">Notifications</p>
              <p className="text-[11px] text-ink-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-ink-300 transition hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40"
              title="Mark all as read"
            >
              <IconCheck className="h-3.5 w-3.5" />
              Mark all
            </button>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {preview.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-400">No notifications yet</p>
            ) : (
              preview.map((n) => (
                <NotificationRow
                  key={n.id}
                  item={n}
                  dense
                  onOpen={(item) => {
                    setOpen(false);
                    void openNotification(item);
                  }}
                />
              ))
            )}
          </div>

          <div className="border-t border-ink-600 bg-ink-900/40 px-3 py-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-md py-1.5 text-center text-[12px] font-semibold text-brand-300 transition hover:bg-ink-700 hover:text-brand-200"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
