import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Avatar, Badge, Card, ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { pickImages } from '@/lib/pickers';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors, useTheme } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const { isDark, toggle } = useTheme();
  const toast = useToast();
  const { user, isAdmin, logout, logoutEverywhere, uploadAvatar } = useAuth();
  const { projects, tasks } = useWorkspace();
  const { connected, conversations } = useChat();

  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const myTasks = tasks.filter((task) => task.assigneeId === user?.id || task.assigneeName === user?.name);
  const openTasks = myTasks.filter((task) => task.status !== 'done').length;

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

  const confirmLogout = () => {
    Alert.alert('Sign out', 'You will need to sign in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await logout();
        },
      },
    ]);
  };

  const confirmLogoutAll = () => {
    Alert.alert(
      'Sign out everywhere',
      'This ends every active session, including desktop and web. You will need to sign in again on each device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await logoutEverywhere();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader
        title="Profile"
        actions={[
          { icon: 'settings-outline', onPress: () => navigation.navigate('Settings'), accessibilityLabel: 'Settings' },
        ]}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Pressable onPress={changeAvatar} disabled={uploading}>
            <Avatar name={user?.name} uri={user?.avatarUrl} size={92} online={connected} />
            <View style={[styles.cameraBadge, { backgroundColor: colors.brand, borderColor: colors.bg }]}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={14} color="#ffffff" />
            </View>
          </Pressable>

          <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: colors.textSubtle }]}>{user?.email}</Text>

          <View style={styles.badges}>
            <Badge label={user?.role ?? 'Member'} color={isAdmin ? colors.brand : colors.textSubtle} />
            <Badge label={user?.orgName ?? 'Workspace'} color={colors.info} />
            <Badge
              label={connected ? 'Realtime on' : 'Offline'}
              color={connected ? colors.success : colors.textSubtle}
              dot
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Projects" value={projects.length} />
          <Stat label="Open tasks" value={openTasks} />
          <Stat label="Chats" value={conversations.length} />
        </View>

        <Card padded={false} style={styles.card}>
          <ListRow
            icon="person-outline"
            title="Edit profile"
            subtitle="Name, phone number and photo"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Separator />
          <ListRow
            icon={isDark ? 'moon-outline' : 'sunny-outline'}
            title="Appearance"
            value={isDark ? 'Dark' : 'Light'}
            onPress={toggle}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="settings-outline"
            title="Settings"
            subtitle="Theme, connection and app info"
            onPress={() => navigation.navigate('Settings')}
          />
        </Card>

        <Card padded={false} style={styles.card}>
          <ListRow
            icon="log-out-outline"
            title={signingOut ? 'Signing out…' : 'Sign out'}
            subtitle="End this session on this device"
            destructive
            onPress={signingOut ? undefined : confirmLogout}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="shield-outline"
            title="Sign out everywhere"
            subtitle="Revoke every device, including desktop"
            destructive
            onPress={signingOut ? undefined : confirmLogoutAll}
            showChevron={false}
          />
        </Card>

        <Text style={[styles.version, { color: colors.textSubtle }]}>DockX Mobile · v1.0.0</Text>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSubtle }]}>{label}</Text>
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 60 }} />;
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13.5,
    marginTop: 3,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 21,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11.5,
    marginTop: 3,
  },
  card: {
    overflow: 'hidden',
  },
  version: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 4,
  },
});
