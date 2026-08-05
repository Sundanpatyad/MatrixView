import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthPrimaryButton, AuthSocialGroup } from '@/components/auth/AuthActions';
import { AuthField } from '@/components/auth/AuthField';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authApi, messageFromError, type InvitePreview } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { useColors, useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation, route }: Props) {
  const colors = useColors();
  const { isDark } = useTheme();
  const toast = useToast();
  const { register, loginWithGoogle } = useAuth();
  const inviteToken = route.params?.inviteToken;

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

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

  const handleGoogle = async () => {
    if (googleSubmitting || submitting || invite) return;
    setGoogleSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      toast.fromError(err, 'Google sign-in failed.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const bannerFill = isDark ? 'rgba(88, 101, 242, 0.16)' : 'rgba(88, 101, 242, 0.10)';

  return (
    <AuthLayout
      title={invite ? `Join ${invite.orgName}` : 'Create your account'}
      subtitle={
        invite
          ? `You were invited to ${invite.projectName} as ${invite.role}. Set a password to get started.`
          : 'Set up DockX for boards, chat and tasks in one place.'
      }
      onBack={() => navigation.navigate('Welcome')}
      onHelp={() =>
        toast.info('Use a work email. Organisation is optional — we can derive it from your domain.')
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
        <View style={[styles.inviteBanner, { backgroundColor: bannerFill }]}>
          <Text style={[styles.inviteText, { color: colors.brand }]}>
            Invitation to {invite.projectName} · {invite.orgName}
          </Text>
        </View>
      ) : null}

      <AuthField
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />

      <AuthField
        placeholder="Work email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        editable={!invite}
        returnKeyType="next"
      />

      {!invite ? (
        <AuthField
          placeholder="Organisation (optional)"
          value={orgName}
          onChangeText={setOrgName}
          autoCapitalize="words"
          returnKeyType="next"
        />
      ) : null}

      <AuthField
        placeholder="Password · at least 8 characters"
        value={password}
        onChangeText={setPassword}
        password
        returnKeyType="go"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
        error={error}
      />

      <AuthPrimaryButton
        label={invite ? 'Join workspace' : 'Continue'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit || googleSubmitting}
      />

      {!invite ? <AuthSocialGroup onGoogle={handleGoogle} loading={googleSubmitting} /> : null}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
