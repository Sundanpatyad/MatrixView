import { apiFetch } from './client';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  orgId: string;
  orgName: string;
  role: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
};

export function loginRequest(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      deviceType: 'desktop',
      deviceId: 'dockx-desktop',
    }),
  });
}

/** Browser Google Sign-In: verify an ID token (no client secret). */
export function googleIdTokenLoginRequest(idToken: string): Promise<AuthResponse> {
  const web = typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
  return apiFetch<AuthResponse>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({
      idToken,
      deviceType: web ? 'web' : 'desktop',
      deviceId: web ? 'dockx-web' : 'dockx-desktop',
    }),
    skipRefresh: true,
  });
}

export function googleExchangeRequest(code: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
    skipRefresh: true,
  });
}

/** Desktop loopback: ask backend for a Google authorize URL. */
export function googleDesktopUrlRequest(redirectUri: string): Promise<{ url: string }> {
  const qs = new URLSearchParams({
    redirectUri,
    deviceId: 'dockx-desktop',
  });
  return apiFetch<{ url: string; redirectUri: string }>(
    `/api/auth/google/desktop-url?${qs.toString()}`,
    { skipRefresh: true },
  );
}

/** Desktop loopback: exchange Google auth code + matching redirect URI. */
export function googleDesktopLoginRequest(input: {
  code: string;
  redirectUri: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/google/desktop', {
    method: 'POST',
    body: JSON.stringify({
      code: input.code,
      redirectUri: input.redirectUri,
      deviceType: 'desktop',
      deviceId: 'dockx-desktop',
    }),
    skipRefresh: true,
  });
}

/** Start Google OAuth via the API (legacy web redirect through the backend). */
export function googleStartUrl(returnTo: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
  const url = new URL(`${base}/api/auth/google/start`);
  url.searchParams.set('returnTo', returnTo);
  const web = typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
  url.searchParams.set('deviceType', web ? 'web' : 'desktop');
  url.searchParams.set('deviceId', web ? 'dockx-web' : 'dockx-desktop');
  return url.toString();
}

export function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  orgName?: string;
  inviteToken?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
      deviceType: 'desktop',
      deviceId: 'dockx-desktop',
    }),
  });
}

export function refreshRequest(refreshToken: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    skipRefresh: true,
  });
}

export function logoutRequest(refreshToken: string | null, accessToken: string | null) {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  }).catch(() => ({ ok: true }));
}

export function meRequest(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/api/auth/me', { auth: true });
}

export function updateMeRequest(input: {
  name?: string;
  phone?: string;
}): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/api/auth/me', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function uploadAvatarRequest(file: File): Promise<{ user: AuthUser }> {
  const body = new FormData();
  body.append('avatar', file);
  return apiFetch<{ user: AuthUser }>('/api/auth/me/avatar', {
    method: 'POST',
    auth: true,
    body,
  });
}
