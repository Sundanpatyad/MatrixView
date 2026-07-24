export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

if (import.meta.env.PROD && !API_BASE) {
  console.error(
    '[DockX] VITE_API_URL was not baked into this build. Login will fail until you rebuild with VITE_API_URL set.',
  );
}

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
  if (!API_BASE) {
    throw new ApiError(
      'App is not configured with an API URL. Rebuild with VITE_API_URL set.',
      0,
      'MISSING_API_URL',
    );
  }

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

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: finalHeaders });
  } catch {
    throw new ApiError(
      'Cannot reach the DockX API. Check your network connection.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (res.status === 401 && auth && !skipRefresh) {
    const next = await accessTokenRefresher();
    if (next) {
      finalHeaders.set('Authorization', `Bearer ${next}`);
      try {
        res = await fetch(url, { ...rest, headers: finalHeaders });
      } catch {
        throw new ApiError(
          'Cannot reach the DockX API. Check your network connection.',
          0,
          'NETWORK_ERROR',
        );
      }
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
