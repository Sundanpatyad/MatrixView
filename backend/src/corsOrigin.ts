import { config } from './config.js';

const listedOrigins = new Set([
  ...config.corsOrigin,
  ...config.desktopCorsOrigins,
  ...config.webAppOrigins,
  config.appUrl,
]);

function isDockxVercelHost(host: string): boolean {
  if (
    host === 'matrix-view.vercel.app' ||
    host === 'admin-dockx.vercel.app' ||
    host === 'dockx.vercel.app'
  ) {
    return true;
  }
  return (
    host.endsWith('.vercel.app') &&
    (host.includes('matrix-view') ||
      host.includes('matrixview') ||
      host.includes('dockx') ||
      host.includes('admin-dockx'))
  );
}

/** Browser / Vercel / Tauri origins that may call the API (CORS + Google returnTo). */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (listedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    return isDockxVercelHost(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
