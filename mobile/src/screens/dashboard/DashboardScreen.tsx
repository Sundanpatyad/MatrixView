import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TaskCard } from '@/components/board/TaskCard';
import {
  Avatar,
  EmptyState,
  LoadingView,
  OptionSheet,
  Screen,
  SegmentedControl,
  useTabBarPadding,
  type SheetOption,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useNotifications } from '@/context/NotificationContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatRelative, isOverdue } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, resolveAccentColor, statusAccent, useColors } from '@/theme';

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
  const {
    projects,
    visibleTasks,
    timeline,
    activeProjectId,
    setActiveProjectId,
    isLoading,
    refresh,
    isProjectAdmin,
  } = useWorkspace();
  const { unreadCount } = useNotifications();
  const { connected } = useChat();
  const tabBarHeight = useTabBarPadding();

  const [filter, setFilter] = useState<TaskFilter>('mine');
  const [projectSheet, setProjectSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canViewActivity =
    activeProjectId === 'all'
      ? projects.some((project) => isProjectAdmin(project.id))
      : isProjectAdmin(activeProjectId);

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
      accent: resolveAccentColor(column.accent || statusAccent[column.id], colors.brand),
      count: counts.get(column.id) ?? 0,
    }));

    const seen = new Set(known.map((entry) => entry.id));
    counts.forEach((count, id) => {
      if (seen.has(id)) return;
      known.push({
        id,
        label: id.replace(/_/g, ' '),
        accent: statusAccent[id] ?? colors.textSubtle,
        count,
      });
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
      {
        value: 'all',
        label: 'All projects',
        description:
          projects.length === 0
            ? 'Nothing here yet'
            : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
        icon: 'albums-outline',
      },
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

  const statusTotal = statusBreakdown.reduce((sum, entry) => sum + entry.count, 0) || 1;
  const pct = Math.round(stats.completion * 100);

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
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 36 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: colors.textSubtle }]}>{greeting()}</Text>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? 'there'}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('Tabs', { screen: 'Alerts' })}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surfaceAlt },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.bg }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })} hitSlop={10}>
            <Avatar name={user?.name} uri={user?.avatarUrl} size={40} online={connected} />
          </Pressable>
        </View>

        {/* Project scope */}
        <Pressable
          onPress={() => setProjectSheet(true)}
          style={({ pressed }) => [
            styles.projectPicker,
            { backgroundColor: colors.surfaceAlt },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.projectIcon, { backgroundColor: colors.brandSoft }]}>
            <Ionicons name="folder-open-outline" size={16} color={colors.brand} />
          </View>
          <View style={styles.projectText}>
            <Text style={[styles.projectEyebrow, { color: colors.textSubtle }]}>Workspace</Text>
            <Text style={[styles.projectLabel, { color: colors.text }]} numberOfLines={1}>
              {activeLabel}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textSubtle} />
        </Pressable>

        {canViewActivity ? (
          <Pressable
            onPress={() =>
              navigation.navigate('TeamActivity', {
                projectId:
                  activeProjectId !== 'all' && isProjectAdmin(activeProjectId)
                    ? activeProjectId
                    : undefined,
              })
            }
            style={({ pressed }) => [
              styles.activityCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.projectIcon, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="pulse-outline" size={16} color={colors.success} />
            </View>
            <View style={styles.projectText}>
              <Text style={[styles.projectEyebrow, { color: colors.textSubtle }]}>Admin</Text>
              <Text style={[styles.projectLabel, { color: colors.text }]}>Team activity</Text>
              <Text style={[styles.panelHint, { color: colors.textMuted, marginTop: 2 }]}>
                Check-ins, software, browsers, and websites
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <MetricChip
            label="Open"
            value={stats.open}
            accent={colors.brand}
            icon="layers-outline"
            onPress={() => {
              setFilter('open');
            }}
          />
          <MetricChip
            label="Done"
            value={stats.done}
            accent={colors.success}
            icon="checkmark-circle-outline"
          />
          <MetricChip label="Due soon" value={stats.dueSoon} accent={colors.warning} icon="time-outline" />
          <MetricChip label="Overdue" value={stats.overdue} accent={colors.danger} icon="alert-circle-outline" />
        </View>

        {/* Completion graph card */}
        <View style={[styles.panel, { backgroundColor: colors.surface }]}>
          <View style={styles.progressTop}>
            <View style={styles.ringWrap}>
              <View style={[styles.ringTrack, { borderColor: colors.track }]} />
              <View
                style={[
                  styles.ringFill,
                  {
                    borderColor: pct > 0 ? colors.success : colors.track,
                    // Approximate fill: thicker brand ring when there's progress.
                    borderTopColor: pct >= 12 ? colors.success : colors.track,
                    borderRightColor: pct >= 37 ? colors.success : colors.track,
                    borderBottomColor: pct >= 62 ? colors.success : colors.track,
                    borderLeftColor: pct >= 87 ? colors.success : colors.track,
                    opacity: pct === 0 ? 0.35 : 1,
                  },
                ]}
              />
              <View style={[styles.ringCenter, { backgroundColor: colors.surface }]}>
                <Text style={[styles.ringValue, { color: colors.text }]}>{pct}%</Text>
                <Text style={[styles.ringCaption, { color: colors.textSubtle }]}>done</Text>
              </View>
            </View>

            <View style={styles.progressCopy}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>Task completion</Text>
              <Text style={[styles.panelHint, { color: colors.textMuted }]}>
                {stats.done} of {stats.total} tasks finished
                {activeLabel !== 'All projects' ? ` in ${activeLabel}` : ''}
              </Text>

              <View style={styles.stackedBar}>
                {statusBreakdown.every((entry) => entry.count === 0) ? (
                  <View style={[styles.stackedEmpty, { backgroundColor: colors.track }]} />
                ) : (
                  statusBreakdown.map((entry) =>
                    entry.count > 0 ? (
                      <View
                        key={entry.id}
                        style={{
                          flex: entry.count / statusTotal,
                          backgroundColor: entry.accent,
                          minWidth: entry.count > 0 ? 4 : 0,
                        }}
                      />
                    ) : null,
                  )
                )}
              </View>

              <View style={styles.legend}>
                {statusBreakdown.slice(0, 4).map((entry) => (
                  <View key={entry.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: entry.accent }]} />
                    <Text style={[styles.legendLabel, { color: colors.textSubtle }]} numberOfLines={1}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.legendCount, { color: colors.text }]}>{entry.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <QuickAction
            icon="add-circle-outline"
            label={projects.length ? 'New task' : 'New project'}
            color={colors.brand}
            onPress={() =>
              projects.length
                ? navigation.navigate('Tabs', { screen: 'Board' })
                : navigation.navigate('CreateProject')
            }
          />
          <QuickAction
            icon="grid-outline"
            label="Board"
            color={colors.info}
            onPress={() => navigation.navigate('Tabs', { screen: 'Board' })}
          />
          <QuickAction
            icon="chatbubbles-outline"
            label="Chat"
            color={colors.success}
            onPress={() => navigation.navigate('Tabs', { screen: 'Chat' })}
          />
        </View>

        {unassignedTimeline.length > 0 ? (
          <View style={[styles.panel, { backgroundColor: colors.surface }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>Needs assignment</Text>
            <Text style={[styles.panelHint, { color: colors.textMuted, marginBottom: 4 }]}>
              Backlog items waiting for an owner
            </Text>
            {unassignedTimeline.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.timelineRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
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
          </View>
        ) : null}

        {/* Tasks */}
        <View style={styles.tasksHead}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>Your tasks</Text>
          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Board' })} hitSlop={8}>
            <Text style={[styles.link, { color: colors.brand }]}>Open board</Text>
          </Pressable>
        </View>

        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'mine', label: 'Mine' },
            { value: 'open', label: 'Open' },
            { value: 'all', label: 'All' },
          ]}
        />

        <View style={styles.taskList}>
          {listedTasks.length === 0 ? (
            <View style={[styles.emptyPanel, { backgroundColor: colors.surface }]}>
              <EmptyState
                icon="checkmark-circle-outline"
                title="You're all caught up"
                description={
                  filter === 'mine'
                    ? 'No tasks assigned to you right now. Jump to the board to pick something up.'
                    : 'Create a task from the board to start tracking work here.'
                }
                actionLabel={projects.length ? 'Go to board' : 'Create project'}
                onAction={() =>
                  projects.length
                    ? navigation.navigate('Tabs', { screen: 'Board' })
                    : navigation.navigate('CreateProject')
                }
              />
            </View>
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
        subtitle="Scope the dashboard to one project."
        options={projectOptions}
        value={activeProjectId}
        onSelect={(value) => setActiveProjectId(value)}
      />
    </Screen>
  );
}

function MetricChip({
  label,
  value,
  accent,
  icon,
  onPress,
}: {
  label: string;
  value: number;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.metricChip,
        { backgroundColor: colors.surface },
        pressed && onPress ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSubtle }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { backgroundColor: colors.surface },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const RING = 92;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    gap: 14,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    marginBottom: 2,
  },
  headerText: { flex: 1 },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  projectPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  projectIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectText: { flex: 1 },
  projectEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  projectLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 5,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  panel: {
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  progressTop: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 9,
  },
  ringFill: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 9,
  },
  ringCenter: {
    width: RING - 28,
    height: RING - 28,
    borderRadius: (RING - 28) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  ringCaption: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: -1,
  },
  progressCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  panelHint: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  stackedBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
  },
  stackedEmpty: {
    flex: 1,
    borderRadius: 5,
  },
  legend: {
    gap: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  legendCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAction: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    marginTop: 2,
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
  emptyPanel: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
