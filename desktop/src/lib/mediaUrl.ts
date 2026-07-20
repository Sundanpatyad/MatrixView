import { API_BASE } from '@/lib/api/client';

/** Turn relative /uploads paths into absolute API URLs for <audio>/<img>/<video>. */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE}${path}`;
}
