import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type LinkPreview = {
  url: string;
  host: string;
  title: string;
  description: string;
  imageUrl: string | null;
  siteName: string;
};

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const PREVIEW_CACHE = new Map<string, { at: number; value: LinkPreview | null }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_HTML_BYTES = 512 * 1024;

export function firstHttpUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(URL_RE);
  if (!match?.[0]) return null;
  return normalizeHref(trimTrailingPunctuation(match[0]));
}

export function trimTrailingPunctuation(raw: string): string {
  return raw.replace(/[),.;:!?'"<>\]]+$/g, '');
}

export function normalizeHref(raw: string): string | null {
  const trimmed = trimTrailingPunctuation(raw.trim());
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.toLowerCase().startsWith('www.')
      ? `https://${trimmed}`
      : null;
  if (!withProtocol) return null;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (isBlockedHost(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan')
  ) {
    return true;
  }
  if (isPrivateIp(host)) return true;
  return false;
}

function isPrivateIp(host: string): boolean {
  const version = isIP(host);
  if (version === 4) {
    const [a, b] = host.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (version === 6) {
    const lower = host.toLowerCase();
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

async function hostResolvesPrivate(hostname: string): Promise<boolean> {
  if (isPrivateIp(hostname)) return true;
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.some((row) => isPrivateIp(row.address));
  } catch {
    return true;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const property = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      'i',
    );
    const contentFirst = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["'][^>]*>`,
      'i',
    );
    const match = html.match(property) ?? html.match(contentFirst);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return '';
}

function pageTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1]) : '';
}

function resolveUrl(base: string, maybeRelative: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return null;
  }
}

function cacheGet(url: string): LinkPreview | null | undefined {
  const hit = PREVIEW_CACHE.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    PREVIEW_CACHE.delete(url);
    return undefined;
  }
  return hit.value;
}

function cacheSet(url: string, value: LinkPreview | null) {
  PREVIEW_CACHE.set(url, { at: Date.now(), value });
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const url = normalizeHref(rawUrl);
  if (!url) return null;
  const cached = cacheGet(url);
  if (cached !== undefined) return cached;

  try {
    const parsed = new URL(url);
    if (await hostResolvesPrivate(parsed.hostname)) {
      cacheSet(url, null);
      return null;
    }

    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'DockXLinkPreview/1.0',
      },
    });
    const finalUrl = response.url || url;
    const finalHost = new URL(finalUrl).hostname;
    if (isBlockedHost(finalHost) || (await hostResolvesPrivate(finalHost))) {
      cacheSet(url, null);
      return null;
    }

    const host = finalHost.replace(/^www\./, '');
    const fallback: LinkPreview = {
      url: finalUrl,
      host,
      title: host,
      description: '',
      imageUrl: null,
      siteName: host,
    };

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      cacheSet(url, fallback);
      return fallback;
    }

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (size < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        size += value.byteLength;
      }
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }
    const html = new TextDecoder('utf-8').decode(
      chunks.reduce((acc, chunk) => {
        const next = new Uint8Array(acc.length + chunk.length);
        next.set(acc);
        next.set(chunk, acc.length);
        return next;
      }, new Uint8Array()),
    );

    const title =
      metaContent(html, ['og:title', 'twitter:title']) || pageTitle(html) || host;
    const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
    const siteName = metaContent(html, ['og:site_name']) || host;
    const imageRaw = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
    const imageUrl = imageRaw ? resolveUrl(finalUrl, imageRaw) : null;

    const preview: LinkPreview = {
      url: finalUrl,
      host,
      title: title.slice(0, 180),
      description: description.slice(0, 280),
      imageUrl,
      siteName: siteName.slice(0, 80),
    };
    cacheSet(url, preview);
    return preview;
  } catch {
    cacheSet(url, null);
    return null;
  }
}
