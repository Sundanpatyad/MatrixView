import { apiFetch } from './client';
import type { AttendanceStatus, TodayActivity } from './types';

function tzOffset(): number {
  return new Date().getTimezoneOffset();
}

export function getAttendanceStatus() {
  return apiFetch<AttendanceStatus>(`/api/activity/attendance?tzOffset=${tzOffset()}`, { auth: true });
}

export function getTodayActivity() {
  return apiFetch<TodayActivity>(`/api/activity/today?tzOffset=${tzOffset()}`, { auth: true });
}
