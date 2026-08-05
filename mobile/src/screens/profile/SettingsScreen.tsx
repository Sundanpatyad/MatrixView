import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Card, ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import { API_BASE } from '@/lib/config';
import { ensureSocketConnected } from '@/lib/socket/socket';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors, useTheme, type ThemePreference } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function SettingsScreen({ navigation }: Props) {
  const colors = useColors();
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const { user, logout, logoutEverywhere } = useAuth();
  const { connected, refresh } = useChat();

  const confirmLogout = (everywhere: boolean) => {
    Alert.alert(
      everywhere ? 'Sign out everywhere' : 'Sign out',
      everywhere
        ? 'This revokes every active session, including desktop and web.'
        : 'You will need to sign in again on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: everywhere ? 'Sign out everywhere' : 'Sign out',
          style: 'destructive',
          onPress: () => void (everywhere ? logoutEverywhere() : logout()),
        },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader title="Settings" showBack />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="Appearance">
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const active = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setPreference(option.value)}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor: active ? colors.brandSoft : colors.surfaceAlt,
                      borderColor: active ? colors.brandBorder : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.themeLabel, { color: active ? colors.brand : colors.textMuted }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Connection">
          <Card padded={false} style={styles.card}>
            <ListRow
              icon={connected ? 'flash' : 'flash-off-outline'}
              iconColor={connected ? colors.success : colors.warning}
              title="Realtime"
              value={connected ? 'Connected' : 'Reconnecting'}
              showChevron={false}
            />
            <Separator />
            <ListRow icon="server-outline" title="API endpoint" subtitle={API_BASE} showChevron={false} />
            <Separator />
            <ListRow
              icon="refresh-outline"
              title="Reconnect and sync"
              subtitle="Force a fresh socket connection and reload data"
              onPress={async () => {
                ensureSocketConnected();
                await refresh();
                toast.success('Synced');
              }}
              showChevron={false}
            />
          </Card>
        </Section>

        <Section title="Account">
          <Card padded={false} style={styles.card}>
            <ListRow
              icon="person-outline"
              title={user?.name ?? 'Profile'}
              subtitle={user?.email}
              onPress={() => navigation.navigate('EditProfile')}
            />
            <Separator />
            <ListRow icon="business-outline" title="Organisation" value={user?.orgName} showChevron={false} />
            <Separator />
            <ListRow icon="ribbon-outline" title="Role" value={user?.role} showChevron={false} />
          </Card>
        </Section>

        <Section title="Session">
          <Card padded={false} style={styles.card}>
            <ListRow
              icon="log-out-outline"
              title="Sign out"
              subtitle="End this session on this device"
              destructive
              onPress={() => confirmLogout(false)}
              showChevron={false}
            />
            <Separator />
            <ListRow
              icon="shield-outline"
              title="Sign out everywhere"
              subtitle="Revoke every device session"
              destructive
              onPress={() => confirmLogout(true)}
              showChevron={false}
            />
          </Card>
        </Section>

        <Text style={[styles.version, { color: colors.textSubtle }]}>DockX Mobile · v1.0.0</Text>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>{title.toUpperCase()}</Text>
      {children}
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
    gap: 22,
    paddingBottom: 40,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginLeft: 4,
  },
  card: {
    overflow: 'hidden',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  version: {
    fontSize: 11.5,
    textAlign: 'center',
  },
});
