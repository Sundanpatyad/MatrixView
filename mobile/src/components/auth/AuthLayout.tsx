import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shown as a circular top-left control (typically back on Register). */
  onBack?: () => void;
  onHelp?: () => void;
}

export function AuthLayout({ title, subtitle, children, footer, onBack, onHelp }: AuthLayoutProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Match the reference: near-black / pure white canvases, no gradient card chrome.
  const canvas = isDark ? '#000000' : '#ffffff';
  const chipBg = isDark ? '#1c1c1e' : '#f2f2f7';

  return (
    <View style={[styles.root, { backgroundColor: canvas }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            },
          ]}
        >
          <View style={styles.topBar}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                accessibilityLabel="Go back"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: chipBg },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.chipSpacer} />
            )}

            {onHelp ? (
              <Pressable
                onPress={onHelp}
                accessibilityLabel="Help"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: chipBg },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="help" size={18} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.chipSpacer} />
            )}
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

          <View style={styles.body}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    minHeight: 40,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSpacer: {
    width: 40,
    height: 40,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 340,
  },
  body: {
    marginTop: 28,
    gap: 14,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    alignItems: 'center',
  },
});
