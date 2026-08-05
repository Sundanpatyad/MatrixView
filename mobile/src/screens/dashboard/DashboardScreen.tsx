import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TaskCard } from '@/components/board/TaskCard';
import {
  Avatar,
  Card,
  EmptyState,
  LoadingView,
  OptionSheet,
  ProgressBar,
  Screen,
  SegmentedControl,
  type SheetOption,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useNotifications } from '@/context/NotificationContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatRelative, isOverdue } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, statusAccent, useColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TaskFilter = 'mine' | 'open' | 'all';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const { user } = useAuth();
  const { projects, visibleTasks, timeline, activeProjectId, setActiveProjectId, isLoading, refresh } =
    useWorkspace();
  const { unreadCount } = useNotifications();
  const { connected } = useChat();

  const [filter, setFilter] = useState<TaskFilter>('mine');
  const [projectSheet, setProjectSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const total = visibleTasks.length;
    const done = visibleTasks.filter((task) => task.status === 'done').length;
    const open = total - done;
    const overdue = visibleTasks.filter((task) => task.status !== 'done' && isOverdue(task.dueDate)).length;

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dueSoon = visibleTasks.filter((task) => {
      if (task.status === 'done' || !task.dueDate) return false;
      const due = new Date(task.dueDate);
      return !Number.isNaN(due.getTime()) && due <= weekEnd;
    }).length;

    return { total, done, open, overdue, dueSoon, completion: total ? done / total : 0 };
  }, [visibleTasks]);

  const statusBreakdown = useMemo(() => {
    const columns =
      activeProjectId === 'all'
        ? projects[0]?.columns ?? []
        : projects.find((project) => project.id === activeProjectId)?.columns ?? [];

    const counts = new Map<string, number>();
    visibleTasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));

    const known = columns.map((column) => ({
      id: column.id,
      label: column.label,
      accent: column.accent || statusAccent[column.id] || colors.brand,
      count: counts.get(column.id) ?? 0,
    }));

    const seen = new Set(known.map((entry) => entry.id));
    counts.forEach((count, id) => {
      if (seen.has(id)) return;
      known.push({ id, label: id.replace(/_/g, ' '), accent: statusAccent[id] ?? colors.textSubtle, count });
    });

    return known;
  }, [activeProjectId, colors.brand, colors.textSubtle, projects, visibleTasks]);

  const listedTasks = useMemo(() => {
    const byUser = visibleTasks.filter(
      (task) => task.assigneeId === user?.id || task.assigneeName === user?.name,
    );
    const source = filter === 'mine' ? byUser : visibleTasks;
    const filtered = filter === 'open' ? source.filter((task) => task.status !== 'done') : source;
    return filtered
      .slice()
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
      .slice(0, 12);
  }, [filter, user, visibleTasks]);

  const unassignedTimeline = useMemo(
    () => timeline.filter((item) => !item.taskId).slice(0, 4),
    [timeline],
  );

  const projectOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: 'all', label: 'All projects', description: `${projects.length} projects`, icon: 'albums-outline' },
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: `${project.key} · ${project.members.length} members`,
        icon: 'folder-outline' as const,
      })),
    ],
    [projects],
  );

  const activeLabel =
    activeProjectId === 'all'
      ? 'All projects'
      : projects.find((project) => project.id === activeProjectId)?.name ?? 'All projects';

  if (isLoading && projects.length === 0) {
    return (
      <Screen>
        <LoadingView label="Loading your workspace…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: colors.textSubtle }]}>{greeting()}</Text>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? 'there'}
            </Text>
          </View>

          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Alerts' })} hitSlop={10}>
            <View style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
              {unreadCount > 0 ? (
                <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.bg }]} />
              ) : null}
            </View>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })} hitSlop={10}>
            <Avatar name={user?.name} uri={user?.avatarUrl} size={38} online={connected} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => setProjectSheet(true)}
          style={({ pressed }) => [
            styles.projectPicker,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="albums-outline" size={17} color={colors.brand} />
          <Text style={[styles.projectLabel, { color: colors.text }]} numberOfLines={1}>
            {activeLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
        </Pressable>

        <View style={styles.statsGrid}>
          <StatTile label="Open tasks" value={stats.open} accent={colors.brand} icon="layers-outline" />
          <StatTile label="Completed" value={stats.done} accent={colors.success} icon="checkmark-done-outline" />
          <StatTile label="Due in 7 days" value={stats.dueSoon} accent={colors.warning} icon="calendar-outline" />
          <StatTile label="Overdue" value={stats.overdue} accent={colors.danger} icon="alert-circle-outline" />
        </View>

        <Card style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Completion</Text>
            <Text style={[styles.sectionValue, { color: colors.textMuted }]}>
              {Math.round(stats.completion * 100)}%
            </Text>
          </View>
          <ProgressBar value={stats.completion} color={colors.success} height={8} />
          <Text style={[styles.sectionHint, { color: colors.textSubtle }]}>
            {stats.done} of {stats.total} tasks done
          </Text>

          {statusBreakdown.length > 0 ? (
            <View style={styles.breakdown}>
              {statusBreakdown.map((entry) => (
                <View key={entry.id} style={styles.breakdownRow}>
                  <View style={[styles.breakdownDot, { backgroundColor: entry.accent }]} />
                  <Text style={[styles.breakdownLabel, { color: colors.textMuted }]} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <Text style={[styles.breakdownCount, { color: colors.text }]}>{entry.count}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {unassignedTimeline.length > 0 ? (
          <Card style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Backlog waiting on assignment</Text>
            </View>
            {unassignedTimeline.map((item) => (
              <View key={item.id} style={[styles.timelineRow, { borderTopColor: colors.border }]}>
                <View style={[styles.timelineDot, { backgroundColor: colors.warning }]} />
                <View style={styles.timelineText}>
                  <Text style={[styles.timelineTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.timelineMeta, { color: colors.textSubtle }]} numberOfLines={1}>
                    {item.createdByName} · {formatRelative(item.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.tasksHead}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>Tasks</Text>
          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Board' })} hitSlop={8}>
            <Text style={[styles.link, { color: colors.brand }]}>Open board</Text>
          </Pressable>
        </View>

        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'mine', label: 'Assigned to me' },
            { value: 'open', label: 'Open' },
            { value: 'all', label: 'All' },
          ]}
        />

        <View style={styles.taskList}>
          {listedTasks.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Nothing here yet"
              description={
                filter === 'mine'
                  ? 'Tasks assigned to you will show up here.'
                  : 'Create a task from the board to get started.'
              }
              actionLabel={projects.length ? 'Go to board' : 'Create project'}
              onAction={() =>
                projects.length
                  ? navigation.navigate('Tabs', { screen: 'Board' })
                  : navigation.navigate('CreateProject')
              }
            />
          ) : (
            listedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectName={
                  activeProjectId === 'all'
                    ? projects.find((project) => project.id === task.projectId)?.key
                    : undefined
                }
                onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <OptionSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        title="Filter by project"
        options={projectOptions}
        value={activeProjectId}
        onSelect={(value) => setActiveProjectId(value)}
      />
    </Screen>
  );
}

function StatTile({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${accent}1f` }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSubtle }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  headerText: { flex: 1 },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
  },
  name: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
  projectPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  projectLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    flexBasis: '47.5%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 13,
    gap: 7,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  breakdown: {
    gap: 8,
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  timelineText: { flex: 1 },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  tasksHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
  },
  taskList: {
    gap: 10,
  },
});
