import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import {
  onAccentColor,
  resolveAccentColor,
  softAccentLabel,
  tintColor,
  useColors,
  useTheme,
} from '@/theme';
import { radius } from '@/theme';

interface BadgeProps {
  label: string;
  color?: string;
  /** Filled badges use the colour as background instead of a tinted pill. */
  solid?: boolean;
  style?: ViewStyle;
  dot?: boolean;
}

export function Badge({ label, color, solid = false, style, dot = false }: BadgeProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const accent = resolveAccentColor(color, colors.brand);

  const softAlpha = isDark ? 0.22 : 0.14;
  const borderAlpha = isDark ? 0.45 : 0.32;

  const backgroundColor = solid ? accent : tintColor(accent, softAlpha);
  const borderColor = solid ? tintColor(accent, isDark ? 0.7 : 0.55) : tintColor(accent, borderAlpha);
  const labelColor = solid ? onAccentColor(accent) : softAccentLabel(accent, isDark);
  const dotColor = solid ? onAccentColor(accent) : accent;

  return (
    <View style={[styles.badge, { backgroundColor, borderColor }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.text, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
