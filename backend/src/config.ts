import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const config = {
  environment: process.env.ENVIRONMENT ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/dockx',
  useMemoryDb: (process.env.USE_MEMORY_DB ?? 'false').toLowerCase() === 'true',
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32chars'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32chars'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDesktop: process.env.REFRESH_TOKEN_TTL_DESKTOP ?? '30d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5175')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
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
};
