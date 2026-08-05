import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { authApi, messageFromError, type InvitePreview } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation, route }: Props) {
  const colors = useColors();
  const { register } = useAuth();
  const inviteToken = route.params?.inviteToken;

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    authApi
      .fetchInviteRequest(inviteToken)
      .then(({ invite: preview }) => {
        if (cancelled) return;
        setInvite(preview);
        setEmail(preview.email);
        if (preview.name) setName(preview.name);
      })
      .catch((err) => {
        if (!cancelled) setError(messageFromError(err, 'This invite link is no longer valid.'));
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const canSubmit = name.trim().length > 1 && email.trim().length > 3 && password.length >= 8;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({
        name,
        email,
        password,
        orgName: orgName.trim() || undefined,
        inviteToken,
      });
    } catch (err) {
      setError(messageFromError(err, 'Could not create your account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={invite ? `Join ${invite.orgName}` : 'Create your workspace'}
      subtitle={
        invite
          ? `You were invited to ${invite.projectName} as ${invite.role}. Set a password to get started.`
          : 'Set up an account to run projects, boards and team chat in one place.'
      }
      footer={
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Already have an account?</Text>
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.brand }]}>Sign in</Text>
          </Pressable>
        </View>
      }
    >
      {invite ? (
        <View style={[styles.inviteBanner, { backgroundColor: colors.brandSoft, borderColor: colors.brandBorder }]}>
          <Text style={[styles.inviteText, { color: colors.brand }]}>
            Invitation to {invite.projectName} · {invite.orgName}
          </Text>
        </View>
      ) : null}

      <Input
        label="Full name"
        placeholder="Riya Sharma"
        icon="person-outline"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
      />

      <Input
        label="Work email"
        placeholder="you@company.com"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        editable={!invite}
      />

      {!invite ? (
        <Input
          label="Organisation"
          placeholder="Acme Inc."
          icon="business-outline"
          value={orgName}
          onChangeText={setOrgName}
          autoCapitalize="words"
          hint="Leave blank to use your email domain."
        />
      ) : null}

      <Input
        label="Password"
        placeholder="At least 8 characters"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        password
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        error={error}
      />

      <Button
        label={invite ? 'Join workspace' : 'Create account'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
        size="lg"
        fullWidth
      />
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
  inviteBanner: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
