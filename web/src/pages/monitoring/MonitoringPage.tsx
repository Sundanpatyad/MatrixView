import { Badge } from '@/components/ui/Badge';
import { mockLive, type LiveEmployee } from '@/data/mockMonitoring';

const tone: Record<LiveEmployee['status'], 'success' | 'warning' | 'neutral' | 'brand'> = {
  active: 'success',
  idle: 'warning',
  offline: 'neutral',
  break: 'brand',
};

function formatMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function MonitoringPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Monitoring</h1>
        <p className="mt-2 text-sm text-ink-500">
          Live view of desktop signals — managers only. Desktop never shows others&apos; data.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {mockLive.map((person) => (
          <article
            key={person.id}
            className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-ink-900">{person.name}</h2>
                <Badge tone={tone[person.status]}>{person.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-500">
                App: <span className="font-medium text-ink-700">{person.app}</span>
                {' · '}
                Task: <span className="font-medium text-ink-700">{person.task}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Today
              </p>
              <p className="font-display text-2xl font-semibold text-ink-900">
                {formatMins(person.todayMins)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
