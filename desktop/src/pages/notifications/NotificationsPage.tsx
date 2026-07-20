const items = [
  {
    id: 'n1',
    title: 'Task assigned',
    body: 'Karan assigned you “Review PR: idle detection”.',
    time: '12m ago',
  },
  {
    id: 'n2',
    title: 'Mentioned in comment',
    body: 'Neha mentioned you on “Wire invite email template”.',
    time: '1h ago',
  },
  {
    id: 'n3',
    title: 'Due soon',
    body: '“Fix attendance timezone edge case” is due tomorrow.',
    time: '3h ago',
  },
];

export function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-ink-50">Notifications</h1>
      <p className="mt-2 text-sm text-ink-300">In-app feed — OS toasts come from the tray agent.</p>

      <div className="mt-8 space-y-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-50">{item.title}</p>
                <p className="mt-1 text-sm text-ink-300">{item.body}</p>
              </div>
              <span className="shrink-0 text-xs text-ink-400">{item.time}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
