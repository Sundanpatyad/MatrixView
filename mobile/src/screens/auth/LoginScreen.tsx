import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { messageFromError } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import type { RootStackParamList } from '@/navigation/types';
import { useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const colors = useColors();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(messageFromError(err, 'Could not sign you in.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up your boards, chats and tasks where you left off."
      footer={
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>New to DockX?</Text>
          <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.brand }]}>Create an account</Text>
          </Pressable>
        </View>
      }
    >
      <Input
        label="Work email"
        placeholder="you@company.com"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
      />

      <Input
        label="Password"
        placeholder="Enter your password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        error={error}
      />

      <Button
        label="Sign in"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
        size="lg"
        fullWidth
      />

      <Text style={[styles.endpoint, { color: colors.textSubtle }]} numberOfLines={1}>
        Connected to {API_BASE}
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
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
  endpoint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -4,
  },
});
