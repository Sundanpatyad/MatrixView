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
