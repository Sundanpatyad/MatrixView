import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationRow } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/Button';
import { IconBell, IconCheck, IconTrash } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { NotificationType } from '@/lib/api/notifications';
import { useNotifications } from '@/lib/notifications/NotificationContext';

const FILTERS: { id: 'all' | 'unread' | NotificationType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'task.assigned', label: 'Tasks' },
  { id: 'message.new', label: 'Messages' },
  { id: 'project.added', label: 'Projects' },
  { id: 'team.added', label: 'Team' },
  { id: 'task.commented', label: 'Comments' },
];

export function NotificationsPage() {
  const {
    items,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markAllRead,
    markRead,
    remove,
    openNotification,
    refresh,
  } = useNotifications();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => !n.readAt);
    if (filter === 'project.added') {
      return items.filter((n) => n.type === 'project.added' || n.type === 'project.invited');
    }
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const selected = filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null;

  // Keep selection valid when filter/list changes
  useEffect(() => {
    if (!selected) {
      setSelectedId(null);
      return;
    }
    if (selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId]);

  // Opening / viewing a notification on the detail page marks it read + updates header count
  useEffect(() => {
    if (!selected || selected.readAt) return;
    void markRead([selected.id]);
  }, [selected?.id, selected?.readAt, markRead]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-700">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-600/70 bg-ink-800/80 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight text-ink-50">Notifications</h1>
          <p className="mt-0.5 text-[13px] text-ink-400">
            {unreadCount > 0
              ? `${unreadCount} unread · tasks, messages, and project updates`
              : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
          >
            <IconCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-600/50 px-3 py-2 sm:px-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'h-8 shrink-0 rounded-lg px-3 text-[12px] font-medium transition',
              filter === f.id
                ? 'bg-ink-600 text-ink-50'
                : 'text-ink-400 hover:bg-ink-700/70 hover:text-ink-100',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-h-0 overflow-y-auto border-b border-ink-600/60 lg:border-r lg:border-b-0">
          {loading && items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-800 text-ink-400">
                <IconBell className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-ink-200">Nothing here</p>
              <p className="max-w-xs text-xs text-ink-400">
                You’ll get notified for task assigns, comments, messages, and project invites.
              </p>
            </div>
          ) : (
            <>
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'border-b border-ink-700/80',
                    selected?.id === n.id && 'bg-ink-800/80',
                  )}
                >
                  <NotificationRow
                    item={n}
                    onOpen={(item) => {
                      setSelectedId(item.id);
                      if (!item.readAt) void markRead([item.id]);
                    }}
                  />
                </div>
              ))}
              {hasMore ? (
                <div className="p-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => void loadMore()}
                  >
                    Load older
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className="hidden min-h-0 overflow-y-auto lg:block">
          {selected ? (
            <div className="flex h-full flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                    {selected.type.replace('.', ' · ')}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-ink-50">{selected.title}</h2>
                  <p className="mt-1 text-xs text-ink-400">
                    {selected.actorName ? `${selected.actorName} · ` : ''}
                    {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => void remove(selected.id)}
                  className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-700 hover:text-ink-50"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-ink-200">
                {selected.body || 'No additional details.'}
              </p>

              {Object.keys(selected.meta ?? {}).length > 0 ? (
                <dl className="mt-6 space-y-2 rounded-xl bg-ink-800/70 p-4 text-sm">
                  {Object.entries(selected.meta).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt className="capitalize text-ink-400">{key.replace(/([A-Z])/g, ' $1')}</dt>
                      <dd className="truncate font-medium text-ink-100">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-8">
                <Button type="button" onClick={() => void openNotification(selected)}>
                  Open
                </Button>
                {!selected.readAt ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void markRead([selected.id])}
                  >
                    Mark read
                  </Button>
                ) : null}
                <Link to={selected.href} className="inline-flex">
                  <Button type="button" variant="ghost">
                    Deep link
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-ink-400">
              Select a notification to see details
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
