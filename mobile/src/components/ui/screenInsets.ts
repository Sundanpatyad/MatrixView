import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';

import { useFloatingHeaderHeight } from './AppHeader';

/**
 * Padding for screens whose glass header and tab bar float above the scroll
 * area. The tab bar height comes from context rather than `useBottomTabBarHeight`
 * so stack screens outside the tab navigator get zero instead of throwing.
 */
export function useGlassScreenPadding(): { top: number; bottom: number } {
  const top = useFloatingHeaderHeight();
  const bottom = useContext(BottomTabBarHeightContext) ?? 0;
  return { top, bottom };
}

/** Bottom-only variant for screens that scroll their own header. */
export function useTabBarPadding(): number {
  return useContext(BottomTabBarHeightContext) ?? 0;
}
