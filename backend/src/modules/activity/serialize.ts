import { isExcludedApp } from './exclude.js';
import { MAX_SESSION_DURATION_MS } from './constants.js';

function iso(d: Date | string | null | undefined) {
  if (!d) return null;
  if (typeof d === 'string') return d;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}

function autoCheckoutIso(startedAt: Date | string | null | undefined) {
  const started = iso(startedAt);
  if (!started) return null;
  const t = new Date(started).getTime();
  return Number.isFinite(t) ? new Date(t + MAX_SESSION_DURATION_MS).toISOString() : null;
}

type SessionLike = {
  _id: unknown;
  userId: unknown;
  orgId: unknown;
  status: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  apps?: {
    appName?: string | null;
    processName?: string | null;
    durationMs?: number | null;
    lastWindowTitle?: string | null;
    lastSeenAt?: Date | string | null;
  }[];
  sites?: {
    host?: string | null;
    url?: string | null;
    title?: string | null;
    browserName?: string | null;
    durationMs?: number | null;
    lastSeenAt?: Date | string | null;
  }[];
  awayPeriods?: {
    kind?: string;
    startedAt?: Date | string | null;
    endedAt?: Date | string | null;
    durationMs?: number | null;
  }[];
};

export function serializeSession(doc: SessionLike) {
  const apps = [...(doc.apps ?? [])]
    .filter(
      (a) =>
        Boolean(a?.appName) &&
        !isExcludedApp(a.appName, a.processName ?? '', a.lastWindowTitle ?? ''),
    )
    .map((a) => ({
      appName: a.appName as string,
      processName: a.processName ?? '',
      durationMs: a.durationMs ?? 0,
      lastWindowTitle: a.lastWindowTitle ?? '',
      lastSeenAt: iso(a.lastSeenAt) ?? '',
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const sites = [...(doc.sites ?? [])]
    .filter((s) => Boolean(s?.host))
    .map((s) => ({
      host: s.host as string,
      url: s.url ?? '',
      title: s.title ?? '',
      browserName: s.browserName ?? '',
      durationMs: s.durationMs ?? 0,
      lastSeenAt: iso(s.lastSeenAt) ?? '',
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const awayPeriods = [...(doc.awayPeriods ?? [])]
    .map((p) => {
      const startedAt = iso(p.startedAt);
      const endedAt = iso(p.endedAt);
      if (!startedAt || !endedAt) return null;
      return {
        kind: (p.kind ?? 'away') as 'locked' | 'sleep' | 'lid_closed' | 'away',
        startedAt,
        endedAt,
        durationMs: p.durationMs ?? 0,
      };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const totalTrackedMs = apps.reduce((s, a) => s + a.durationMs, 0);
  const totalAwayMs = awayPeriods.reduce((s, p) => s + p.durationMs, 0);

  return {
    id: String(doc._id),
    userId: String(doc.userId),
    orgId: String(doc.orgId),
    status: doc.status,
    startedAt: iso(doc.startedAt)!,
    endedAt: iso(doc.endedAt),
    autoCheckoutAt: autoCheckoutIso(doc.startedAt),
    totalTrackedMs,
    totalAwayMs,
    apps,
    sites,
    awayPeriods,
  };
}
