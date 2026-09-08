export type LinkKind = 'url' | 'email' | 'phone';

export type LinkToken =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string; kind: LinkKind };

const TOKEN_RE =
  /((?:https?:\/\/|www\.)[^\s<>"'`]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\+?\d[\d\s().-]{7,}\d)/g;

function trimTrailingPunctuation(raw: string): string {
  return raw.replace(/[),.;:!?'"<>\]]+$/g, '');
}

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

export function hrefForUrl(raw: string): string | null {
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
    return parsed.href;
  } catch {
    return null;
  }
}

export function firstHttpUrl(text: string): string | null {
  if (!text) return null;
  for (const token of tokenizeLinks(text)) {
    if (token.type === 'link' && token.kind === 'url') return token.href;
  }
  return null;
}

export function tokenizeLinks(text: string): LinkToken[] {
  if (!text) return [];
  const tokens: LinkToken[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text))) {
    const index = match.index;
    if (index > last) tokens.push({ type: 'text', value: text.slice(last, index) });

    if (match[1]) {
      const display = trimTrailingPunctuation(match[1]);
      const href = hrefForUrl(display);
      if (href) tokens.push({ type: 'link', value: display, href, kind: 'url' });
      else tokens.push({ type: 'text', value: match[1] });
    } else if (match[2]) {
      const email = match[2];
      tokens.push({ type: 'link', value: email, href: `mailto:${email}`, kind: 'email' });
    } else if (match[3] && digitCount(match[3]) >= 8) {
      const phone = match[3];
      const href = `tel:${phone.replace(/[^\d+]/g, '')}`;
      tokens.push({ type: 'link', value: phone, href, kind: 'phone' });
    } else {
      tokens.push({ type: 'text', value: match[0] });
    }
    last = index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }];
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
