import { DEVICE_ID, DEVICE_TYPE } from '../config';
import { apiFetch } from './client';
import type { AuthResponse, AuthUser, InvitePreview, PickedFile } from './types';

export function loginRequest(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password, deviceType: DEVICE_TYPE, deviceId: DEVICE_ID },
  });
}

export function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  orgName?: string;
  inviteToken?: string;
}) {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { ...input, deviceType: DEVICE_TYPE, deviceId: DEVICE_ID },
  });
}

export function refreshRequest(refreshToken: string) {
  return apiFetch<AuthResponse>('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    skipRefresh: true,
  });
}

export function logoutRequest(refreshToken: string | null, accessToken: string | null) {
  return apiFetch<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken: refreshToken ?? undefined },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    skipRefresh: true,
  });
}

export function logoutAllRequest() {
  return apiFetch<{ ok: true }>('/api/auth/logout-all', { method: 'POST', auth: true });
}

export function meRequest() {
  return apiFetch<{ user: AuthUser }>('/api/auth/me', { auth: true });
}

export function updateMeRequest(input: { name?: string; phone?: string }) {
  return apiFetch<{ user: AuthUser }>('/api/auth/me', { method: 'PATCH', body: input, auth: true });
}

export function fetchInviteRequest(token: string) {
  return apiFetch<{ invite: InvitePreview }>(`/api/auth/invites/${encodeURIComponent(token)}`);
}

export function uploadAvatarRequest(file: PickedFile) {
  const form = new FormData();
  form.append('avatar', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  return apiFetch<{ user: AuthUser }>('/api/auth/me/avatar', { method: 'POST', body: form, auth: true });
}
