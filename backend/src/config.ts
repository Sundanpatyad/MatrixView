import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load backend/.env from this file's folder so cwd (tsx watch, Cloud Run, etc.)
// cannot silently skip MONGODB_URI / USE_MEMORY_DB.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function envFlag(name: string, fallback = 'false'): boolean {
  return (process.env[name] ?? fallback).trim().toLowerCase() === 'true';
}

const environment = (process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development').toLowerCase();
const isProduction = environment === 'production' || environment === 'prod';
const useMemoryDb = envFlag('USE_MEMORY_DB');

if (isProduction && useMemoryDb) {
  throw new Error(
    'USE_MEMORY_DB=true is not allowed in production. Point MONGODB_URI at Atlas (or another persistent MongoDB).',
  );
}

if (isProduction && !process.env.MONGODB_URI?.trim()) {
  throw new Error(
    'MONGODB_URI is required in production. In-memory MongoDB is disabled there so data cannot vanish on restart.',
  );
}

export const config = {
  environment,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/dockx',
  useMemoryDb,
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32chars'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32chars'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  /** Sliding session when the user checks Remember me (WhatsApp-style). */
  refreshTokenTtlRemember: process.env.REFRESH_TOKEN_TTL_REMEMBER ?? '90d',
  /** Short session when Remember me is off. */
  refreshTokenTtlSession: process.env.REFRESH_TOKEN_TTL_SESSION ?? '1d',
  refreshTokenTtlDesktop: process.env.REFRESH_TOKEN_TTL_DESKTOP ?? '90d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5175')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * Browser app origins (Vercel). Always allowed for CORS + Google returnTo
   * even when CORS_ORIGIN is only set to localhost.
   */
  webAppOrigins: (
    process.env.WEB_APP_ORIGINS ??
    'https://admin-dockx.vercel.app,https://matrix-view.vercel.app,http://localhost:5175,http://localhost:5173'
  )
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  /**
   * Origins used by packaged Tauri / WebView shells. Always allowed so desktop
   * builds can call the API even when CORS_ORIGIN only lists web URLs.
   */
  desktopCorsOrigins: [
    'tauri://localhost',
    'https://tauri.localhost',
    'http://tauri.localhost',
    'http://localhost.tauri.localhost',
    'https://localhost.tauri.localhost',
    'asset://localhost',
    'ipc://localhost',
  ],
  seedEmail: process.env.SEED_EMAIL ?? 'riya@acme.dev',
  seedPassword: process.env.SEED_PASSWORD ?? 'Password123',
  appUrl: (process.env.APP_URL ?? 'http://localhost:5175').replace(/\/$/, ''),
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  /** Gmail app passwords may be pasted with spaces — strip them */
  smtpPass: (process.env.SMTP_PASS ?? '').replace(/\s+/g, ''),
  smtpSecure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    /** Public base URL for objects, e.g. https://pub-xxxx.r2.dev or https://cdn.example.com */
    publicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, ''),
    endpoint:
      process.env.R2_ENDPOINT?.replace(/\/$/, '') ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : ''),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    /**
     * iOS OAuth client ID (from the Google Cloud iOS plist). ID tokens from
     * native Google Sign-In may use this as `aud` instead of the web client.
     * Fallback matches mobile/src/lib/auth/googleSignIn.ts.
     */
    iosClientId:
      process.env.GOOGLE_IOS_CLIENT_ID ??
      '569448299007-1gm4uv3qh7e78m2g3bod169dm93hkoi5.apps.googleusercontent.com',
    /**
     * Android OAuth client ID (Cloud Console "Android" type). Native Android
     * ID tokens may use this as `aud` instead of the web / desktop client.
     */
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
    /**
     * Web application OAuth client ID. Native Android ID tokens are minted
     * for this audience when it is passed as webClientId.
     * Fallback matches mobile/src/lib/auth/googleSignIn.ts.
     */
    webClientId:
      process.env.GOOGLE_WEB_CLIENT_ID ??
      '569448299007-djn2v1re676r3rjcqm84fbrjraddbdnp.apps.googleusercontent.com',
    /** Must match an authorized redirect URI in Google Cloud Console */
    redirectUri: (
      process.env.GOOGLE_REDIRECT_URI ??
      `http://localhost:${process.env.PORT ?? 4000}/api/auth/google/callback`
    ).replace(/\/$/, ''),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    /** PEM with literal \n sequences in .env is expanded at use time */
    privateKey: process.env.FIREBASE_PRIVATE_KEY ?? '',
  },
};
