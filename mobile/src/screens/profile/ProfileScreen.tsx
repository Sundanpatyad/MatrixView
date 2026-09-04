import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  ListRow,
  Screen,
  useGlassScreenPadding,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { pickImages } from '@/lib/pickers';
import type { RootStackParamList } from '@/navigation/types';
import { useColors, useTheme } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const { isDark, toggle } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, logout, logoutEverywhere, uploadAvatar } = useAuth();
  const { connected } = useChat();
  const { projects, isProjectAdmin } = useWorkspace();
  const pad = useGlassScreenPadding();
  const adminAnywhere = projects.some((project) => isProjectAdmin(project.id));

  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const changeAvatar = async () => {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      setUploading(true);
      await uploadAvatar(file);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.fromError(error, 'Could not update your photo.');
    } finally {
      setUploading(false);
    }
  };

  const confirmLogout = async () => {
    const ok = await confirm({
      title: 'Sign out',
      message: 'You will need to sign in again on this device.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!ok) return;
    setSigningOut(true);
    await logout();
  };

  const confirmLogoutAll = async () => {
    const ok = await confirm({
      title: 'Sign out everywhere',
      message:
        'This ends every active session, including desktop and web. You will need to sign in again on each device.',
      confirmLabel: 'Sign out everywhere',
      destructive: true,
    });
    if (!ok) return;
    setSigningOut(true);
    await logoutEverywhere();
  };

  return (
    <Screen edges={[]}>
      {/* BlurView must mount after scroll content so Android can sample it. */}
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: pad.top + 8,
            paddingBottom: pad.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.hero} onPress={changeAvatar} disabled={uploading}>
          <View>
            <Avatar name={user?.name} uri={user?.avatarUrl} size={96} online={connected} />
            <View style={[styles.cameraBadge, { backgroundColor: colors.brand, borderColor: colors.bg }]}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={14} color="#ffffff" />
            </View>
          </View>

          <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.meta, { color: colors.textSubtle }]}>{user?.email}</Text>
          {user?.orgName ? (
            <Text style={[styles.org, { color: colors.textMuted }]}>
              {user.orgName}
              {user.role ? ` · ${user.role}` : ''}
            </Text>
          ) : null}
        </Pressable>

        <Section>
          {adminAnywhere ? (
            <>
              <ListRow
                icon="pulse-outline"
                iconBackground={colors.successSoft}
                iconColor={colors.success}
                title="Team activity"
                subtitle="Check-ins, software, and websites"
                onPress={() => navigation.navigate('TeamActivity')}
              />
              <Separator />
            </>
          ) : null}
          <ListRow
            icon="person-outline"
            iconBackground={colors.brandSoft}
            iconColor={colors.brand}
            title="Edit profile"
            subtitle="Name, phone and photo"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Separator />
          <ListRow
            icon={isDark ? 'moon' : 'sunny'}
            iconBackground={colors.warningSoft}
            iconColor={colors.warning}
            title="Appearance"
            value={isDark ? 'Dark' : 'Light'}
            onPress={toggle}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="settings-outline"
            iconBackground={colors.infoSoft}
            iconColor={colors.info}
            title="Settings"
            subtitle="Theme, connection and app info"
            onPress={() => navigation.navigate('Settings')}
          />
        </Section>

        <Section>
          <ListRow
            icon="log-out-outline"
            title={signingOut ? 'Signing out…' : 'Sign out'}
            destructive
            onPress={signingOut ? undefined : () => void confirmLogout()}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="phone-portrait-outline"
            title="Sign out everywhere"
            subtitle="End sessions on all devices"
            destructive
            onPress={signingOut ? undefined : () => void confirmLogoutAll()}
            showChevron={false}
          />
        </Section>

        <Text style={[styles.version, { color: colors.textSubtle }]}>DockX · v1.0.0</Text>
      </ScrollView>

      <AppHeader
        floating
        title="Profile"
        actions={[
          { icon: 'settings-outline', onPress: () => navigation.navigate('Settings'), accessibilityLabel: 'Settings' },
        ]}
      />
    </Screen>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 0.15,
  },
  meta: {
    fontSize: 14,
    marginTop: 4,
  },
  org: {
    fontSize: 13,
    marginTop: 6,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
