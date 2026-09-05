import { invoke } from '@tauri-apps/api/core';
import { isTauriApp } from '@/lib/webrtc/screenShare';
import {
  googleDesktopLoginRequest,
  googleDesktopUrlRequest,
  googleIdTokenLoginRequest,
} from '@/lib/api/auth';
import type { AuthResponse } from '@/lib/api/auth';

const NONCE_KEY = 'dockx.google.nonce';

/**
 * Web application OAuth client (Google Cloud "Web application" type).
 * Must not be the Desktop/installed client — that one only redirects to localhost.
 */
export const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined)?.trim() ||
  '569448299007-djn2v1re676r3rjcqm84fbrjraddbdnp.apps.googleusercontent.com';

type LoopbackStart = { redirectUri: string; port: number };
type LoopbackResult = { code: string | null; error: string | null };

function webCallbackUri(): string {
  return `${window.location.origin}/auth/google/callback`;
}

/** Implicit ID-token login that returns to this origin (Vercel or local Vite). */
export function googleOAuthStartUrl(): string {
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem(NONCE_KEY, nonce);
  } catch {
    /* private mode */
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID,
    redirect_uri: webCallbackUri(),
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Deep-link into the Tauri app after the browser receives a one-time DockX code. */
export function dockxGoogleDeepLink(code: string): string {
  return `dockx:///auth/google/callback?code=${encodeURIComponent(code)}`;
}

/**
 * Desktop (Tauri): loopback OAuth with the installed Google client.
 * Opens the system browser, listens on 127.0.0.1, exchanges code via API.
 */
export async function signInWithGoogleDesktop(): Promise<AuthResponse> {
  const started = await invoke<LoopbackStart>('google_oauth_loopback_start');
  try {
    const wait = invoke<LoopbackResult>('google_oauth_loopback_wait', {
      timeoutMs: 180_000,
    });

    const { url } = await googleDesktopUrlRequest(started.redirectUri);
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);

    const result = await wait;

    if (result.error) {
      throw new Error(
        result.error === 'access_denied'
          ? 'Google sign-in was cancelled.'
          : `Google sign-in failed (${result.error}).`,
      );
    }
    if (!result.code) {
      throw new Error('Google did not return an authorization code.');
    }

    return googleDesktopLoginRequest({
      code: result.code,
      redirectUri: started.redirectUri,
    });
  } catch (err) {
    try {
      await invoke('google_oauth_loopback_cancel');
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export async function loginWithGoogleIdToken(idToken: string): Promise<AuthResponse> {
  return googleIdTokenLoginRequest(idToken);
}

/**
 * Open Google sign-in.
 * - Tauri: loopback in the system browser.
 * - Web: Google returns to this site with an ID token (never localhost).
 */
export async function openGoogleSignIn(): Promise<
  { mode: 'desktop'; auth: AuthResponse } | { mode: 'browser' } | { mode: 'redirect' }
> {
  if (isTauriApp()) {
    const auth = await signInWithGoogleDesktop();
    return { mode: 'desktop', auth };
  }
  window.location.assign(googleOAuthStartUrl());
  return { mode: 'redirect' };
}

export function parseGoogleCallbackUrl(raw: string): {
  code: string | null;
  error: string | null;
  idToken: string | null;
} {
  try {
    const url = new URL(raw);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    return {
      code: url.searchParams.get('code') || hash.get('code'),
      error: url.searchParams.get('error') || hash.get('error'),
      idToken: hash.get('id_token') || url.searchParams.get('id_token'),
    };
  } catch {
    return { code: null, error: null, idToken: null };
  }
}
