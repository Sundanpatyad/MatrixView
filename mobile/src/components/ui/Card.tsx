import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, useColors } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({ children, onPress, style, padded = true }: CardProps) {
  const colors = useColors();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: padded ? 16 : 0,
  };

  if (!onPress) {
    return <View style={[styles.card, base, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, base, pressed && { opacity: 0.8 }, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
