import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  Button,
  EmptyState,
  LoadingView,
  Screen,
  useGlassScreenPadding,
} from '@/components/ui';
import { MessagePreview } from '@/components/chat/MessagePreview';
import { useNotifications } from '@/context/NotificationContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { AppNotification, NotificationType } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { useColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'unread' | 'tasks' | 'messages' | 'projects';

const TYPE_ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  'task.assigned': 'checkbox-outline',
  'task.commented': 'chatbubble-ellipses-outline',
  'message.new': 'chatbubble-outline',
  'project.added': 'folder-open-outline',
  'project.invited': 'mail-open-outline',
  'team.added': 'people-outline',
};

function accentFor(type: NotificationType, colors: ReturnType<typeof useColors>): string {
  if (type.startsWith('task')) return colors.info;
  if (type.startsWith('message')) return colors.brand;
  if (type.startsWith('project')) return colors.success;
  return colors.warning;
}

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const toast = useToast();
  const { items, unreadCount, isLoading, hasMore, refresh, loadMore, markRead, markAllRead, remove } =
    useNotifications();
  const { pendingInvites, acceptInvite, declineInvite, setActiveProjectId, isLoading: workspaceLoading } = useWorkspace();
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const pad = useGlassScreenPadding();

  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread':
        return items.filter((item) => !item.readAt);
      case 'tasks':
        return items.filter((item) => item.type.startsWith('task'));
      case 'messages':
        return items.filter((item) => item.type.startsWith('message'));
      case 'projects':
        return items.filter((item) => item.type.startsWith('project') || item.type.startsWith('team'));
      default:
        return items;
    }
  }, [filter, items]);

  const filterOptions: Array<{ value: Filter; label: string; count?: number }> = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread', count: unreadCount },
    { value: 'tasks', label: 'Tasks' },
    { value: 'messages', label: 'Messages' },
    { value: 'projects', label: 'Projects' },
  ];

  const open = async (notification: AppNotification) => {
    if (!notification.readAt) void markRead([notification.id]);
    if (notification.type === 'project.invited') return;

    if (notification.conversationId) {
      navigation.navigate('ChatThread', { conversationId: notification.conversationId });
      return;
    }
    if (notification.taskId) {
      navigation.navigate('TaskDetail', { taskId: notification.taskId });
      return;
    }
    if (notification.projectId) {
      navigation.navigate('ProjectMembers', { projectId: notification.projectId });
    }
  };

  const inviteIdOf = (item: AppNotification) => {
    const raw = item.meta?.inviteId;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  };

  if (isLoading && items.length === 0) {
    return (
      <Screen>
        <AppHeader title="Notifications" />
        <LoadingView label="Loading notifications…" />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: pad.top + 2,
            paddingBottom: pad.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={styles.filtersScroll}
          >
            {filterOptions.map((option) => {
              const active = filter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: active ? colors.surface : 'transparent',
                      borderColor: active ? colors.borderStrong : colors.border,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: active ? colors.text : colors.textSubtle }]}>
                    {option.label}
                  </Text>
                  {option.count !== undefined && option.count > 0 ? (
                    <View style={[styles.chipCount, { backgroundColor: active ? colors.brandSoft : colors.track }]}>
                      <Text style={[styles.chipCountText, { color: active ? colors.brand : colors.textMuted }]}>
                        {option.count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            progressViewOffset={pad.top}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore) void loadMore();
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title={filter === 'unread' ? 'No unread notifications' : 'Nothing here yet'}
            description="Task assignments, mentions and project updates will show up here."
          />
        }
        renderItem={({ item }) => {
          const accent = accentFor(item.type, colors);
          const unread = !item.readAt;
          const name = item.actorName || item.title;
          const inviteId = item.type === 'project.invited' ? inviteIdOf(item) : null;
          const pending = inviteId ? pendingInvites.find((invite) => invite.id === inviteId) : undefined;
          const inviteBusy = inviteBusyId === inviteId;

          return (
            <View>
            <Pressable
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <View style={styles.avatarWrap}>
                <Avatar name={name} uri={item.actorAvatarUrl} size={42} />
                <View style={[styles.typeBadge, { backgroundColor: colors.bg, borderColor: colors.bg }]}>
                  <View style={[styles.typeBadgeInner, { backgroundColor: `${accent}22` }]}>
                    <Ionicons name={TYPE_ICON[item.type] ?? 'notifications-outline'} size={10} color={accent} />
                  </View>
                </View>
              </View>

              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text
                    style={[styles.title, { color: colors.text, fontWeight: unread ? '700' : '600' }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.time, { color: unread ? colors.brand : colors.textSubtle }]}>
                    {formatRelative(item.createdAt)}
                  </Text>
                </View>

                {item.body ? (
                  <MessagePreview
                    text={item.body}
                    color={unread ? colors.text : colors.textMuted}
                    numberOfLines={2}
                    style={styles.message}
                  />
                ) : null}
              </View>

              {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} /> : null}

              <Pressable
                onPress={async () => {
                  try {
                    await remove(item.id);
                  } catch (error) {
                    toast.fromError(error, 'Could not dismiss it.');
                  }
                }}
                hitSlop={10}
                style={styles.dismiss}
                accessibilityLabel="Dismiss"
              >
                <Ionicons name="close" size={16} color={colors.textSubtle} />
              </Pressable>
            </Pressable>
            {item.type === 'project.invited' ? (
              <View style={styles.inviteActions}>
                {pending && inviteId ? (
                  <>
                    <Button
                      size="sm"
                      label={inviteBusy ? '…' : 'Accept'}
                      disabled={Boolean(inviteBusyId)}
                      onPress={async () => {
                        setInviteBusyId(inviteId);
                        try {
                          const project = await acceptInvite(inviteId);
                          setActiveProjectId(project.id);
                          await remove(item.id);
                          toast.success(`You joined ${project.name}.`);
                          navigation.navigate('Tabs', { screen: 'Board' });
                        } catch (error) {
                          toast.fromError(error, 'Could not accept invite');
                        } finally {
                          setInviteBusyId(null);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Decline"
                      disabled={Boolean(inviteBusyId)}
                      onPress={async () => {
                        setInviteBusyId(inviteId);
                        try {
                          await declineInvite(inviteId);
                          await remove(item.id);
                          toast.success('Invite declined.');
                        } catch (error) {
                          toast.fromError(error, 'Could not decline invite');
                        } finally {
                          setInviteBusyId(null);
                        }
                      }}
                    />
                  </>
                ) : (
                  <Text style={[styles.inviteHint, { color: colors.textSubtle }]}>
                    {workspaceLoading ? 'Loading invite…' : 'This invite is no longer pending.'}
                  </Text>
                )}
              </View>
            ) : null}
            </View>
          );
        }}
      />

      <AppHeader
        floating
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
        actions={
          unreadCount > 0
            ? [
                {
                  icon: 'checkmark-done-outline',
                  onPress: async () => {
                    try {
                      await markAllRead();
                      toast.success('All marked as read');
                    } catch (error) {
                      toast.fromError(error, 'Could not mark them read.');
                    }
                  },
                  accessibilityLabel: 'Mark all read',
                },
              ]
            : []
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filters: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 0,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipCount: {
    minWidth: 16,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 70,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarWrap: {
    width: 42,
    height: 42,
  },
  typeBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: 9,
    borderWidth: 2,
  },
  typeBadgeInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 19,
  },
  message: {
    fontSize: 13,
    lineHeight: 17,
  },
  time: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dismiss: {
    padding: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingLeft: 70,
  },
  inviteHint: {
    fontSize: 12,
  },
});
