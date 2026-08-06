import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

/**
 * iOS uses real native blur (or Liquid Glass on iOS 26+). Android Fabric +
 * dimezisBlurView SIGSEGVs in RenderThread on this stack, so Android uses
 * BlurView with blurMethod="none" (tinted translucent material).
 */
export const GLASS_BLUR_SUPPORTED = Platform.OS === 'ios';

/** True when the device can render Apple's Liquid Glass (iOS 26+). */
export function canUseLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return Boolean(isLiquidGlassAvailable() && isGlassEffectAPIAvailable());
  } catch {
    return false;
  }
}

function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;

    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then((value) => {
      if (mounted) setReduced(Boolean(value));
    });

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceTransparencyChanged',
      (value) => setReduced(Boolean(value)),
    );

    return () => {
      mounted = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (subscription as any)?.remove?.();
    };
  }, []);

  return reduced;
}

type GlassEdge = 'top' | 'bottom' | 'all' | 'none';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  /** Hairline separator — blur fallback only; never applied on Liquid Glass. */
  edge?: GlassEdge;
  radius?: number;
  /** iOS 26+ interactive Liquid Glass. Stable for the view lifetime. */
  interactive?: boolean;
}

/**
 * On iOS 26+: pure native `GlassView` — no tintColor, borders, sheens, or overlays.
 * Elsewhere: blur / translucent fallbacks.
 */
export function GlassSurface({
  children,
  intensity = 60,
  style,
  edge = 'none',
  radius,
  interactive = false,
}: GlassSurfaceProps) {
  const { colors, isDark } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const liquid = canUseLiquidGlass() && !reduceTransparency;

  // Never force overflow:'hidden' on Liquid Glass — it flattens into a solid plate.
  const radiusStyle = radius !== undefined ? { borderRadius: radius } : null;

  if (liquid) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="auto"
        isInteractive={interactive}
        style={[radiusStyle, style]}
      >
        {children}
      </GlassView>
    );
  }

  const borderStyle: ViewStyle = {
    borderTopWidth: edge === 'top' || edge === 'all' ? StyleSheet.hairlineWidth : 0,
    borderBottomWidth: edge === 'bottom' || edge === 'all' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.glassBorder,
  };

  if (Platform.OS === 'android') {
    return (
      <BlurView
        intensity={Math.min(100, intensity + 20)}
        tint={isDark ? 'dark' : 'light'}
        blurMethod="none"
        style={[radiusStyle, borderStyle, style, radius !== undefined ? { overflow: 'hidden' } : null]}
      >
        <View
          style={[
            styles.tint,
            {
              backgroundColor: isDark ? 'rgba(24, 25, 28, 0.55)' : 'rgba(255, 255, 255, 0.45)',
            },
          ]}
        />
        {children}
      </BlurView>
    );
  }

  // iOS < 26: system material blur only — no extra glassTint overlay plate.
  return (
    <BlurView
      intensity={intensity}
      tint="systemChromeMaterial"
      style={[radiusStyle, borderStyle, style, radius !== undefined ? { overflow: 'hidden' } : null]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
