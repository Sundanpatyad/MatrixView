type ErrorLike = {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
};

const SESSION_DEAD_CODES = new Set([
  'INVALID_REFRESH',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'SESSION_INVALID',
  'ACCOUNT_UNAVAILABLE',
  'ACCOUNT_DISABLED',
]);

export function isApiError(error: unknown): error is ErrorLike & { status: number } {
  if (!error || typeof error !== 'object') return false;
  const value = error as ErrorLike;
  return value.name === 'ApiError' && typeof value.status === 'number';
}

/** No network, timeout, or the API host is unreachable — not an auth failure. */
export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!isApiError(error)) {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('offline') ||
      error.name === 'AbortError'
    );
  }
  if (error.status === 0) return true;
  return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'MISSING_API_URL';
}

export function isTransientServerError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.status >= 500 || error.status === 429 || error.status === 408;
}

/** Refresh/session is actually dead — only then should the client sign the user out. */
export function isSessionDead(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.status !== 401 && error.status !== 403) return false;
  if (error.code && SESSION_DEAD_CODES.has(error.code)) return true;
  return false;
}
