import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config.js';
import { AuthError } from './errors.js';
import type { AuthResult } from './service.js';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
};

type OAuthState = {
  returnTo: string;
  deviceType: 'web' | 'desktop' | 'mobile';
  deviceId?: string;
};

type PendingExchange = {
  result: AuthResult;
  expiresAt: number;
};

const pendingExchanges = new Map<string, PendingExchange>();

function prunePending() {
  const now = Date.now();
  for (const [code, entry] of pendingExchanges) {
    if (entry.expiresAt <= now) pendingExchanges.delete(code);
  }
}

export function googleConfigured() {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

function oauthClient(redirectUri = config.google.redirectUri) {
  if (!googleConfigured()) {
    throw new AuthError('Google sign-in is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
  }
  return new OAuth2Client({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    redirectUri,
  });
}

export function encodeOAuthState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.jwtAccessSecret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function decodeOAuthState(raw: string): OAuthState {
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) throw new AuthError('Invalid OAuth state', 400, 'INVALID_OAUTH_STATE');
  const expected = crypto
    .createHmac('sha256', config.jwtAccessSecret)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AuthError('Invalid OAuth state', 400, 'INVALID_OAUTH_STATE');
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
    if (!parsed.returnTo || !parsed.deviceType) {
      throw new Error('missing fields');
    }
    return parsed;
  } catch {
    throw new AuthError('Invalid OAuth state', 400, 'INVALID_OAUTH_STATE');
  }
}

export function assertAllowedReturnTo(returnTo: string) {
  let url: URL;
  try {
    url = new URL(returnTo);
  } catch {
    throw new AuthError('Invalid return URL', 400, 'INVALID_RETURN_TO');
  }

  // Desktop deep link back into DockX after Google finishes in the system browser.
  if (url.protocol === 'dockx:') {
    const combined = `${url.hostname}${url.pathname}`.replace(/\/+/g, '/');
    if (
      combined.includes('auth/google/callback') ||
      url.pathname.startsWith('/auth/google')
    ) {
      return;
    }
    throw new AuthError('Invalid return path', 400, 'INVALID_RETURN_TO');
  }

  const allowed = new Set([
    ...config.corsOrigin,
    ...config.desktopCorsOrigins,
    config.appUrl,
  ]);
  const origin = url.origin;
  if (!allowed.has(origin)) {
    throw new AuthError('Return URL origin is not allowed', 400, 'INVALID_RETURN_TO');
  }
  if (!url.pathname.startsWith('/auth/google')) {
    throw new AuthError('Invalid return path', 400, 'INVALID_RETURN_TO');
  }
}

/** Desktop installed clients use loopback (`http://127.0.0.1:PORT/` or localhost). */
export function assertLoopbackRedirectUri(redirectUri: string): string {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new AuthError('Invalid redirect URI', 400, 'INVALID_REDIRECT_URI');
  }
  if (url.protocol !== 'http:') {
    throw new AuthError('Redirect URI must be http loopback', 400, 'INVALID_REDIRECT_URI');
  }
  const host = url.hostname.toLowerCase();
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]' && host !== '::1') {
    throw new AuthError('Redirect URI must be loopback', 400, 'INVALID_REDIRECT_URI');
  }
  const port = Number(url.port || '80');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new AuthError('Redirect URI port is invalid', 400, 'INVALID_REDIRECT_URI');
  }
  // Normalize: trailing slash, no query/hash.
  url.search = '';
  url.hash = '';
  if (!url.pathname || url.pathname === '') url.pathname = '/';
  return url.toString();
}

export function buildGoogleAuthUrl(
  state: OAuthState,
  redirectUri: string = config.google.redirectUri,
): string {
  assertAllowedReturnTo(state.returnTo);
  const client = oauthClient(redirectUri);
  console.info(`[google-oauth] authorize redirect_uri=${redirectUri}`);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state: encodeOAuthState(state),
    include_granted_scopes: true,
    redirect_uri: redirectUri,
  });
}

/** Auth URL for desktop loopback (no browser returnTo — app listens on localhost). */
export function buildDesktopLoopbackAuthUrl(redirectUri: string, deviceId?: string): string {
  const normalized = assertLoopbackRedirectUri(redirectUri);
  const state: OAuthState = {
    returnTo: 'dockx:///auth/google/callback',
    deviceType: 'desktop',
    deviceId,
  };
  return buildGoogleAuthUrl(state, normalized);
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string = config.google.redirectUri,
): Promise<GoogleProfile> {
  const client = oauthClient(redirectUri);
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.id_token) {
    throw new AuthError('Google did not return an ID token', 401, 'GOOGLE_AUTH_FAILED');
  }
  return verifyGoogleIdToken(tokens.id_token);
}

/** GCP / Firebase project numbers whose OAuth clients may mint DockX ID tokens. */
const TRUSTED_GOOGLE_CLIENT_PREFIXES = [
  '569448299007-', // MatrixView Cloud project
  '1063136013781-', // DockX Firebase (google-services.json / FCM)
];

function peekJwtPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function isTrustedGoogleClientId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.endsWith('.apps.googleusercontent.com') &&
    TRUSTED_GOOGLE_CLIENT_PREFIXES.some((prefix) => value.startsWith(prefix))
  );
}

function audiencesForIdToken(idToken: string): string[] {
  const configured = [
    config.google.clientId,
    config.google.webClientId,
    config.google.iosClientId,
    config.google.androidClientId,
  ].filter(Boolean);
  const peeked = peekJwtPayload(idToken);
  const fromToken = [peeked?.aud, peeked?.azp].flat().filter(isTrustedGoogleClientId);
  return [...new Set([...configured, ...fromToken])];
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const peeked = peekJwtPayload(idToken);
  if (!peeked) {
    throw new AuthError('Invalid Google token', 401, 'GOOGLE_AUTH_FAILED');
  }
  const audiences = audiencesForIdToken(idToken);
  if (!audiences.length) {
    throw new AuthError('Google sign-in is not configured', 503, 'GOOGLE_NOT_CONFIGURED');
  }
  const client = new OAuth2Client(config.google.clientId || audiences[0]);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      // Native Android tokens are minted for the Web client; iOS may use the iOS client.
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
    payload = ticket.getPayload();
  } catch (err) {
    const detail = err instanceof Error ? err.message : '';
    console.error('[google] id token verify failed', detail, {
      aud: peeked.aud,
      azp: peeked.azp,
      iss: peeked.iss,
    });
    throw new AuthError('Invalid Google token', 401, 'GOOGLE_AUTH_FAILED');
  }
  if (!payload?.sub || !payload.email) {
    throw new AuthError('Invalid Google token', 401, 'GOOGLE_AUTH_FAILED');
  }
  const emailVerified = payload.email_verified === true;
  if (!emailVerified) {
    throw new AuthError('Google email is not verified', 403, 'EMAIL_NOT_VERIFIED');
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name?.trim() || payload.email.split('@')[0] || 'Google User',
    avatarUrl: payload.picture ?? null,
    emailVerified,
  };
}

export function storeOAuthExchange(result: AuthResult): string {
  prunePending();
  const code = crypto.randomBytes(24).toString('base64url');
  pendingExchanges.set(code, {
    result,
    expiresAt: Date.now() + 60_000,
  });
  return code;
}

export function consumeOAuthExchange(code: string): AuthResult {
  prunePending();
  const entry = pendingExchanges.get(code);
  pendingExchanges.delete(code);
  if (!entry || entry.expiresAt <= Date.now()) {
    throw new AuthError('Google sign-in expired. Try again.', 401, 'OAUTH_CODE_EXPIRED');
  }
  return entry.result;
}
