import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * iOS uses real native blur. Android Fabric + dimezisBlurView SIGSEGVs in
 * RenderThread on this stack, so Android uses BlurView with blurMethod="none"
 * (tinted translucent material) which still reads as glass over scrolling content.
 */
export const GLASS_BLUR_SUPPORTED = Platform.OS === 'ios';

type GlassEdge = 'top' | 'bottom' | 'all' | 'none';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  /** Which side gets the hairline separator that reads as the pane's edge. */
  edge?: GlassEdge;
  radius?: number;
}

export function GlassSurface({
  children,
  intensity = 60,
  style,
  edge = 'none',
  radius,
}: GlassSurfaceProps) {
  const { colors, isDark } = useTheme();

  const borderStyle: ViewStyle = {
    borderTopWidth: edge === 'top' || edge === 'all' ? StyleSheet.hairlineWidth : 0,
    borderBottomWidth: edge === 'bottom' || edge === 'all' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.glassBorder,
  };

  const radiusStyle = radius !== undefined ? { borderRadius: radius, overflow: 'hidden' as const } : null;

  // Android: translucent material glass (no dimezis capture — that crashes Fabric).
  if (Platform.OS === 'android') {
    return (
      <BlurView
        intensity={Math.min(100, intensity + 20)}
        tint={isDark ? 'dark' : 'light'}
        blurMethod="none"
        style={[radiusStyle, borderStyle, style]}
      >
        <View
          style={[
            styles.tint,
            {
              backgroundColor: isDark ? 'rgba(24, 25, 28, 0.72)' : 'rgba(255, 255, 255, 0.72)',
            },
            radiusStyle,
          ]}
        />
        {/* Top highlight so the pane reads as glass, not a flat wash. */}
        <View
          pointerEvents="none"
          style={[
            styles.sheen,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)',
            },
          ]}
        />
        {children}
      </BlurView>
    );
  }

  return (
    <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={[radiusStyle, borderStyle, style]}>
      <View style={[styles.tint, { backgroundColor: colors.glassTint }, radiusStyle]} />
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
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
});
