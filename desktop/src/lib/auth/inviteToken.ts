const KEY = 'dockx.pendingInviteToken';

export function rememberInviteToken(token: string | null | undefined) {
  const t = token?.trim() ?? '';
  try {
    if (t) sessionStorage.setItem(KEY, t);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function peekInviteToken(): string {
  try {
    return sessionStorage.getItem(KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function takeInviteToken(): string {
  const t = peekInviteToken();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return t;
}

/** After login/Google, continue the invite if one is in the URL or session. */
export function postAuthPath(token?: string | null): string {
  const t = (token || peekInviteToken()).trim();
  return t ? `/invite?token=${encodeURIComponent(t)}` : '/';
}
