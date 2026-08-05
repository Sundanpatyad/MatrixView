import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/theme';

interface AuthPrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AuthPrimaryButton({ label, onPress, disabled, loading }: AuthPrimaryButtonProps) {
  const { colors, isDark } = useTheme();
  const isDisabled = Boolean(disabled || loading);

  // Enabled: brand fill. Disabled: muted chip so it still reads as a control.
  const backgroundColor = isDisabled ? (isDark ? '#3a3a3c' : '#d1d1d6') : colors.brand;
  const labelColor = isDisabled ? '#8e8e93' : colors.onBrand;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor },
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.primaryLabel, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function AuthDivider() {
  const { colors } = useTheme();

  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: colors.borderStrong }]} />
      <Text style={[styles.dividerText, { color: colors.textSubtle }]}>or</Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.borderStrong }]} />
    </View>
  );
}

function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

export function AuthGoogleButton({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const fill = isDark ? '#1c1c1e' : '#f2f2f7';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.social,
        { backgroundColor: fill, opacity: loading ? 0.7 : 1 },
        pressed && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <GoogleMark />
          <Text style={[styles.socialLabel, { color: colors.text }]}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

/** Google-only social block (Apple sign-in is not offered on this build). */
export function AuthSocialGroup({
  onGoogle,
  loading,
}: {
  onGoogle: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.socialGroup}>
      <AuthDivider />
      <AuthGoogleButton onPress={onGoogle} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 6,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  socialGroup: {
    gap: 12,
    marginTop: 4,
  },
  social: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  socialLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  googleMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 20,
  },
});
