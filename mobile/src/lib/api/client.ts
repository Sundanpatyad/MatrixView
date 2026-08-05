import { API_BASE } from '../config';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type AccessTokenGetter = () => string | null;
type AccessTokenRefresher = () => Promise<string | null>;

let getAccessToken: AccessTokenGetter = () => null;
let refreshAccessToken: AccessTokenRefresher = async () => null;

export function configureApiAuth(handlers: {
  getAccessToken: AccessTokenGetter;
  refreshAccessToken: AccessTokenRefresher;
}) {
  getAccessToken = handlers.getAccessToken;
  refreshAccessToken = handlers.refreshAccessToken;
}

export function refreshApiAccessToken(): Promise<string | null> {
  return refreshAccessToken();
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the bearer access token and retry once after a refresh on 401. */
  auth?: boolean;
  /** Set for the refresh call itself so a failure cannot loop. */
  skipRefresh?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20000;

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFromPayload(payload: unknown, status: number): ApiError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error?: { message?: string; code?: string } }).error;
    if (err?.message) return new ApiError(err.message, status, err.code);
  }
  if (typeof payload === 'string' && payload.trim()) {
    return new ApiError(payload, status);
  }
  return new ApiError(`Request failed with status ${status}`, status);
}

async function performRequest(path: string, options: ApiRequestOptions, token: string | null): Promise<Response> {
  const { method = 'GET', body, headers = {}, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined && !isFormData) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = false, skipRefresh = false } = options;

  let response: Response;
  try {
    response = await performRequest(path, options, auth ? getAccessToken() : null);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Check your connection and try again.', 0, 'TIMEOUT');
    }
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 401 && auth && !skipRefresh) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      try {
        response = await performRequest(path, options, nextToken);
      } catch {
        throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
      }
    }
  }

  const payload = await parseBody(response);
  if (!response.ok) {
    throw errorFromPayload(payload, response.status);
  }
  return payload as T;
}

/** Human readable message for any thrown value, safe to render in the UI. */
export function messageFromError(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
