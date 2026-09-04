import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type ViewStyle } from 'react-native';

interface KeyboardAwareProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Extra offset for a stacked header above this view (iOS). */
  offset?: number;
}

/**
 * iOS: padding-based KeyboardAvoidingView.
 * Android: the activity resizes (`softwareKeyboardLayoutMode: resize`); extra
 * padding here would double-shift. Bottom sheets use `useKeyboardHeight`
 * instead because they render in a Modal that does not resize.
 */
export function KeyboardAware({ children, style, offset = 0 }: KeyboardAwareProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.fill, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
