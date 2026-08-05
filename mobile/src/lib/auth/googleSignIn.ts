import { NativeModules, Platform } from 'react-native';

/**
 * iOS OAuth client from Google Cloud Console (plist CLIENT_ID).
 * Must match CFBundleURLSchemes / iosUrlScheme in app.json.
 */
const IOS_CLIENT_ID =
  '569448299007-1gm4uv3qh7e78m2g3bod169dm93hkoi5.apps.googleusercontent.com';

/**
 * Web / installed client used by the DockX API. Passing it as webClientId asks
 * Google to mint an ID token the backend can verify with GOOGLE_CLIENT_ID.
 */
const WEB_CLIENT_ID =
  '569448299007-cdg0qbh5bmphaun5tr8jbdlkkg2rso6q.apps.googleusercontent.com';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let cached: GoogleSignInModule | null | undefined;
let configured = false;

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
  if (configured) return;
  mod.GoogleSignin.configure({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
    scopes: ['openid', 'profile', 'email'],
  });
  configured = true;
}

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
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
    }
    throw error instanceof Error ? error : new Error('Google sign-in failed.');
  }
}
