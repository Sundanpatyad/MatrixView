import { apiFetch } from '@/lib/api/client';

export function registerDeviceToken(input: {
  token: string;
  platform: 'android' | 'ios';
  deviceId?: string | null;
}) {
  return apiFetch<{ ok: true }>('/api/notifications/device-token', {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export function unregisterDeviceToken(token: string) {
  return apiFetch<{ ok: true }>('/api/notifications/device-token', {
    method: 'DELETE',
    body: { token },
    auth: true,
  });
}
