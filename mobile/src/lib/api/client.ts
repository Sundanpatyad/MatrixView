import { API_BASE } from '../config';
import { isOfflineError, isTransientServerError } from './errors';

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

export function peekAccessToken(): string | null {
  return getAccessToken();
}

export function refreshApiAccessToken(): Promise<string | null> {
  return refreshAccessToken();
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
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

function isFormDataBody(body: unknown): body is FormData {
  if (!body || typeof body !== 'object') return false;
  // `instanceof` can fail across RN realms; duck-type as a fallback.
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  return (
    (body as { constructor?: { name?: string } }).constructor?.name === 'FormData' &&
    typeof (body as FormData).append === 'function'
  );
}

async function performRequest(path: string, options: ApiRequestOptions, token: string | null): Promise<Response> {
  const { method = 'GET', body, headers = {}, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const formData = isFormDataBody(body);

  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  // Never set Content-Type for FormData — fetch must add the multipart boundary.
  if (body !== undefined && !formData) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  // AbortController + multipart file uploads is flaky on React Native (iOS/Android):
  // the native layer often surfaces a generic "Network request failed" instead of
  // completing the upload. Skip abort wiring for FormData and rely on OS timeouts.
  const controller = formData ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const onExternalAbort = () => controller?.abort();
  if (controller) signal?.addEventListener('abort', onExternalAbort);

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : formData ? (body as FormData) : JSON.stringify(body),
      signal: controller?.signal ?? signal,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
    if (controller) signal?.removeEventListener('abort', onExternalAbort);
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
    const detail =
      error instanceof Error && error.message && error.message !== 'Network request failed'
        ? error.message
        : 'Cannot reach the server. Check your connection and try again.';
    throw new ApiError(detail, 0, 'NETWORK_ERROR');
  }

  if (response.status === 401 && auth && !skipRefresh) {
    try {
      const nextToken = await refreshAccessToken();
      if (nextToken) {
        try {
          response = await performRequest(path, options, nextToken);
        } catch {
          throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
        }
      }
    } catch (err) {
      if (isOfflineError(err) || isTransientServerError(err)) throw err;
      if (err instanceof ApiError && err.status === 0) throw err;
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
