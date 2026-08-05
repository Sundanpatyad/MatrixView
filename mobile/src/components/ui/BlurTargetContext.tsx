import React, { createContext, useContext, type RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

/** @deprecated Android no longer uses BlurTargetView (dimezis crashes on Fabric). */
export function useBlurTargetRef(): RefObject<View | null> | null {
  return useContext(BlurTargetContext);
}

/** @deprecated Always true — kept for older imports. */
export function useBlurTargetReady(): boolean {
  return true;
}

interface BlurTargetRootProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Passthrough wrapper kept so existing call sites compile. */
export function BlurTargetRoot({ children, style }: BlurTargetRootProps) {
  return <View style={[styles.fill, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
