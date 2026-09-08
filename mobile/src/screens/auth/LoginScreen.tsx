import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthPrimaryButton, AuthSocialGroup } from '@/components/auth/AuthActions';
import { AuthField } from '@/components/auth/AuthField';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { messageFromError } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { GoogleAndroidSetupError } from '@/lib/auth/googleSignIn';
import type { RootStackParamList } from '@/navigation/types';
import { useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const colors = useColors();
  const toast = useToast();
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password, rememberMe);
    } catch (err) {
      setError(messageFromError(err, 'Could not sign you in.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (googleSubmitting || submitting) return;
    setGoogleSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle(rememberMe);
    } catch (err) {
      if (err instanceof GoogleAndroidSetupError) {
        Alert.alert(
          'Google Sign-In setup',
          [
            'Google rejected this Android app (error 10).',
            '',
            `Package: ${err.packageName}`,
            `SHA-1: ${err.sha1}`,
            '',
            'In Google Cloud → Credentials, open the Android OAuth client and set that exact SHA-1 (not SHA-256).',
            '',
            'Also create an OAuth client of type Web application. Android/Desktop clients cannot be used as webClientId.',
          ].join('\n'),
        );
        return;
      }
      toast.fromError(err, 'Google sign-in failed.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const showHelp = () => {
    Alert.alert(
      'Need a hand?',
      `Sign in with Google or the work email your admin invited. This build talks to:\n\n${API_BASE}`,
      [{ text: 'OK' }],
    );
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter the email associated with your DockX account"
      onBack={() => navigation.navigate('Welcome')}
      onHelp={showHelp}
      footer={
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>New to DockX?</Text>
          <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.brand }]}>Create an account</Text>
          </Pressable>
        </View>
      }
    >
      <AuthField
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        textContentType="emailAddress"
        autoCorrect={false}
      />

      <AuthField
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="password"
        returnKeyType="go"
        textContentType="password"
        onSubmitEditing={handleSubmit}
        error={error}
      />

      <Pressable
        onPress={() => setRememberMe((value) => !value)}
        hitSlop={6}
        style={styles.rememberRow}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: rememberMe ? colors.brand : colors.textSubtle,
              backgroundColor: rememberMe ? colors.brand : 'transparent',
            },
          ]}
        >
          {rememberMe ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={[styles.rememberLabel, { color: colors.textMuted }]}>
          Remember me on this device
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          Alert.alert(
            'Reset password',
            'Password reset is not available in the mobile app yet. Ask your workspace admin, or use the desktop app.',
            [{ text: 'OK' }],
          )
        }
        hitSlop={6}
        style={styles.linkWrap}
      >
        <Text style={[styles.link, { color: colors.brand }]}>Lost access to my email</Text>
      </Pressable>

      <AuthPrimaryButton
        label="Continue"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit || googleSubmitting}
      />

      <AuthSocialGroup onGoogle={handleGoogle} loading={googleSubmitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  checkbox: {
    height: 18,
    width: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },
  rememberLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkWrap: {
    alignSelf: 'flex-start',
    marginTop: -2,
    marginBottom: 2,
    paddingVertical: 2,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
