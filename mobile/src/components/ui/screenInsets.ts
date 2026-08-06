import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canUseLiquidGlass } from './GlassSurface';
import { useFloatingHeaderHeight } from './AppHeader';

const NATIVE_TAB_CLEARANCE = 49;

/**
 * Clearance under a floating `AppHeader` and above the tab bar.
 * Always includes the floating header height — do not replace this with
 * `contentInsetAdjustmentBehavior` alone (that only covers system chrome,
 * not our custom header).
 */
export function useGlassScreenPadding(): { top: number; bottom: number } {
  const top = useFloatingHeaderHeight();
  const bottom = useTabBarPadding();
  return { top, bottom };
}

/** Bottom clearance for FABs / lists above the tab bar. */
export function useTabBarPadding(): number {
  const context = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  if (context != null) return context;
  if (Platform.OS === 'ios' && canUseLiquidGlass()) {
    return insets.bottom + NATIVE_TAB_CLEARANCE;
  }
  // JS tab bar / Android: home indicator only when context is missing
  // (e.g. stack screens). Tab screens normally get context from the navigator.
  return Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
}

/**
 * Reserved. Floating headers must keep manual `pad.top` — system automatic
 * insets do not account for AppHeader.
 */
export function useNativeScrollInsets(): boolean {
  return false;
}
