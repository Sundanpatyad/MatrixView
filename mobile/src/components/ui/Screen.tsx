import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useColors } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  /** Use the elevated surface colour, e.g. for modal-style stacks. */
  elevated?: boolean;
}

export function Screen({ children, edges = ['top'], style, elevated = false }: ScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: elevated ? colors.bgElevated : colors.bg }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

export function ScreenBody({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.body, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 16 },
});
