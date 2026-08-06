import { GlassContainer, GlassView } from 'expo-glass-effect';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { canUseLiquidGlass } from './GlassSurface';

interface GlassButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Circular orb (default) vs rounded capsule. */
  shape?: 'circle' | 'capsule';
  /** Marks this glass as the interactive / selected liquid piece. */
  selected?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/**
 * Pure native Liquid Glass control (iOS 26+). No tint, borders, or overlay fills —
 * just `GlassView` with interactive specular animation.
 */
export function GlassButton({
  onPress,
  children,
  style,
  shape = 'circle',
  selected = false,
  accessibilityLabel,
  disabled,
}: GlassButtonProps) {
  const liquid = canUseLiquidGlass();
  const radius = shape === 'circle' ? 22 : 18;

  const body = (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.hit,
        shape === 'circle' ? styles.circle : styles.capsule,
        { borderRadius: radius },
        pressed && !liquid && { opacity: 0.7 },
      ]}
    >
      {children}
    </Pressable>
  );

  if (!liquid) {
    return (
      <View
        style={[
          styles.fallback,
          shape === 'circle' ? styles.circle : styles.capsule,
          { borderRadius: radius },
          style,
        ]}
      >
        {body}
      </View>
    );
  }

  return (
    <GlassView
      isInteractive
      colorScheme="auto"
      // Never use "clear" here — on many iOS 26 builds it paints an opaque white plate.
      glassEffectStyle={{
        style: 'regular',
        animate: true,
        animationDuration: 0.35,
      }}
      style={[
        shape === 'circle' ? styles.circle : styles.capsule,
        { borderRadius: radius },
        style,
      ]}
    >
      {body}
    </GlassView>
  );
}

/** Groups adjacent glass buttons so the system can morph / merge them. */
export function GlassButtonGroup({
  children,
  spacing = 10,
  style,
}: {
  children: React.ReactNode;
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (!canUseLiquidGlass()) {
    return <View style={[styles.group, style]}>{children}</View>;
  }
  return (
    <GlassContainer spacing={spacing} style={[styles.group, style]}>
      {children}
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 44,
    height: 44,
  },
  capsule: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 12,
  },
  fallback: {
    backgroundColor: 'rgba(127,127,127,0.18)',
    overflow: 'hidden',
  },
});
