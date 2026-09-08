import { Types } from 'mongoose';
import { emitPresenceUpdate } from '../../gateway/io.js';
import { AuthError } from '../auth/errors.js';
import { User } from '../auth/models/User.js';
import { Project } from '../workspace/models/Project.js';
import { isExcludedApp } from './exclude.js';
import { ActivitySession } from './models/ActivitySession.js';
import { serializeSession } from './serialize.js';

type Actor = { sub: string; orgId: string; email: string; role?: string };

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

function normalizeHost(raw: string): string {
  let host = raw.trim().toLowerCase();
  if (!host) return '';
  // Drop credentials / port noise for grouping
  host = host.replace(/^https?:\/\//, '').split('/')[0] ?? host;
  host = host.replace(/:\d+$/, '');
  host = host.replace(/^www\./, '');
  // Mobile / country CDN aliases → registrable-ish host
  host = host.replace(/^m\./, '').replace(/^mobile\./, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.includes(' ') ||
    host.startsWith('file:')
  ) {
    return '';
  }
  return host;
}

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return normalizeHost(u.hostname);
  } catch {
    return normalizeHost(url);
  }
}

/** Sessions that belong in a calendar day (incl. still-active overnight). */
function sessionsForDayFilter(start: Date, end: Date) {
  return {
    $or: [
      { startedAt: { $gte: start, $lt: end } },
      { status: 'active' as const, startedAt: { $lt: end } },
      {
        status: 'closed' as const,
        startedAt: { $lt: start },
        endedAt: { $gte: start, $lt: end },
      },
    ],
  };
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
export async function getAttendanceStatus(actor: Actor, tzOffsetMinutes?: number) {
  const session = await getCurrentSession(actor);
  const checkedIn = Boolean(session && session.status === 'active');

  // Latest closed session today (for UI when checked out)
  const { start } = dayBounds(undefined, tzOffsetMinutes);
  const lastClosed = await ActivitySession.findOne({
    userId: actor.sub,
    orgId: actor.orgId,
    status: 'closed',
    $or: [{ endedAt: { $gte: start } }, { startedAt: { $gte: start } }],
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

  // Desktop can POST overlapping sample batches; retry on Mongoose VersionError.
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await ingestSamplesOnce(actor, sessionId, samples);
    } catch (err) {
      lastErr = err;
      const isVersionConflict =
        err instanceof Error &&
        (err.name === 'VersionError' ||
          /No matching document found for id/.test(err.message));
      if (!isVersionConflict || attempt === maxAttempts - 1) throw err;
    }
  }
  throw lastErr;
}

async function ingestSamplesOnce(
  actor: Actor,
  sessionId: string,
  samples: ActivitySampleInput[],
) {
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
      if (url && !/^https?:\/\//i.test(url)) continue;
      const host = normalizeHost(sample.host?.trim() || (url ? hostFromUrl(url) : ''));
      if (!host) continue;
      const durationMs = Math.max(0, Math.min(Number(sample.durationMs) || 0, MAX_APP_SAMPLE_MS));
      if (durationMs <= 0) continue;
      const browserName = sample.appName?.trim() ?? '';
      const title = sample.windowTitle?.trim() ?? '';

      const siteList = session.sites ?? [];
      const existing = siteList.find((s) => normalizeHost(s.host) === host);
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

export async function getTodaySummary(actor: Actor, tzOffsetMinutes?: number) {
  const { start, end, date } = dayBounds(undefined, tzOffsetMinutes);

  const sessions = await ActivitySession.find({
    userId: actor.sub,
    orgId: actor.orgId,
    ...sessionsForDayFilter(start, end),
  }).sort({ startedAt: -1 });

  const apps = aggregateApps(sessions);
  const sites = aggregateSites(sessions);
  return {
    date,
    totalTrackedMs: apps.reduce((s, a) => s + a.durationMs, 0),
    totalWebsiteMs: sites.reduce((s, a) => s + a.durationMs, 0),
    sessions: sessions.map(serializeSession),
    apps,
    sites,
  };
}

/** Projects where the actor is a project admin (not org-level Admin). */
async function findAdminProjects(actor: Actor) {
  const email = actor.email.toLowerCase().trim();
  const uid = Types.ObjectId.isValid(actor.sub) ? new Types.ObjectId(actor.sub) : null;
  return Project.find({
    members: {
      $elemMatch: {
        role: 'admin',
        $or: uid ? [{ email }, { userId: uid }] : [{ email }],
      },
    },
  })
    .select('_id name orgId members')
    .lean();
}

/**
 * Calendar-day bounds in the client's timezone.
 * `tzOffsetMinutes` = `Date#getTimezoneOffset()` (e.g. IST = -330).
 */
function dayBounds(dateStr?: string, tzOffsetMinutes?: number) {
  const offset =
    typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
      ? tzOffsetMinutes
      : new Date().getTimezoneOffset();

  let y: number;
  let m: number;
  let d: number;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  } else {
    const local = new Date(Date.now() - offset * 60_000);
    y = local.getUTCFullYear();
    m = local.getUTCMonth() + 1;
    d = local.getUTCDate();
  }

  const start = new Date(Date.UTC(y, m - 1, d) + offset * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { start, end, date };
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
      const key = normalizeHost(site.host);
      if (!key) continue;
      const prev = byHost.get(key);
      if (prev) {
        prev.durationMs += site.durationMs ?? 0;
        if (site.url) prev.url = site.url;
        if (site.title) prev.title = site.title;
        if (site.browserName) prev.browserName = site.browserName;
      } else {
        byHost.set(key, {
          host: key,
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

export async function getOrgActivityByDate(
  actor: Actor,
  dateStr?: string,
  tzOffsetMinutes?: number,
  projectId?: string,
) {
  const allAdminProjects = await findAdminProjects(actor);
  if (allAdminProjects.length === 0) {
    throw new AuthError('Project admin access required', 403, 'FORBIDDEN');
  }

  let adminProjects = allAdminProjects;
  if (projectId) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new AuthError('Project not found', 404, 'NOT_FOUND');
    }
    adminProjects = allAdminProjects.filter((p) => String(p._id) === projectId);
    if (adminProjects.length === 0) {
      throw new AuthError('Project admin access required', 403, 'FORBIDDEN');
    }
  }

  type RosterEntry = {
    key: string;
    userId: string | null;
    name: string;
    email: string;
    projectRole: 'admin' | 'member';
    memberStatus: 'active' | 'pending';
  };

  const byUserId = new Map<string, RosterEntry>();
  const byEmail = new Map<string, RosterEntry>();
  const projectOrgIds = new Set<string>();

  for (const p of adminProjects) {
    if (p.orgId) projectOrgIds.add(String(p.orgId));
    for (const m of p.members ?? []) {
      const email = String(m.email ?? '')
        .toLowerCase()
        .trim();
      if (!email) continue;
      const uid =
        m.userId && Types.ObjectId.isValid(String(m.userId)) ? String(m.userId) : null;
      const projectRole = m.role === 'admin' ? 'admin' : 'member';
      const memberStatus = m.status === 'pending' ? 'pending' : 'active';
      const existing = (uid ? byUserId.get(uid) : undefined) ?? byEmail.get(email);
      if (!existing) {
        const entry: RosterEntry = {
          key: uid || `email:${email}`,
          userId: uid,
          name: String(m.name || email),
          email,
          projectRole,
          memberStatus,
        };
        if (uid) byUserId.set(uid, entry);
        byEmail.set(email, entry);
        continue;
      }
      if (uid && !existing.userId) {
        existing.userId = uid;
        existing.key = uid;
        byUserId.set(uid, existing);
      }
      if (projectRole === 'admin') existing.projectRole = 'admin';
      if (memberStatus === 'active') existing.memberStatus = 'active';
      if (m.name) existing.name = String(m.name);
    }
  }

  const roster = [...new Set([...byUserId.values(), ...byEmail.values()])];
  const linkedIds = roster
    .map((r) => r.userId)
    .filter((id): id is string => Boolean(id))
    .map((id) => new Types.ObjectId(id));
  const emails = [...new Set(roster.map((r) => r.email))];

  const userQuery: Record<string, unknown>[] = [];
  if (linkedIds.length) userQuery.push({ _id: { $in: linkedIds } });
  if (emails.length) userQuery.push({ email: { $in: emails } });

  const users =
    userQuery.length === 0
      ? []
      : await User.find({ $or: userQuery })
          .select('_id name email avatarUrl orgId')
          .lean();

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const usersByEmail = new Map<string, typeof users>();
  for (const u of users) {
    const em = String(u.email).toLowerCase();
    const list = usersByEmail.get(em) ?? [];
    list.push(u);
    usersByEmail.set(em, list);
  }

  const pickUser = (entry: RosterEntry) => {
    if (entry.userId && userById.has(entry.userId)) return userById.get(entry.userId);
    const list = usersByEmail.get(entry.email) ?? [];
    if (list.length === 0) return undefined;
    return (
      list.find((u) => projectOrgIds.has(String(u.orgId))) ??
      list.find((u) => String(u.orgId) === actor.orgId) ??
      list[0]
    );
  };

  const resolved = new Map<string, RosterEntry>();
  for (const entry of roster) {
    const u = pickUser(entry);
    if (u) {
      entry.userId = String(u._id);
      entry.key = entry.userId;
      if (u.name) entry.name = u.name;
    }
    const dest = entry.userId ?? entry.key;
    const prev = resolved.get(dest);
    if (!prev) {
      resolved.set(dest, entry);
      continue;
    }
    if (entry.projectRole === 'admin') prev.projectRole = 'admin';
    if (entry.memberStatus === 'active') prev.memberStatus = 'active';
  }

  const resolvedUserIds = [...resolved.values()]
    .map((r) => r.userId)
    .filter((id): id is string => Boolean(id))
    .map((id) => new Types.ObjectId(id));

  const { start, end, date } = dayBounds(dateStr, tzOffsetMinutes);
  const isToday = date === dayBounds(undefined, tzOffsetMinutes).date;

  const sessions =
    resolvedUserIds.length === 0
      ? []
      : await ActivitySession.find({
          userId: { $in: resolvedUserIds },
          ...sessionsForDayFilter(start, end),
        }).sort({ startedAt: -1 });

  const members = [...resolved.values()].map((entry) => {
    const u = pickUser(entry);
    const userSessions = entry.userId
      ? sessions.filter((s) => String(s.userId) === entry.userId)
      : [];
    const apps = aggregateApps(userSessions);
    const sites = aggregateSites(userSessions);
    const activeSession = isToday && userSessions.some((s) => s.status === 'active');

    return {
      userId: entry.userId ?? entry.key,
      name: entry.name,
      email: entry.email,
      role: entry.projectRole,
      memberStatus: entry.memberStatus,
      avatarUrl: u?.avatarUrl ?? null,
      tracking: Boolean(activeSession),
      totalTrackedMs: apps.reduce((sum, a) => sum + a.durationMs, 0),
      totalWebsiteMs: sites.reduce((sum, a) => sum + a.durationMs, 0),
      apps,
      sites,
      sessions: userSessions.map(serializeSession),
    };
  });

  members.sort((a, b) => {
    if (a.tracking !== b.tracking) return a.tracking ? -1 : 1;
    const aIn = a.sessions.length > 0;
    const bIn = b.sessions.length > 0;
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (a.memberStatus !== b.memberStatus) return a.memberStatus === 'pending' ? 1 : -1;
    if (b.totalTrackedMs !== a.totalTrackedMs) return b.totalTrackedMs - a.totalTrackedMs;
    return a.name.localeCompare(b.name);
  });

  const allApps = aggregateApps(sessions);
  const allSites = aggregateSites(sessions);

  return {
    date,
    totalTrackedMs: allApps.reduce((s, a) => s + a.durationMs, 0),
    totalWebsiteMs: allSites.reduce((s, a) => s + a.durationMs, 0),
    allApps,
    allSites,
    members,
    projects: allAdminProjects.map((p) => ({
      id: String(p._id),
      name: p.name,
    })),
  };
}

/** @deprecated use getOrgActivityByDate */
export async function getOrgTodayActivity(actor: Actor) {
  return getOrgActivityByDate(actor);
}
