import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppHeader, EmptyState, LoadingView, Screen, SegmentedControl } from '@/components/ui';
import { useNotifications } from '@/context/NotificationContext';
import { useToast } from '@/context/ToastContext';
import type { AppNotification, NotificationType } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'unread' | 'tasks' | 'messages' | 'projects';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  'task.assigned': 'checkbox-outline',
  'task.commented': 'chatbubble-ellipses-outline',
  'message.new': 'chatbubbles-outline',
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

  const open = async (notification: AppNotification) => {
    if (!notification.readAt) void markRead([notification.id]);

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

  if (isLoading && items.length === 0) {
    return (
      <Screen>
        <AppHeader title="Notifications" />
        <LoadingView label="Loading notifications…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
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

      <View style={styles.filters}>
        <SegmentedControl
          scrollable
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread', count: unreadCount },
            { value: 'tasks', label: 'Tasks' },
            { value: 'messages', label: 'Messages' },
            { value: 'projects', label: 'Projects' },
          ]}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore) void loadMore();
        }}
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
          return (
            <Pressable
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: unread ? colors.brandSoft : colors.surface,
                  borderColor: unread ? colors.brandBorder : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: `${accent}1f` }]}>
                <Ionicons name={ICONS[item.type] ?? 'notifications-outline'} size={18} color={accent} />
              </View>

              <View style={styles.body}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.body ? (
                  <Text style={[styles.message, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={[styles.time, { color: colors.textSubtle }]}>
                  {item.actorName ? `${item.actorName} · ` : ''}
                  {formatRelative(item.createdAt)}
                </Text>
              </View>

              <Pressable
                onPress={async () => {
                  try {
                    await remove(item.id);
                  } catch (error) {
                    toast.fromError(error, 'Could not dismiss it.');
                  }
                }}
                hitSlop={10}
              >
                <Ionicons name="close" size={17} color={colors.textSubtle} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 9,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 13,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 11.5,
    marginTop: 2,
  },
});
