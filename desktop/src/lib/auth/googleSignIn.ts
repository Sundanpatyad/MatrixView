import { invoke } from '@tauri-apps/api/core';
import { isTauriApp } from '@/lib/webrtc/screenShare';
import {
  googleDesktopLoginRequest,
  googleDesktopUrlRequest,
  googleStartUrl,
} from '@/lib/api/auth';
import type { AuthResponse } from '@/lib/api/auth';

/** Prefer http callback for browser/web testing. */
const HTTP_RETURN =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5175';

type LoopbackStart = { redirectUri: string; port: number };
type LoopbackResult = { code: string | null; error: string | null };

/** Build the OAuth start URL that eventually returns into the web app. */
export function googleOAuthStartUrl(): string {
  return googleStartUrl(`${HTTP_RETURN}/auth/google/callback`);
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
    // Accept as soon as the port is bound so a fast Google redirect cannot
    // hit 127.0.0.1 before the app is waiting.
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

/**
 * Open Google sign-in.
 * - Tauri: full desktop loopback flow (returns tokens).
 * - Web: redirect / system browser (caller waits on callback page).
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

/** Parse `dockx:///auth/google/callback?code=…` (or http callback) into query params. */
export function parseGoogleCallbackUrl(raw: string): {
  code: string | null;
  error: string | null;
} {
  try {
    const url = new URL(raw);
    return {
      code: url.searchParams.get('code'),
      error: url.searchParams.get('error'),
    };
  } catch {
    return { code: null, error: null };
  }
}
