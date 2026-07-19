export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenGetter = () => string | null;
type TokenRefresher = () => Promise<string | null>;

let accessTokenGetter: TokenGetter = () => null;
let accessTokenRefresher: TokenRefresher = async () => null;

export function configureApiAuth(opts: {
  getAccessToken: TokenGetter;
  refreshAccessToken: TokenRefresher;
}) {
  accessTokenGetter = opts.getAccessToken;
  accessTokenRefresher = opts.refreshAccessToken;
}

export function peekAccessToken() {
  return accessTokenGetter();
}

export async function refreshApiAccessToken() {
  return accessTokenRefresher();
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean; skipRefresh?: boolean } = {},
): Promise<T> {
  const { auth = false, skipRefresh = false, headers, ...rest } = init;
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const finalHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData;
  if (!finalHeaders.has('Content-Type') && rest.body && !isFormData) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = accessTokenGetter();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, { ...rest, headers: finalHeaders });

  if (res.status === 401 && auth && !skipRefresh) {
    const next = await accessTokenRefresher();
    if (next) {
      finalHeaders.set('Authorization', `Bearer ${next}`);
      res = await fetch(url, { ...rest, headers: finalHeaders });
    }
  }

  if (!res.ok) {
    let message = res.statusText || 'Request failed';
    let code: string | undefined;
    try {
      const data = (await res.json()) as { error?: { message?: string; code?: string } };
      message = data.error?.message ?? message;
      code = data.error?.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
