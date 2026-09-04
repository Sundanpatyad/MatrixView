import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Avatar, EmptyState, Input, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import type { RootStackParamList } from '@/navigation/types';
import { useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NewChat'>;

export function NewChatScreen({ navigation }: Props) {
  const colors = useColors();
  const toast = useToast();
  const { user } = useAuth();
  const { users, presence, startDm } = useChat();

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((entry) => entry.id !== user?.id)
      .filter((entry) =>
        term ? entry.name.toLowerCase().includes(term) || entry.email.toLowerCase().includes(term) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search, user?.id, users]);

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(search.trim());

  const open = async (input: { userId?: string; email?: string }, key: string) => {
    setBusyId(key);
    try {
      const conversation = await startDm(input);
      navigation.replace('ChatThread', { conversationId: conversation.id });
    } catch (error) {
      toast.fromError(error, 'Could not start the conversation.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="New chat"
        showBack
        actions={[
          { icon: 'people-outline', onPress: () => navigation.replace('NewGroup'), accessibilityLabel: 'New group' },
        ]}
      />

      <View style={styles.searchWrap}>
        <Input
          placeholder="Search by name or email"
          icon="search-outline"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />
      </View>

      <FlatList
        data={candidates}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          looksLikeEmail && candidates.length === 0 ? (
            <Pressable
              onPress={() => open({ email: search.trim() }, 'email')}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surfaceAlt },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.inviteIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name="mail-outline" size={20} color={colors.brand} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]}>Message {search.trim()}</Text>
                <Text style={[styles.email, { color: colors.textSubtle }]}>Start a chat by email address</Text>
              </View>
              {busyId === 'email' ? <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSubtle} /> : null}
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          looksLikeEmail ? null : (
            <EmptyState
              icon="person-outline"
              title={search ? 'No teammates found' : 'No teammates yet'}
              description={
                search ? 'Try a different name, or enter a full email address.' : 'Invite people to your organisation first.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const online = presence[item.id]?.online ?? item.online ?? false;
          return (
            <Pressable
              onPress={() => open({ userId: item.id }, item.id)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <Avatar name={item.name} uri={item.avatarUrl} size={44} online={online} />
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.email, { color: colors.textSubtle }]} numberOfLines={1}>
                  {online ? 'Online' : 'Offline'} · {item.email}
                </Text>
              </View>
              {busyId === item.id ? (
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSubtle} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  rowText: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  email: {
    fontSize: 12.5,
    marginTop: 1,
  },
  inviteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
