import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * expo-blur only blurs on Android when handed a `blurTarget` ref pointing at a
 * `BlurTargetView` wrapping the content to sample, which would mean threading a
 * ref through every screen and does not work across a Modal boundary. Without
 * it the view is merely translucent, and translucent-without-blur reads as a
 * bug rather than a style, so Android gets an opaque elevated surface instead.
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

  if (!GLASS_BLUR_SUPPORTED) {
    return (
      <View style={[{ backgroundColor: colors.bgElevated }, radiusStyle, borderStyle, style]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={[radiusStyle, borderStyle, style]}
    >
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
});
