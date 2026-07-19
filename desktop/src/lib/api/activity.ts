import { apiFetch } from './client';

export type AppUsage = {
  appName: string;
  processName: string;
  durationMs: number;
  lastWindowTitle: string;
  lastSeenAt?: string;
};

export type SiteUsage = {
  host: string;
  url: string;
  title: string;
  browserName: string;
  durationMs: number;
  lastSeenAt?: string;
};

export type AwayPeriod = {
  kind: 'locked' | 'sleep' | 'lid_closed' | 'away';
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type ActivitySession = {
  id: string;
  userId: string;
  orgId: string;
  status: 'active' | 'closed';
  startedAt: string;
  endedAt: string | null;
  totalTrackedMs: number;
  totalAwayMs?: number;
  apps: AppUsage[];
  sites?: SiteUsage[];
  awayPeriods?: AwayPeriod[];
};

export type ActivitySample = {
  kind?: 'app' | 'site' | 'away';
  appName?: string;
  processName?: string;
  windowTitle?: string;
  url?: string;
  host?: string;
  durationMs: number;
  awayKind?: AwayPeriod['kind'];
  startedAt?: string;
  endedAt?: string;
};

export function startActivitySession(): Promise<{ session: ActivitySession }> {
  return apiFetch('/api/activity/sessions/start', { method: 'POST', auth: true, body: '{}' });
}

export function getCurrentActivitySession(): Promise<{ session: ActivitySession | null }> {
  return apiFetch('/api/activity/sessions/current', { auth: true });
}

export type AttendanceStatus = {
  checkedIn: boolean;
  session: ActivitySession | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lastSession: ActivitySession | null;
};

/** GET — is the user checked in (restores after app reopen). */
export function getAttendanceStatus(): Promise<AttendanceStatus> {
  return apiFetch('/api/activity/attendance', { auth: true });
}

export function postActivitySamples(
  sessionId: string,
  samples: ActivitySample[],
): Promise<{ session: ActivitySession }> {
  return apiFetch(`/api/activity/sessions/${sessionId}/samples`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ samples }),
  });
}

export function stopActivitySession(
  sessionId?: string,
): Promise<{ session: ActivitySession | null }> {
  return apiFetch('/api/activity/sessions/stop', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ sessionId }),
  });
}

export function getTodayActivity(): Promise<{
  date: string;
  totalTrackedMs: number;
  apps: AppUsage[];
  sites?: SiteUsage[];
  sessions: ActivitySession[];
}> {
  return apiFetch('/api/activity/today', { auth: true });
}

export type MemberActivity = {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  tracking: boolean;
  totalTrackedMs: number;
  apps: AppUsage[];
  sites?: SiteUsage[];
  sessions: ActivitySession[];
};

export function getOrgActivityByDate(date: string): Promise<{
  date: string;
  totalTrackedMs: number;
  allApps: AppUsage[];
  allSites?: SiteUsage[];
  members: MemberActivity[];
}> {
  const q = encodeURIComponent(date);
  return apiFetch(`/api/activity/org/today?date=${q}`, { auth: true });
}
