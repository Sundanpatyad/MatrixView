/**
 * Board column accents are stored as Tailwind-style class names (shared with
 * desktop). Mobile needs a real hex/rgba for RN styles.
 */

const NAMED_ACCENTS: Record<string, string> = {
  'bg-ink-300': '#5c5e66',
  'bg-ink-400': '#6d6f78',
  'bg-ink-500': '#80848e',
  'bg-ink-600': '#383a40',
  'bg-brand-500': '#4BDE80',
  'bg-brand-600': '#2FC46A',
  'bg-brand-300': '#2FC46A',
  'bg-brand-400': '#4BDE80',
};

function normalizeHex(hex: string): string | null {
  const raw = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(raw)) return `#${raw.slice(0, 6).toLowerCase()}`;
  return null;
}

/** Convert `bg-[#4BDE80]`, `#4BDE80`, or `bg-ink-500` → `#4bde80`. */
export function resolveAccentColor(value?: string | null, fallback = '#4BDE80'): string {
  if (!value) return fallback;
  const trimmed = value.trim();

  const bracket = trimmed.match(/#([0-9a-fA-F]{3,8})/);
  if (bracket) {
    return normalizeHex(bracket[1]) ?? fallback;
  }

  if (trimmed.startsWith('#')) {
    return normalizeHex(trimmed) ?? fallback;
  }

  const named = NAMED_ACCENTS[trimmed] ?? NAMED_ACCENTS[trimmed.replace(/\/\d+$/, '')];
  if (named) return named;

  return fallback;
}

export function tintColor(hex: string, alpha: number): string {
  const normalized = resolveAccentColor(hex, hex);
  const value = normalized.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(75, 222, 128, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Relative luminance 0–1 for sRGB hex. */
export function accentLuminance(hex: string): number {
  const normalized = resolveAccentColor(hex, '#80848e').replace('#', '');
  const channel = (start: number) => {
    const c = parseInt(normalized.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(0);
  const g = channel(2);
  const b = channel(4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text/icon colour that stays readable on a solid accent fill. */
export function onAccentColor(hex: string): string {
  return accentLuminance(hex) > 0.55 ? '#062816' : '#ffffff';
}

/**
 * Soft (tinted) badge label colour — slightly stronger in light mode so pale
 * accents like yellow/green stay legible on washed backgrounds.
 */
export function softAccentLabel(hex: string, isDark: boolean): string {
  const accent = resolveAccentColor(hex);
  if (isDark) return accent;
  // Darken bright accents a touch for light-mode soft pills.
  if (accentLuminance(accent) > 0.45) {
    return tintToward(accent, '#111214', 0.28);
  }
  return accent;
}

function tintToward(hex: string, toward: string, amount: number): string {
  const a = resolveAccentColor(hex).replace('#', '');
  const b = resolveAccentColor(toward).replace('#', '');
  const mix = (i: number) => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}
