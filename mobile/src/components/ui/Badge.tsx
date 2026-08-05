import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { radius, useColors, useTheme } from '@/theme';

interface BadgeProps {
  label: string;
  color?: string;
  /** Filled badges use the colour as background instead of a tinted pill. */
  solid?: boolean;
  style?: ViewStyle;
  dot?: boolean;
}

function tint(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Badge({ label, color, solid = false, style, dot = false }: BadgeProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const accent = color ?? colors.brand;
  const softAlpha = isDark ? 0.22 : 0.12;
  const borderAlpha = isDark ? 0.4 : 0.28;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: solid ? accent : tint(accent, softAlpha),
          borderColor: solid ? accent : tint(accent, borderAlpha),
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: solid ? '#ffffff' : accent }]} /> : null}
      <Text style={[styles.text, { color: solid ? '#ffffff' : accent }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
