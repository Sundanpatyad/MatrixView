import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color, height = 6 }: ProgressBarProps) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  return (
    <View style={[styles.track, { backgroundColor: colors.track, height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? colors.brand,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
});
