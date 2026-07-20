import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  getOrgActivityByDate,
  type ActivitySession,
  type AppUsage,
  type AwayPeriod,
  type MemberActivity,
  type SiteUsage,
} from '@/lib/api/activity';
import { cn } from '@/lib/cn';

function sitesFromMember(m: MemberActivity): SiteUsage[] {
  if (m.sites && m.sites.length > 0) return m.sites;
  const byHost = new Map<string, SiteUsage>();
  for (const s of m.sessions) {
    for (const site of s.sites ?? []) {
      const key = site.host.toLowerCase();
      const prev = byHost.get(key);
      if (prev) {
        prev.durationMs += site.durationMs;
        if (site.url) prev.url = site.url;
        if (site.title) prev.title = site.title;
      } else {
        byHost.set(key, { ...site });
      }
    }
  }
  return [...byHost.values()].sort((a, b) => b.durationMs - a.durationMs);
}

function appsFromMember(m: MemberActivity): AppUsage[] {
  if (m.apps && m.apps.length > 0) return m.apps;
  const byApp = new Map<string, AppUsage>();
  for (const s of m.sessions) {
    for (const a of s.apps ?? []) {
      const key = a.appName.toLowerCase();
      const prev = byApp.get(key);
      if (prev) {
        prev.durationMs += a.durationMs;
        if (a.lastWindowTitle) prev.lastWindowTitle = a.lastWindowTitle;
      } else {
        byApp.set(key, { ...a });
      }
    }
  }
  return [...byApp.values()].sort((a, b) => b.durationMs - a.durationMs);
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatClock(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function formatDateLabel(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function sessionSpanMs(session: ActivitySession) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  return Math.max(0, end - start);
}

const CHART_COLORS = [
  '#5865F2',
  '#0369a1',
  '#b45309',
  '#be123c',
  '#4f46e5',
  '#059669',
  '#c2410c',
  '#7c3aed',
  '#0e7490',
  '#94a3b8',
];

function awayLabel(kind: AwayPeriod['kind']) {
  switch (kind) {
    case 'locked':
      return 'Locked';
    case 'sleep':
      return 'Sleep';
    case 'lid_closed':
      return 'Lid closed';
    default:
      return 'Away';
  }
}

function Donut({
  slices,
  centerValue,
}: {
  slices: { label: string; value: number; color: string }[];
  centerValue: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 48;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative mx-auto h-[132px] w-[132px] shrink-0 sm:mx-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="16" />
          {slices.map((slice) => {
            const len = (slice.value / total) * c;
            const el = (
              <circle
                key={slice.label}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold tabular-nums text-ink-50">{centerValue}</p>
          <p className="text-[10px] text-ink-400">total</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((s) => {
          const pct = Math.round((s.value / total) * 100);
          return (
            <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="truncate font-medium text-ink-100">{s.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-300">
                <span className="font-semibold text-ink-100">{formatDuration(s.value)}</span>
                <span className="ml-1.5 text-[10px]">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UsageList({
  rows,
  empty,
  barColor,
}: {
  rows: { key: string; label: string; sub?: string; value: number }[];
  empty: string;
  barColor: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-400">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.slice(0, 8).map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink-50">{row.label}</p>
              {row.sub ? (
                <p className="truncate text-[10px] text-ink-400">{row.sub}</p>
              ) : null}
            </div>
            <span className="shrink-0 tabular-nums font-semibold text-ink-200">
              {formatDuration(row.value)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden bg-ink-700">
            <div
              className="h-full"
              style={{
                width: `${Math.max(4, (row.value / max) * 100)}%`,
                background: barColor,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminActivityPanel() {
  const [filterDate, setFilterDate] = useState(todayIso);
  const [members, setMembers] = useState<MemberActivity[]>([]);
  const [allApps, setAllApps] = useState<AppUsage[]>([]);
  const [allSites, setAllSites] = useState<SiteUsage[]>([]);
  const [orgTotal, setOrgTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | 'all'>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (date: string) => {
    setError('');
    try {
      const data = await getOrgActivityByDate(date);
      setMembers(data.members);
      setAllApps(data.allApps);
      setAllSites(data.allSites ?? []);
      setOrgTotal(data.totalTrackedMs);
      setSelectedId((prev) => {
        if (prev === 'all') return 'all';
        if (prev && data.members.some((m) => m.userId === prev)) return prev;
        return 'all';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelectedSessionId(null);
    void load(filterDate);
  }, [filterDate, load]);

  useEffect(() => {
    if (filterDate !== todayIso()) return;
    const id = window.setInterval(() => void load(filterDate), 15_000);
    return () => window.clearInterval(id);
  }, [filterDate, load]);

  const selected = useMemo(
    () => (selectedId === 'all' ? null : members.find((m) => m.userId === selectedId) ?? null),
    [members, selectedId],
  );

  const sessions = useMemo(() => {
    const list = selected
      ? selected.sessions
      : members.flatMap((m) => m.sessions.map((s) => ({ ...s, _memberId: m.userId })));
    return [...list].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, [selected, members]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    if (selected) return selected.sessions.find((s) => s.id === selectedSessionId) ?? null;
    for (const m of members) {
      const found = m.sessions.find((s) => s.id === selectedSessionId);
      if (found) return found;
    }
    return null;
  }, [selectedSessionId, selected, members]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const exists = selected
      ? selected.sessions.some((s) => s.id === selectedSessionId)
      : members.some((m) => m.sessions.some((s) => s.id === selectedSessionId));
    if (!exists) setSelectedSessionId(null);
  }, [selected, members, selectedSessionId]);

  const detailApps = useMemo(() => {
    if (selectedSession) return selectedSession.apps;
    if (selected) return appsFromMember(selected);
    return allApps;
  }, [selectedSession, selected, allApps]);

  const detailSites = useMemo(() => {
    if (selectedSession) return selectedSession.sites ?? [];
    if (selected) return sitesFromMember(selected);
    return allSites;
  }, [selectedSession, selected, allSites]);

  const detailAway = useMemo(() => {
    if (selectedSession) return selectedSession.awayPeriods ?? [];
    if (selected) return selected.sessions.flatMap((s) => s.awayPeriods ?? []);
    return members.flatMap((m) => m.sessions.flatMap((s) => s.awayPeriods ?? []));
  }, [selectedSession, selected, members]);

  const scopedTracked = selectedSession
    ? selectedSession.totalTrackedMs
    : selected
      ? selected.totalTrackedMs
      : orgTotal;
  const scopedAway = detailAway.reduce((s, p) => s + p.durationMs, 0);
  const liveCount = members.filter((m) => m.tracking).length;
  const scopeName = selectedSession
    ? 'Selected session'
    : selected
      ? selected.name
      : 'Everyone';

  const appSlices = useMemo(() => {
    const sorted = [...detailApps].sort((a, b) => b.durationMs - a.durationMs);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((s, a) => s + a.durationMs, 0);
    const slices = top.map((a, i) => ({
      label: a.appName,
      value: a.durationMs,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    if (rest > 0) slices.push({ label: 'Other', value: rest, color: '#94a3b8' });
    return slices.filter((s) => s.value > 0);
  }, [detailApps]);

  const userOptions = useMemo(
    () => [
      { value: 'all', label: 'Everyone' },
      ...members.map((m) => ({
        value: m.userId,
        label: m.tracking ? `${m.name} (live)` : m.name,
      })),
    ],
    [members],
  );

  function selectMember(id: string | 'all') {
    setSelectedId(id);
    setSelectedSessionId(null);
  }

  function memberForSession(session: ActivitySession) {
    return members.find((m) => m.sessions.some((s) => s.id === session.id));
  }

  if (loading && members.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-800 text-sm text-ink-400">
        Loading activity…
      </div>
    );
  }

  const checkInCount = selected
    ? selected.sessions.length
    : members.reduce((n, m) => n + m.sessions.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-800">
      {/* Sticky toolbar */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-ink-600 px-4 py-2.5 md:px-5">
        <div>
          <h2 className="text-sm font-semibold text-ink-50">Activity</h2>
          <p className="text-[11px] text-ink-300">
            {formatDateLabel(filterDate)} · each panel scrolls on its own
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <div className="min-w-0 w-full flex-1 basis-full sm:basis-auto sm:w-[200px] sm:flex-none">
            <p className="mb-1 text-[10px] font-bold tracking-wide text-ink-400 uppercase">
              Person
            </p>
            <Select
              size="sm"
              value={selectedId}
              onChange={(v) => selectMember(v as string | 'all')}
              options={userOptions}
              aria-label="Select person"
            />
          </div>
          <div className="w-full min-w-0 sm:w-[170px]">
            <p className="mb-1 text-[10px] font-bold tracking-wide text-ink-400 uppercase">
              Date
            </p>
            <DatePicker value={filterDate} onChange={setFilterDate} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-[#ed4245]/25 bg-[#ed4245]/10 px-4 py-2 text-[11px] text-[#ed4245]">
          {error}
        </div>
      ) : null}

      {/* Dashboard grid — no page scroll; panes scroll independently */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[200px_1fr]">
        {/* Team pane */}
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-ink-600 lg:border-r lg:border-b-0">
          <div className="shrink-0 border-b border-ink-700 px-3 py-2">
            <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">Team</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => selectMember('all')}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs',
                selectedId === 'all'
                  ? 'bg-brand-500 text-white'
                  : 'text-ink-200 hover:bg-ink-700',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center text-[10px] font-bold',
                  selectedId === 'all'
                    ? 'bg-white/15 text-white'
                    : 'bg-ink-700 text-ink-200',
                )}
              >
                All
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">Everyone</span>
                <span
                  className={cn(
                    'block text-[11px]',
                    selectedId === 'all' ? 'text-white/60' : 'text-ink-300',
                  )}
                >
                  {formatDuration(orgTotal)} · {liveCount} live
                </span>
              </span>
            </button>

            {members.map((m) => {
              const active = m.userId === selectedId;
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => selectMember(m.userId)}
                  className={cn(
                    'flex w-full items-center gap-2.5 border-t border-ink-700 px-3 py-2.5 text-left',
                    active ? 'bg-brand-500/10' : 'hover:bg-ink-700',
                  )}
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      name={m.name}
                      src={m.avatarUrl}
                      seed={m.email || m.name}
                      size="md"
                    />
                    {m.tracking ? (
                      <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-800 bg-[#23a559]" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink-50">
                      {m.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-300">
                      {formatDuration(m.totalTrackedMs)}
                      {m.sessions.length > 0 ? ` · ${m.sessions.length} in` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main dashboard */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          {/* KPIs — fixed */}
          <section className="grid shrink-0 grid-cols-3 border-b border-ink-600">
            {[
              { label: 'Tracked', value: formatDuration(scopedTracked), hint: scopeName },
              {
                label: 'Check-ins',
                value: String(checkInCount),
                hint: selectedSession ? '1 selected' : 'this day',
              },
              {
                label: 'Away',
                value: formatDuration(scopedAway),
                hint: `${detailAway.length} gaps`,
              },
            ].map((k, i) => (
              <div
                key={k.label}
                className={cn('px-4 py-2.5', i < 2 && 'border-r border-ink-700')}
              >
                <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                  {k.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink-50">
                  {k.value}
                </p>
                <p className="truncate text-[11px] text-ink-300">{k.hint}</p>
              </div>
            ))}
          </section>

          {selectedSession ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-brand-500/25 bg-brand-500/10 px-4 py-1.5">
              <p className="text-[12px] text-brand-200">
                Session{' '}
                <span className="font-semibold">
                  {formatClock(selectedSession.startedAt)} →{' '}
                  {selectedSession.status === 'active'
                    ? 'now'
                    : formatClock(selectedSession.endedAt)}
                </span>
              </p>
              <button
                type="button"
                className="text-[11px] font-semibold text-brand-300 hover:underline"
                onClick={() => setSelectedSessionId(null)}
              >
                Show full day
              </button>
            </div>
          ) : null}

          {/* Top: Apps | Websites — each scrolls alone */}
          <div
            key={`${selectedId}:${selectedSessionId ?? 'day'}`}
            className="grid min-h-0 flex-[1.1] grid-cols-1 overflow-hidden border-b border-ink-600 lg:grid-cols-2"
          >
            <section className="flex min-h-0 flex-col overflow-hidden border-b border-ink-600 lg:border-r lg:border-b-0">
              <div className="shrink-0 border-b border-ink-700 px-4 py-2">
                <h3 className="text-xs font-semibold text-ink-50">Software used</h3>
                <p className="text-[11px] text-ink-300">
                  App time (includes browsers). Primary tracked total.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {appSlices.length === 0 ? (
                  <p className="py-10 text-center text-xs text-ink-400">No apps yet</p>
                ) : (
                  <Donut
                    slices={appSlices}
                    centerValue={formatDuration(scopedTracked)}
                  />
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-ink-700 px-4 py-2">
                <h3 className="text-xs font-semibold text-ink-50">Websites used</h3>
                <p className="text-[11px] text-ink-300">
                  Site breakdown while browsing — subset of browser app time, not added on top
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <UsageList
                  barColor="#0369a1"
                  empty="No websites recorded"
                  rows={detailSites.map((s) => ({
                    key: s.host,
                    label: s.host,
                    sub: s.browserName || undefined,
                    value: s.durationMs,
                  }))}
                />
                {detailAway.length > 0 ? (
                  <div className="mt-5 border-t border-ink-700 pt-4">
                    <p className="mb-2 text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                      Lock / sleep
                    </p>
                    <ul className="space-y-1.5">
                      {detailAway.map((p, i) => (
                        <li
                          key={`${p.startedAt}-${i}`}
                          className="flex items-center justify-between gap-2 border border-ink-700 bg-ink-800/60 px-2.5 py-1.5 text-[11px]"
                        >
                          <span>
                            <span className="font-semibold text-ink-100">
                              {awayLabel(p.kind)}
                            </span>
                            <span className="ml-1.5 tabular-nums text-ink-300">
                              {formatClock(p.startedAt)}–{formatClock(p.endedAt)}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums text-ink-100">
                            {formatDuration(p.durationMs)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          {/* Bottom: Check-ins — own scroll, separate from rest */}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-ink-600 px-4 py-2">
              <h3 className="text-sm font-semibold text-ink-50">
                {selected ? `${selected.name}'s check-ins` : 'Check-ins'}
              </h3>
              <p className="text-[11px] text-ink-300">
                This list scrolls separately · click a row to filter apps & websites
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="px-4 py-12 text-center text-xs text-ink-400">
                  No check-ins on this date.
                </p>
              ) : (
                <ul>
                  {sessions.map((session, index) => {
                    const member = selected ?? memberForSession(session);
                    const isLive = session.status === 'active';
                    const active = session.id === selectedSessionId;
                    const n = selected
                      ? selected.sessions
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(a.startedAt).getTime() -
                              new Date(b.startedAt).getTime(),
                          )
                          .findIndex((s) => s.id === session.id) + 1
                      : index + 1;

                    return (
                      <li key={session.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selected && member) setSelectedId(member.userId);
                            setSelectedSessionId((prev) =>
                              prev === session.id ? null : session.id,
                            );
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 border-b border-ink-700 px-4 py-2.5 text-left transition-colors',
                            active ? 'bg-brand-500/10' : 'hover:bg-ink-700',
                          )}
                        >
                          {member ? (
                            <UserAvatar
                              name={member.name}
                              src={member.avatarUrl}
                              seed={member.email || member.name}
                              size="md"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {!selected && member ? (
                                <span className="text-xs font-semibold text-ink-50">
                                  {member.name}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-ink-50">
                                  Session {n}
                                </span>
                              )}
                              {isLive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#57f287]">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#23a559]" />
                                  Live
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-ink-400">Out</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[12px] tabular-nums text-ink-200">
                              <span className="font-semibold text-ink-50">
                                {formatClock(session.startedAt)}
                              </span>
                              <span className="mx-1 text-ink-300">→</span>
                              <span className="font-semibold text-ink-50">
                                {isLive ? 'now' : formatClock(session.endedAt)}
                              </span>
                              <span className="ml-2 text-ink-400">
                                {formatDuration(sessionSpanMs(session))} wall ·{' '}
                                {formatDuration(session.totalTrackedMs)} tracked
                              </span>
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 text-[11px] font-semibold',
                              active ? 'text-brand-300' : 'text-ink-400',
                            )}
                          >
                            {active ? 'Selected' : 'View'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
