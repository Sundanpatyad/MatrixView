export type ThemeMode = 'light' | 'dark';

export interface Palette {
  brand: string;
  brandStrong: string;
  brandSoft: string;
  brandBorder: string;
  onBrand: string;

  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  surfaceSunken: string;

  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  overlay: string;
  /** Scrim for platforms where the backdrop cannot be blurred. */
  overlayStrong: string;
  skeleton: string;
  track: string;

  /**
   * Glass surfaces sit over scrolling content: the blur supplies the depth and
   * these translucent layers supply the colour, so they must never be opaque.
   */
  glassTint: string;
  glassBorder: string;
  glassHighlight: string;
}

const brand = '#5865f2';

export const darkPalette: Palette = {
  brand,
  brandStrong: '#4752c4',
  brandSoft: 'rgba(88, 101, 242, 0.16)',
  brandBorder: 'rgba(88, 101, 242, 0.42)',
  onBrand: '#ffffff',

  bg: '#111214',
  bgElevated: '#1e1f22',
  surface: '#1e1f22',
  surfaceAlt: '#2b2d31',
  surfaceHover: '#313338',
  surfaceSunken: '#0c0d0f',

  border: '#2b2d31',
  borderStrong: '#3f4147',

  text: '#f2f3f5',
  textMuted: '#b5bac1',
  textSubtle: '#80848e',
  textInverse: '#111214',

  success: '#23a559',
  successSoft: 'rgba(35, 165, 89, 0.16)',
  warning: '#f0b232',
  warningSoft: 'rgba(240, 178, 50, 0.16)',
  danger: '#ed4245',
  dangerSoft: 'rgba(237, 66, 69, 0.16)',
  info: '#00a8fc',
  infoSoft: 'rgba(0, 168, 252, 0.16)',

  // Paired with a blurred backdrop, so lighter than a standalone scrim.
  overlay: 'rgba(0, 0, 0, 0.45)',
  overlayStrong: 'rgba(0, 0, 0, 0.68)',
  skeleton: '#26282c',
  track: '#383a40',

  glassTint: 'rgba(24, 25, 28, 0.55)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 0.06)',
};

export const lightPalette: Palette = {
  brand,
  brandStrong: '#4752c4',
  brandSoft: 'rgba(88, 101, 242, 0.10)',
  brandBorder: 'rgba(88, 101, 242, 0.32)',
  onBrand: '#ffffff',

  bg: '#f4f5f8',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f7f8fb',
  surfaceHover: '#eef0f4',
  surfaceSunken: '#e9ebf0',

  border: '#e3e5e8',
  borderStrong: '#d0d3d9',

  text: '#111214',
  textMuted: '#4e5058',
  textSubtle: '#80848e',
  textInverse: '#ffffff',

  success: '#1f8f4d',
  successSoft: 'rgba(35, 165, 89, 0.12)',
  warning: '#c98a13',
  warningSoft: 'rgba(240, 178, 50, 0.16)',
  danger: '#d83c3e',
  dangerSoft: 'rgba(237, 66, 69, 0.12)',
  info: '#0083c4',
  infoSoft: 'rgba(0, 168, 252, 0.12)',

  overlay: 'rgba(17, 18, 20, 0.28)',
  overlayStrong: 'rgba(17, 18, 20, 0.48)',
  skeleton: '#e6e8ec',
  track: '#d6d9dc',

  glassTint: 'rgba(255, 255, 255, 0.62)',
  glassBorder: 'rgba(17, 18, 20, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 0.55)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 26,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

/**
 * Column accents and task-type colours are shared with the desktop client so a
 * board looks identical across platforms.
 */
export const statusAccent: Record<string, string> = {
  todo: '#80848e',
  in_progress: '#f0b232',
  review: '#00a8fc',
  done: '#23a559',
};

export const taskTypeColor: Record<string, string> = {
  task: '#00a8fc',
  bug: '#ed4245',
  story: '#23a559',
  time: '#f0b232',
};

export const priorityColor: Record<string, string> = {
  lowest: '#80848e',
  low: '#00a8fc',
  medium: '#f0b232',
  high: '#f0733d',
  highest: '#ed4245',
};

export const avatarColors = [
  '#5865f2',
  '#eb459e',
  '#23a559',
  '#f0b232',
  '#00a8fc',
  '#ed4245',
  '#9b59f6',
  '#00c2a8',
];
