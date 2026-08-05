import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, ListRow, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import { API_BASE } from '@/lib/config';
import { ensureSocketConnected } from '@/lib/socket/socket';
import type { RootStackParamList } from '@/navigation/types';
import { useColors, useTheme, type ThemePreference } from '@/theme';

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
        <SectionLabel>Appearance</SectionLabel>
        <Section>
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
                      borderColor: active ? colors.brand : 'transparent',
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

        <SectionLabel>Connection</SectionLabel>
        <Section>
          <ListRow
            icon={connected ? 'flash' : 'flash-off-outline'}
            iconBackground={connected ? colors.successSoft : colors.warningSoft}
            iconColor={connected ? colors.success : colors.warning}
            title="Realtime"
            value={connected ? 'Connected' : 'Reconnecting'}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="server-outline"
            iconBackground={colors.surfaceAlt}
            iconColor={colors.textMuted}
            title="API endpoint"
            subtitle={API_BASE}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="refresh-outline"
            iconBackground={colors.infoSoft}
            iconColor={colors.info}
            title="Reconnect and sync"
            subtitle="Refresh socket and reload data"
            onPress={async () => {
              ensureSocketConnected();
              await refresh();
              toast.success('Synced');
            }}
            showChevron={false}
          />
        </Section>

        <SectionLabel>Account</SectionLabel>
        <Section>
          <ListRow
            icon="person-outline"
            iconBackground={colors.brandSoft}
            iconColor={colors.brand}
            title={user?.name ?? 'Profile'}
            subtitle={user?.email}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <Separator />
          <ListRow
            icon="business-outline"
            iconBackground={colors.surfaceAlt}
            iconColor={colors.textMuted}
            title="Organisation"
            value={user?.orgName}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="ribbon-outline"
            iconBackground={colors.surfaceAlt}
            iconColor={colors.textMuted}
            title="Role"
            value={user?.role}
            showChevron={false}
          />
        </Section>

        <SectionLabel>Session</SectionLabel>
        <Section>
          <ListRow
            icon="log-out-outline"
            title="Sign out"
            destructive
            onPress={() => confirmLogout(false)}
            showChevron={false}
          />
          <Separator />
          <ListRow
            icon="phone-portrait-outline"
            title="Sign out everywhere"
            subtitle="Revoke every device session"
            destructive
            onPress={() => confirmLogout(true)}
            showChevron={false}
          />
        </Section>

        <Text style={[styles.version, { color: colors.textSubtle }]}>DockX · v1.0.0</Text>
      </ScrollView>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.textSubtle }]}>{children}</Text>;
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
    paddingTop: 8,
    paddingBottom: 40,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 2,
    marginLeft: 4,
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
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  themeChip: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
