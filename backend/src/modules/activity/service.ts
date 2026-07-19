import { Types } from 'mongoose';
import { emitPresenceUpdate } from '../../gateway/io.js';
import { AuthError } from '../auth/errors.js';
import { User } from '../auth/models/User.js';
import { isExcludedApp } from './exclude.js';
import { ActivitySession } from './models/ActivitySession.js';
import { serializeSession } from './serialize.js';

type Actor = { sub: string; orgId: string; role?: string };

const MAX_APP_SAMPLE_MS = 120_000;
const MAX_AWAY_SAMPLE_MS = 12 * 60 * 60 * 1000;

export type ActivitySampleInput = {
  kind?: 'app' | 'site' | 'away';
  appName?: string;
  processName?: string;
  windowTitle?: string;
  url?: string;
  host?: string;
  durationMs: number;
  awayKind?: 'locked' | 'sleep' | 'lid_closed' | 'away';
  startedAt?: string;
  endedAt?: string;
};

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, '') || url;
  } catch {
    return url.replace(/^https?:\/\//i, '').split('/')[0] || url;
  }
}

export async function startSession(actor: Actor) {
  await ActivitySession.updateMany(
    { userId: actor.sub, orgId: actor.orgId, status: 'active' },
    { $set: { status: 'closed', endedAt: new Date() } },
  );

  const session = await ActivitySession.create({
    orgId: actor.orgId,
    userId: actor.sub,
    status: 'active',
    startedAt: new Date(),
    apps: [],
    sites: [],
    awayPeriods: [],
  });

  emitPresenceUpdate(actor.orgId, { userId: actor.sub, checkedIn: true });
  return serializeSession(session);
}

export async function getCurrentSession(actor: Actor) {
  const session = await ActivitySession.findOne({
    userId: actor.sub,
    orgId: actor.orgId,
    status: 'active',
  }).sort({ startedAt: -1 });
  return session ? serializeSession(session) : null;
}

/** Attendance status from DB — active session means checked in. */
export async function getAttendanceStatus(actor: Actor) {
  const session = await getCurrentSession(actor);
  const checkedIn = Boolean(session && session.status === 'active');

  // Latest closed session today (for UI when checked out)
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const lastClosed = await ActivitySession.findOne({
    userId: actor.sub,
    orgId: actor.orgId,
    status: 'closed',
    startedAt: { $gte: start },
  }).sort({ endedAt: -1, startedAt: -1 });

  return {
    checkedIn,
    session,
    checkInAt: checkedIn ? session!.startedAt : null,
    checkOutAt: checkedIn
      ? null
      : lastClosed?.endedAt
        ? lastClosed.endedAt instanceof Date
          ? lastClosed.endedAt.toISOString()
          : String(lastClosed.endedAt)
        : null,
    lastSession: lastClosed ? serializeSession(lastClosed) : null,
  };
}

export async function ingestSamples(
  actor: Actor,
  sessionId: string,
  samples: ActivitySampleInput[],
) {
  if (!Types.ObjectId.isValid(sessionId)) {
    throw new AuthError('Session not found', 404, 'NOT_FOUND');
  }

  const session = await ActivitySession.findOne({
    _id: sessionId,
    userId: actor.sub,
    orgId: actor.orgId,
    status: 'active',
  });
  if (!session) throw new AuthError('No active tracking session', 404, 'NOT_FOUND');

  for (const sample of samples) {
    const kind = sample.kind ?? 'app';

    if (kind === 'away') {
      const startedAt = sample.startedAt ? new Date(sample.startedAt) : null;
      const endedAt = sample.endedAt ? new Date(sample.endedAt) : null;
      let durationMs = Math.max(0, Number(sample.durationMs) || 0);
      if (startedAt && endedAt && !Number.isNaN(+startedAt) && !Number.isNaN(+endedAt)) {
        durationMs = Math.max(durationMs, endedAt.getTime() - startedAt.getTime());
      }
      durationMs = Math.min(durationMs, MAX_AWAY_SAMPLE_MS);
      if (durationMs < 5_000 || !startedAt || !endedAt) continue;
      if (Number.isNaN(+startedAt) || Number.isNaN(+endedAt)) continue;

      const awayKind = sample.awayKind ?? 'away';
      // Merge overlapping / adjacent same-kind periods (within 30s)
      const awayList = session.awayPeriods ?? [];
      const last = awayList[awayList.length - 1];
      if (
        last &&
        last.kind === awayKind &&
        Math.abs(startedAt.getTime() - new Date(last.endedAt).getTime()) < 30_000
      ) {
        last.endedAt = endedAt;
        last.durationMs =
          new Date(last.endedAt).getTime() - new Date(last.startedAt).getTime();
      } else {
        awayList.push({
          kind: awayKind,
          startedAt,
          endedAt,
          durationMs,
        });
      }
      session.awayPeriods = awayList;
      continue;
    }

    if (kind === 'site') {
      const url = sample.url?.trim() ?? '';
      const host = (sample.host?.trim() || (url ? hostFromUrl(url) : '')).toLowerCase();
      if (!host) continue;
      const durationMs = Math.max(0, Math.min(Number(sample.durationMs) || 0, MAX_APP_SAMPLE_MS));
      if (durationMs <= 0) continue;
      const browserName = sample.appName?.trim() ?? '';
      const title = sample.windowTitle?.trim() ?? '';

      const siteList = session.sites ?? [];
      const existing = siteList.find((s) => s.host.toLowerCase() === host);
      if (existing) {
        existing.durationMs = (existing.durationMs ?? 0) + durationMs;
        existing.url = url || existing.url;
        existing.title = title || existing.title;
        existing.browserName = browserName || existing.browserName;
        existing.lastSeenAt = new Date();
      } else {
        siteList.push({
          host,
          url,
          title,
          browserName,
          durationMs,
          lastSeenAt: new Date(),
        });
      }
      session.sites = siteList;
      continue;
    }

    // app
    const appName = sample.appName?.trim();
    if (!appName) continue;
    const processName = sample.processName?.trim() ?? '';
    const windowTitle = sample.windowTitle?.trim() ?? '';
    if (isExcludedApp(appName, processName, windowTitle)) continue;

    const durationMs = Math.max(0, Math.min(Number(sample.durationMs) || 0, MAX_APP_SAMPLE_MS));
    if (durationMs <= 0) continue;

    const key = appName.toLowerCase();
    const existing = session.apps.find((a) => a.appName.toLowerCase() === key);
    if (existing) {
      existing.durationMs = (existing.durationMs ?? 0) + durationMs;
      existing.lastWindowTitle = sample.windowTitle?.trim() || existing.lastWindowTitle;
      existing.processName = processName || existing.processName;
      existing.lastSeenAt = new Date();
    } else {
      session.apps.push({
        appName,
        processName,
        durationMs,
        lastWindowTitle: sample.windowTitle?.trim() ?? '',
        lastSeenAt: new Date(),
      });
    }
  }

  await session.save();
  return serializeSession(session);
}

export async function stopSession(actor: Actor, sessionId?: string) {
  const query: Record<string, unknown> = {
    userId: actor.sub,
    orgId: actor.orgId,
    status: 'active',
  };
  if (sessionId && Types.ObjectId.isValid(sessionId)) {
    query._id = sessionId;
  }

  const session = await ActivitySession.findOne(query).sort({ startedAt: -1 });
  if (!session) {
    return { session: null };
  }

  session.status = 'closed';
  session.endedAt = new Date();
  await session.save();
  emitPresenceUpdate(actor.orgId, { userId: actor.sub, checkedIn: false });
  return { session: serializeSession(session) };
}

export async function getTodaySummary(actor: Actor) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const sessions = await ActivitySession.find({
    userId: actor.sub,
    orgId: actor.orgId,
    startedAt: { $gte: start },
  }).sort({ startedAt: -1 });

  const apps = aggregateApps(sessions);
  const sites = aggregateSites(sessions);
  return {
    date: start.toISOString().slice(0, 10),
    totalTrackedMs: apps.reduce((s, a) => s + a.durationMs, 0),
    sessions: sessions.map(serializeSession),
    apps,
    sites,
  };
}

function requireOrgAdmin(actor: Actor) {
  if (actor.role !== 'Admin' && actor.role !== 'Manager') {
    throw new AuthError('Admin access required', 403, 'FORBIDDEN');
  }
}

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayBounds(dateStr?: string) {
  const start = new Date();
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    start.setFullYear(y, m - 1, d);
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, date: localDateStr(start) };
}

type AppAgg = {
  appName: string;
  processName: string;
  durationMs: number;
  lastWindowTitle: string;
};

type SiteAgg = {
  host: string;
  url: string;
  title: string;
  browserName: string;
  durationMs: number;
};

function aggregateApps(
  sessions: {
    apps?: {
      appName: string;
      processName?: string | null;
      durationMs?: number | null;
      lastWindowTitle?: string | null;
    }[];
  }[],
): AppAgg[] {
  const byApp = new Map<string, AppAgg>();
  for (const s of sessions) {
    for (const a of s.apps ?? []) {
      if (isExcludedApp(a.appName, a.processName ?? '', a.lastWindowTitle ?? '')) {
        continue;
      }
      const key = a.appName.toLowerCase();
      const prev = byApp.get(key);
      if (prev) {
        prev.durationMs += a.durationMs ?? 0;
        if (a.lastWindowTitle) prev.lastWindowTitle = a.lastWindowTitle;
      } else {
        byApp.set(key, {
          appName: a.appName,
          processName: a.processName ?? '',
          durationMs: a.durationMs ?? 0,
          lastWindowTitle: a.lastWindowTitle ?? '',
        });
      }
    }
  }
  return [...byApp.values()].sort((a, b) => b.durationMs - a.durationMs);
}

function aggregateSites(
  sessions: {
    sites?: {
      host: string;
      url?: string | null;
      title?: string | null;
      browserName?: string | null;
      durationMs?: number | null;
    }[];
  }[],
): SiteAgg[] {
  const byHost = new Map<string, SiteAgg>();
  for (const s of sessions) {
    for (const site of s.sites ?? []) {
      const key = site.host.toLowerCase();
      const prev = byHost.get(key);
      if (prev) {
        prev.durationMs += site.durationMs ?? 0;
        if (site.url) prev.url = site.url;
        if (site.title) prev.title = site.title;
        if (site.browserName) prev.browserName = site.browserName;
      } else {
        byHost.set(key, {
          host: site.host,
          url: site.url ?? '',
          title: site.title ?? '',
          browserName: site.browserName ?? '',
          durationMs: site.durationMs ?? 0,
        });
      }
    }
  }
  return [...byHost.values()].sort((a, b) => b.durationMs - a.durationMs);
}

export async function getOrgActivityByDate(actor: Actor, dateStr?: string) {
  requireOrgAdmin(actor);

  const { start, end, date } = dayBounds(dateStr);
  const isToday = date === dayBounds().date;

  const users = await User.find({
    orgId: actor.orgId,
    status: { $in: ['active', 'invited', 'locked'] },
  })
    .select('_id name email role avatarUrl')
    .lean();

  const sessions = await ActivitySession.find({
    orgId: actor.orgId,
    startedAt: { $gte: start, $lt: end },
  }).sort({ startedAt: -1 });

  const members = users.map((u) => {
    const userSessions = sessions.filter((s) => String(s.userId) === String(u._id));
    const apps = aggregateApps(userSessions);
    const sites = aggregateSites(userSessions);
    const activeSession =
      isToday && userSessions.some((s) => s.status === 'active');

    return {
      userId: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl ?? null,
      tracking: Boolean(activeSession),
      totalTrackedMs: apps.reduce((sum, a) => sum + a.durationMs, 0),
      apps,
      sites,
      sessions: userSessions.map(serializeSession),
    };
  });

  members.sort((a, b) => b.totalTrackedMs - a.totalTrackedMs);

  const allApps = aggregateApps(sessions);
  const allSites = aggregateSites(sessions);

  return {
    date,
    totalTrackedMs: allApps.reduce((s, a) => s + a.durationMs, 0),
    allApps,
    allSites,
    members,
  };
}

/** @deprecated use getOrgActivityByDate */
export async function getOrgTodayActivity(actor: Actor) {
  return getOrgActivityByDate(actor);
}
