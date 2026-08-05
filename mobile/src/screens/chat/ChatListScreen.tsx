import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  EmptyState,
  Input,
  LoadingView,
  Screen,
  useGlassScreenPadding,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import type { ChatConversation } from '@/lib/api';
import { formatListTimestamp } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const { user } = useAuth();
  const { conversations, unread, presence, isLoading, connected, refresh, typingIn } = useChat();
  const pad = useGlassScreenPadding();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const peerFor = (conversation: ChatConversation) =>
    conversation.type === 'dm'
      ? conversation.members.find((member) => member.id !== user?.id) ?? conversation.members[0]
      : undefined;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => {
      const peer = peerFor(conversation);
      return (
        conversation.name?.toLowerCase().includes(term) ||
        peer?.name?.toLowerCase().includes(term) ||
        peer?.email?.toLowerCase().includes(term) ||
        conversation.lastMessagePreview?.toLowerCase().includes(term)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, search, user?.id]);

  if (isLoading && conversations.length === 0) {
    return (
      <Screen>
        <AppHeader title="Chats" />
        <LoadingView label="Loading conversations…" />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <AppHeader
        floating
        title="Chats"
        subtitle={connected ? 'Connected' : 'Reconnecting…'}
        actions={[
          {
            icon: 'people-outline',
            onPress: () => navigation.navigate('NewGroup'),
            accessibilityLabel: 'New group',
          },
          {
            icon: 'create-outline',
            onPress: () => navigation.navigate('NewChat'),
            accessibilityLabel: 'New chat',
          },
        ]}
      />

      <FlatList
        data={filtered}
        keyExtractor={(conversation) => conversation.id}
        contentContainerStyle={[
          styles.list,
          { paddingTop: pad.top + 8, paddingBottom: pad.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            progressViewOffset={pad.top}
          />
        }
        ListHeaderComponent={
          <View style={styles.searchWrap}>
            <Input
              placeholder="Search people and conversations"
              icon="search-outline"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title={search ? 'No matches' : 'No conversations yet'}
            description={
              search ? 'Try a different name or keyword.' : 'Start a direct message or create a group to get going.'
            }
            actionLabel={search ? undefined : 'Start a chat'}
            onAction={search ? undefined : () => navigation.navigate('NewChat')}
          />
        }
        renderItem={({ item }) => {
          const peer = peerFor(item);
          const count = unread[item.id] ?? 0;
          const online = peer ? presence[peer.id]?.online ?? false : undefined;
          const title = item.type === 'dm' ? peer?.name ?? item.name : item.name;
          const typing = typingIn(item.id);
          const typingLabel = typing.length
            ? item.type === 'group'
              ? `${typing[0]} is typing…`
              : 'typing…'
            : null;

          return (
            <Pressable
              onPress={() => navigation.navigate('ChatThread', { conversationId: item.id })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <Avatar
                name={title}
                uri={item.type === 'group' ? item.avatarUrl : peer?.avatarUrl}
                size={50}
                square={item.type === 'group'}
                online={item.type === 'dm' ? online : undefined}
              />

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={[styles.time, { color: count ? colors.brand : colors.textSubtle }]}>
                    {formatListTimestamp(item.lastMessageAt)}
                  </Text>
                </View>

                <View style={styles.rowBottom}>
                  {item.type === 'group' && !typingLabel ? (
                    <Ionicons name="people" size={13} color={colors.textSubtle} style={styles.groupIcon} />
                  ) : null}
                  {typingLabel ? (
                    <Text style={[styles.preview, styles.typing, { color: colors.success }]} numberOfLines={1}>
                      {typingLabel}
                    </Text>
                  ) : (
                    <Text
                      style={[styles.preview, { color: count ? colors.text : colors.textSubtle }]}
                      numberOfLines={1}
                    >
                      {item.lastMessagePreview || 'No messages yet'}
                    </Text>
                  )}

                  {count > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
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
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 78,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '700',
  },
  time: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupIcon: {
    marginTop: 1,
  },
  preview: {
    flex: 1,
    fontSize: 13.5,
  },
  typing: {
    fontWeight: '600',
    fontStyle: 'italic',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
});
