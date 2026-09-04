import { NativeModules, Platform } from 'react-native';

/**
 * iOS OAuth client from Google Cloud Console (plist CLIENT_ID).
 * Must match CFBundleURLSchemes / iosUrlScheme in app.json.
 */
const IOS_CLIENT_ID =
  '569448299007-1gm4uv3qh7e78m2g3bod169dm93hkoi5.apps.googleusercontent.com';

/**
 * Web application OAuth client. Android Google Sign-In requires this type
 * (not Desktop / Android) so Google mints an ID token the API can verify.
 */
const WEB_CLIENT_ID =
  '569448299007-djn2v1re676r3rjcqm84fbrjraddbdnp.apps.googleusercontent.com';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let cached: GoogleSignInModule | null | undefined;

/**
 * The package throws at import time when RNGoogleSignin is absent (Expo Go or a
 * binary built before the pod was linked). Keep the rest of the app usable.
 */
function getGoogleSignIn(): GoogleSignInModule | null {
  if (cached !== undefined) return cached;

  if (!NativeModules.RNGoogleSignin) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  } catch {
    cached = null;
  }
  return cached;
}

function ensureConfigured(mod: GoogleSignInModule) {
  mod.GoogleSignin.configure({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
    scopes: ['openid', 'profile', 'email'],
  });
}

/** Drop the Google session so the next sign-in shows the account picker. */
export async function signOutGoogleNative(options?: { revoke?: boolean }): Promise<void> {
  const mod = getGoogleSignIn();
  if (!mod) return;
  ensureConfigured(mod);
  if (options?.revoke !== false) {
    try {
      await mod.GoogleSignin.revokeAccess();
    } catch {
      /* already signed out */
    }
  }
  try {
    await mod.GoogleSignin.signOut();
  } catch {
    /* ignore */
  }
}

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

/** Native Android DEVELOPER_ERROR (code 10) — Google Cloud OAuth client mismatch. */
export class GoogleAndroidSetupError extends Error {
  readonly packageName = 'dev.dockx.mobile';
  readonly sha1 = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';

  constructor() {
    super(
      'Google Sign-In is blocked on this Android build. The Android OAuth client must use package dev.dockx.mobile and SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25. You also need a Web application OAuth client (not Android or Desktop) as webClientId.',
    );
    this.name = 'GoogleAndroidSetupError';
  }
}

export function isGoogleSignInAvailable(): boolean {
  return getGoogleSignIn() !== null;
}

/**
 * Native Google Sign-In → ID token for `POST /api/auth/google`.
 * Requires a development build that links RNGoogleSignin (`npx expo run:ios`).
 */
export async function signInWithGoogleNative(): Promise<string> {
  const mod = getGoogleSignIn();
  if (!mod) {
    throw new Error(
      'Google Sign-In needs a fresh native build. Run `npx expo run:ios` (Expo Go does not include it).',
    );
  }

  ensureConfigured(mod);
  const { GoogleSignin, isErrorWithCode, statusCodes } = mod;

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  // Clear any leftover Google session without revoking (revoke right before
  // sign-in can fail). Logout still revokes via signOutGoogleNative().
  await signOutGoogleNative({ revoke: false });

  try {
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') {
      throw new GoogleSignInCancelledError();
    }

    // Prefer a freshly fetched token; the sign-in payload sometimes omits it.
    const tokens = await GoogleSignin.getTokens();
    const idToken = tokens.idToken || result.data?.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token.');
    }
    return idToken;
  } catch (error) {
    if (error instanceof GoogleSignInCancelledError) throw error;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new GoogleSignInCancelledError();
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Google sign-in is already in progress.');
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is not available on this device.');
      }
      // Android ApiException 10 — package name / SHA-1 missing from Google Cloud.
      const code = String(error.code);
      if (code === '10' || code === 'DEVELOPER_ERROR' || /DEVELOPER_ERROR/i.test(error.message)) {
        throw new GoogleAndroidSetupError();
      }
    }
    throw error instanceof Error ? error : new Error('Google sign-in failed.');
  }
}
