import { apiFetch } from './client';
import type { AttendanceStatus, OrgActivity, TodayActivity } from './types';

function tzOffset(): number {
  return new Date().getTimezoneOffset();
}

export function getAttendanceStatus() {
  return apiFetch<AttendanceStatus>(`/api/activity/attendance?tzOffset=${tzOffset()}`, { auth: true });
}

export function getTodayActivity() {
  return apiFetch<TodayActivity>(`/api/activity/today?tzOffset=${tzOffset()}`, { auth: true });
}

export function getOrgActivityByDate(date: string, projectId?: string) {
  const projectQ = projectId ? `&projectId=${encodeURIComponent(projectId)}` : '';
  return apiFetch<OrgActivity>(
    `/api/activity/org/today?date=${encodeURIComponent(date)}&tzOffset=${tzOffset()}${projectQ}`,
    { auth: true },
  );
}
