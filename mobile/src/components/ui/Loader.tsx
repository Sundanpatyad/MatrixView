import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { radius, useColors } from '@/theme';

export function LoadingView({ label }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
      {label ? <Text style={[styles.label, { color: colors.textSubtle }]}>{label}</Text> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width, radius: r = radius.sm }: { height?: number; width?: number | string; radius?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        height,
        width: (width ?? '100%') as number,
        borderRadius: r,
        backgroundColor: colors.skeleton,
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  label: {
    fontSize: 13,
  },
});
