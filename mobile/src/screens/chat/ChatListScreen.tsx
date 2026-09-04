import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  EmptyState,
  Input,
  LoadingView,
  Screen,
  Sheet,
  useGlassScreenPadding,
} from '@/components/ui';
import { MessagePreview } from '@/components/chat/MessagePreview';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import type { ChatConversation } from '@/lib/api';
import { formatListTimestamp } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const {
    conversations,
    unread,
    presence,
    isLoading,
    connected,
    refresh,
    typingIn,
    setPinned,
    setMuted,
    clearMessages,
    deleteChat,
    deleteGroup,
  } = useChat();
  const pad = useGlassScreenPadding();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [menuTarget, setMenuTarget] = useState<ChatConversation | null>(null);
  const [busy, setBusy] = useState(false);

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

  const titleFor = (conversation: ChatConversation) => {
    if (conversation.type === 'dm') {
      return peerFor(conversation)?.name ?? conversation.name;
    }
    return conversation.name;
  };

  const openMenu = (conversation: ChatConversation) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuTarget(conversation);
  };

  const afterMenuClose = (action: () => void) => {
    setMenuTarget(null);
    // Let the sheet dismiss before presenting alerts / running work.
    requestAnimationFrame(() => setTimeout(action, 220));
  };

  const runAction = async (label: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      toast.fromError(error, `Could not ${label}.`);
    } finally {
      setBusy(false);
    }
  };

  const confirmClearMessages = async (conversation: ChatConversation) => {
    const ok = await confirm({
      title: 'Delete messages?',
      message: `Clear all messages in “${titleFor(conversation)}” for you. Others keep their history.`,
      confirmLabel: 'Delete messages',
      destructive: true,
    });
    if (!ok) return;
    await runAction('clear messages', async () => {
      await clearMessages(conversation.id);
      toast.success('Messages deleted');
    });
  };

  const confirmDeleteChat = async (conversation: ChatConversation) => {
    const isGroup = conversation.type === 'group';
    const ok = await confirm({
      title: isGroup ? 'Leave and delete chat?' : 'Delete chat?',
      message: isGroup
        ? `You’ll leave “${titleFor(conversation)}” and it will be removed from your list.`
        : `“${titleFor(conversation)}” will be removed from your list. New messages will bring it back.`,
      confirmLabel: 'Delete chat',
      destructive: true,
    });
    if (!ok) return;
    await runAction('delete chat', async () => {
      await deleteChat(conversation.id);
      toast.success(isGroup ? 'Left group' : 'Chat deleted');
    });
  };

  const confirmDeleteGroup = async (conversation: ChatConversation) => {
    const ok = await confirm({
      title: 'Delete group?',
      message: `Permanently delete “${titleFor(conversation)}” for everyone. This cannot be undone.`,
      confirmLabel: 'Delete group',
      destructive: true,
    });
    if (!ok) return;
    await runAction('delete group', async () => {
      await deleteGroup(conversation.id);
      toast.success('Group deleted');
    });
  };

  if (isLoading && conversations.length === 0) {
    return (
      <Screen>
        <AppHeader title="Chats" />
        <LoadingView label="Loading conversations…" />
      </Screen>
    );
  }

  const isGroupAdmin =
    menuTarget?.type === 'group' && Boolean(user?.id) && menuTarget.createdBy === user?.id;

  return (
    <Screen edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(conversation) => conversation.id}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: pad.top + 4,
            paddingBottom: pad.bottom + 24,
          },
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
              onLongPress={() => openMenu(item)}
              delayLongPress={280}
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
                  <View style={styles.titleRow}>
                    {item.pinned ? (
                      <Ionicons name="pin" size={13} color={colors.brand} style={styles.pinIcon} />
                    ) : null}
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {title}
                    </Text>
                    {item.muted ? (
                      <Ionicons name="notifications-off" size={14} color={colors.textSubtle} />
                    ) : null}
                  </View>
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
                    <MessagePreview
                      text={item.lastMessagePreview || 'No messages yet'}
                      color={count ? colors.text : colors.textSubtle}
                      style={[styles.preview, count ? { fontWeight: '600' } : null]}
                    />
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

      <Sheet
        visible={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        title={menuTarget ? titleFor(menuTarget) : 'Chat options'}
        subtitle={
          menuTarget?.type === 'group'
            ? isGroupAdmin
              ? 'Group · you’re the admin'
              : 'Group chat'
            : 'Direct message'
        }
      >
        <View style={styles.actionList}>
          <ActionRow
            icon={menuTarget?.pinned ? 'pin-outline' : 'pin'}
            label={menuTarget?.pinned ? 'Unpin chat' : 'Pin chat'}
            subtitle={
              menuTarget?.type === 'group'
                ? menuTarget?.pinned
                  ? 'Remove this group from the top'
                  : 'Keep this group at the top'
                : menuTarget?.pinned
                  ? 'Remove this chat from the top'
                  : 'Keep this chat at the top'
            }
            onPress={() => {
              const target = menuTarget;
              afterMenuClose(() => {
                if (!target) return;
                void runAction(target.pinned ? 'unpin' : 'pin', async () => {
                  await setPinned(target.id, !target.pinned);
                  toast.success(target.pinned ? 'Chat unpinned' : 'Chat pinned');
                });
              });
            }}
          />
          <ActionRow
            icon={menuTarget?.muted ? 'notifications-outline' : 'notifications-off-outline'}
            label={
              menuTarget?.type === 'group'
                ? menuTarget?.muted
                  ? 'Unmute group'
                  : 'Mute group'
                : menuTarget?.muted
                  ? 'Unmute chat'
                  : 'Mute chat'
            }
            subtitle={
              menuTarget?.muted
                ? 'Show notifications for new messages'
                : 'Silence notifications for this chat'
            }
            onPress={() => {
              const target = menuTarget;
              afterMenuClose(() => {
                if (!target) return;
                void runAction(target.muted ? 'unmute' : 'mute', async () => {
                  await setMuted(target.id, !target.muted);
                  toast.success(target.muted ? 'Chat unmuted' : 'Chat muted');
                });
              });
            }}
          />
          <ActionRow
            icon="trash-bin-outline"
            label="Delete messages"
            subtitle="Clear history for you only"
            destructive
            onPress={() => {
              const target = menuTarget;
              afterMenuClose(() => {
                if (target) void confirmClearMessages(target);
              });
            }}
          />
          <ActionRow
            icon="chatbubble-ellipses-outline"
            label="Delete chat"
            subtitle={
              menuTarget?.type === 'group'
                ? 'Leave and remove from your list'
                : 'Remove from your list'
            }
            destructive
            onPress={() => {
              const target = menuTarget;
              afterMenuClose(() => {
                if (target) void confirmDeleteChat(target);
              });
            }}
          />
          {isGroupAdmin ? (
            <ActionRow
              icon="people-outline"
              label="Delete group"
              subtitle="Permanently delete for everyone"
              destructive
              onPress={() => {
                const target = menuTarget;
                afterMenuClose(() => {
                  if (target) void confirmDeleteGroup(target);
                });
              }}
            />
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}

function ActionRow({
  icon,
  label,
  subtitle,
  onPress,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  const tint = destructive ? colors.danger : colors.text;
  const iconBg = destructive ? colors.dangerSoft : colors.brandSoft;
  const iconTint = destructive ? colors.danger : colors.brand;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconTint} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.actionSubtitle, { color: colors.textSubtle }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
    </Pressable>
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
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pinIcon: {
    marginTop: 1,
  },
  title: {
    flexShrink: 1,
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
  actionList: {
    gap: 8,
    paddingBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
  },
});
