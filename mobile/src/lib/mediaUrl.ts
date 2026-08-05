import { API_BASE } from './config';

/**
 * Uploads served from local disk come back as relative `/uploads/...` paths,
 * while R2 and Cloudinary return absolute URLs.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|file:|content:)/i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}
