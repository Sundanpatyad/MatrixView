import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/theme';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const gradient = isDark
    ? (['#111214', '#171922', '#1b1e33'] as const)
    : (['#f8f9ff', '#f2f3f5', '#eef0ff'] as const);

  return (
    <LinearGradient colors={gradient} style={styles.root}>
      <View
        style={[
          styles.glow,
          { backgroundColor: colors.brand, top: -height * 0.18, opacity: isDark ? 0.22 : 0.14 },
        ]}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={[styles.mark, { backgroundColor: colors.brand }]}>
              <Text style={styles.markText}>DX</Text>
            </View>
            <Text style={[styles.brandName, { color: colors.text }]}>DockX</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? 'rgba(30, 31, 34, 0.86)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: colors.border,
              },
            ]}
          >
            {children}
          </View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  scroll: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
  },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
  },
  card: {
    marginTop: 28,
    padding: 22,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: 16,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
});
