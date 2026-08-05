import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { radius, useColors } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number; icon: number }> = {
  sm: { height: 36, paddingHorizontal: 14, fontSize: 13, icon: 15 },
  md: { height: 46, paddingHorizontal: 18, fontSize: 15, icon: 17 },
  lg: { height: 54, paddingHorizontal: 22, fontSize: 16, icon: 19 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  fullWidth = false,
  style,
}: ButtonProps) {
  const colors = useColors();
  const metrics = SIZES[size];
  const isDisabled = disabled || loading;

  const palette = useMemo(() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surfaceAlt, fg: colors.text, border: colors.border };
      case 'ghost':
        return { bg: 'transparent', fg: colors.textMuted, border: 'transparent' };
      case 'danger':
        return { bg: colors.danger, fg: '#ffffff', border: colors.danger };
      case 'subtle':
        return { bg: colors.brandSoft, fg: colors.brand, border: colors.brandBorder };
      default:
        return { bg: colors.brand, fg: colors.onBrand, border: colors.brand };
    }
  }, [colors, variant]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: metrics.height,
          paddingHorizontal: metrics.paddingHorizontal,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={metrics.icon} color={palette.fg} /> : null}
          <Text style={[styles.label, { color: palette.fg, fontSize: metrics.fontSize }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={metrics.icon} color={palette.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
