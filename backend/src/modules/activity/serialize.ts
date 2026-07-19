import { isExcludedApp } from './exclude.js';
import type { ActivitySessionDoc } from './models/ActivitySession.js';

function iso(d: Date | string | null | undefined) {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.toISOString();
}

export function serializeSession(doc: ActivitySessionDoc) {
  const apps = [...(doc.apps ?? [])]
    .filter(
      (a) =>
        !isExcludedApp(a.appName, a.processName ?? '', a.lastWindowTitle ?? ''),
    )
    .map((a) => ({
      appName: a.appName,
      processName: a.processName ?? '',
      durationMs: a.durationMs ?? 0,
      lastWindowTitle: a.lastWindowTitle ?? '',
      lastSeenAt: iso(a.lastSeenAt) ?? '',
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const sites = [...(doc.sites ?? [])]
    .map((s) => ({
      host: s.host,
      url: s.url ?? '',
      title: s.title ?? '',
      browserName: s.browserName ?? '',
      durationMs: s.durationMs ?? 0,
      lastSeenAt: iso(s.lastSeenAt) ?? '',
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const awayPeriods = [...(doc.awayPeriods ?? [])]
    .map((p) => ({
      kind: p.kind as 'locked' | 'sleep' | 'lid_closed' | 'away',
      startedAt: iso(p.startedAt)!,
      endedAt: iso(p.endedAt)!,
      durationMs: p.durationMs ?? 0,
    }))
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
    totalTrackedMs,
    totalAwayMs,
    apps,
    sites,
    awayPeriods,
  };
}
