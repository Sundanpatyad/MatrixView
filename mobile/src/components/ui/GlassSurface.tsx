import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Android renders a plain translucent view unless a blur method is requested,
 * and the SDK 31+ variant avoids the known jank on older devices.
 */
const ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;

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

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      blurMethod={Platform.OS === 'android' ? ANDROID_BLUR_METHOD : undefined}
      style={[
        radius !== undefined ? { borderRadius: radius, overflow: 'hidden' } : null,
        borderStyle,
        style,
      ]}
    >
      <View
        style={[
          styles.tint,
          { backgroundColor: colors.glassTint },
          radius !== undefined ? { borderRadius: radius } : null,
        ]}
      />
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
