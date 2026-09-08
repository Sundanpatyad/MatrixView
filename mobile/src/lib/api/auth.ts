import { DEVICE_ID, DEVICE_TYPE } from '../config';
import { appendUploadFile } from '../pickers';
import { apiFetch } from './client';
import type { AuthResponse, AuthUser, InvitePreview, PickedFile } from './types';

export function loginRequest(email: string, password: string, rememberMe = true) {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password, rememberMe, deviceType: DEVICE_TYPE, deviceId: DEVICE_ID },
  });
}

/** Native Google Sign-In: exchange a Google ID token for DockX session tokens. */
export function googleLoginRequest(idToken: string, rememberMe = true) {
  return apiFetch<AuthResponse>('/api/auth/google', {
    method: 'POST',
    body: { idToken, rememberMe, deviceType: DEVICE_TYPE, deviceId: DEVICE_ID },
    skipRefresh: true,
  });
}

export function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  orgName?: string;
  inviteToken?: string;
  rememberMe?: boolean;
}) {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { ...input, rememberMe: input.rememberMe !== false, deviceType: DEVICE_TYPE, deviceId: DEVICE_ID },
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

export async function uploadAvatarRequest(file: PickedFile) {
  const form = new FormData();
  await appendUploadFile(form, 'avatar', file);
  return apiFetch<{ user: AuthUser }>('/api/auth/me/avatar', {
    method: 'POST',
    body: form,
    auth: true,
    timeoutMs: 120000,
  });
}
