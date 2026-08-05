import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { TaskCard } from '@/components/board/TaskCard';
import {
  AppHeader,
  Button,
  EmptyState,
  Input,
  LoadingView,
  OptionSheet,
  Screen,
  Sheet,
  useTabBarPadding,
  type SheetOption,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { BoardTask } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { radius, statusAccent, useColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function softFill(hex: string, alpha = 0.16): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function BoardScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const toast = useToast();
  const tabBarHeight = useTabBarPadding();
  const {
    projects,
    tasks,
    isLoading,
    refresh,
    activeProjectId,
    setActiveProjectId,
    isProjectAdmin,
    moveTask,
    teamsForProject,
    addColumn,
  } = useWorkspace();

  const [projectSheet, setProjectSheet] = useState(false);
  const [moveTarget, setMoveTarget] = useState<BoardTask | null>(null);
  const [columnSheet, setColumnSheet] = useState(false);
  const [newColumn, setNewColumn] = useState('');
  const [savingColumn, setSavingColumn] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // The board always needs a concrete project, unlike the dashboard's "all" view.
  const project = useMemo(() => {
    if (activeProjectId !== 'all') {
      const match = projects.find((entry) => entry.id === activeProjectId);
      if (match) return match;
    }
    return projects[0] ?? null;
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (!project) return;
    setActiveColumn((current) => {
      if (current && project.columns.some((column) => column.id === current)) return current;
      return project.columns[0]?.id ?? null;
    });
    setTeamFilter(null);
  }, [project]);

  const teams = project ? teamsForProject(project.id) : [];
  const isAdmin = project ? isProjectAdmin(project.id) : false;

  const projectTasks = useMemo(
    () => (project ? tasks.filter((task) => task.projectId === project.id) : []),
    [project, tasks],
  );

  const countsByColumn = useMemo(() => {
    const counts = new Map<string, number>();
    projectTasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));
    return counts;
  }, [projectTasks]);

  const columnTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projectTasks
      .filter((task) => task.status === activeColumn)
      .filter((task) => (teamFilter ? task.teamId === teamFilter : true))
      .filter((task) =>
        term
          ? task.title.toLowerCase().includes(term) ||
            task.key.toLowerCase().includes(term) ||
            task.assigneeName.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }, [activeColumn, projectTasks, search, teamFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleMove = async (status: string) => {
    if (!moveTarget) return;
    const task = moveTarget;
    setMoveTarget(null);
    try {
      await moveTask(task.id, status);
      toast.success(`${task.key} moved`);
    } catch (error) {
      toast.fromError(error, 'Could not move the task.');
    }
  };

  const handleAddColumn = async () => {
    if (!project || !newColumn.trim()) return;
    setSavingColumn(true);
    try {
      await addColumn(project.id, newColumn.trim());
      setNewColumn('');
      setColumnSheet(false);
      toast.success('Column added');
    } catch (error) {
      toast.fromError(error, 'Could not add the column.');
    } finally {
      setSavingColumn(false);
    }
  };

  const projectOptions = useMemo<SheetOption<string>[]>(
    () =>
      projects.map((entry) => ({
        value: entry.id,
        label: entry.name,
        description: `${entry.key} · ${entry.members.length} members`,
        icon: 'folder-outline' as const,
      })),
    [projects],
  );

  const moveOptions = useMemo<SheetOption<string>[]>(
    () =>
      (project?.columns ?? []).map((column) => ({
        value: column.id,
        label: column.label,
        color: column.accent || statusAccent[column.id] || colors.brand,
      })),
    [colors.brand, project],
  );

  if (isLoading && projects.length === 0) {
    return (
      <Screen>
        <LoadingView label="Loading board…" />
      </Screen>
    );
  }

  if (!project) {
    return (
      <Screen>
        <AppHeader title="Board" />
        <EmptyState
          icon="folder-open-outline"
          title="No projects yet"
          description="Create your first project to start planning work on a board."
          actionLabel="Create project"
          onAction={() => navigation.navigate('CreateProject')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={project.name}
        subtitle={`${projectTasks.length} tasks · ${project.members.length} members`}
        actions={[
          {
            icon: 'swap-horizontal-outline',
            onPress: () => setProjectSheet(true),
            accessibilityLabel: 'Switch project',
          },
          {
            icon: 'people-outline',
            onPress: () => navigation.navigate('ProjectMembers', { projectId: project.id }),
            accessibilityLabel: 'Project members',
          },
          {
            icon: 'git-branch-outline',
            onPress: () => navigation.navigate('ManageTeams', { projectId: project.id }),
            accessibilityLabel: 'Manage teams',
          },
        ]}
      />

      <View style={styles.controls}>
        <Input
          placeholder="Search tasks, keys or people"
          icon="search-outline"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />

        <FlatList
          data={project.columns}
          keyExtractor={(column) => column.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columnStrip}
          ListFooterComponent={
            isAdmin ? (
              <Pressable
                onPress={() => setColumnSheet(true)}
                style={[styles.addColumn, { borderColor: colors.borderStrong }]}
              >
                <Ionicons name="add" size={16} color={colors.textSubtle} />
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const active = item.id === activeColumn;
            const accent = item.accent || statusAccent[item.id] || colors.brand;
            return (
              <Pressable
                onPress={() => setActiveColumn(item.id)}
                style={({ pressed }) => [
                  styles.columnChip,
                  {
                    backgroundColor: active ? colors.surface : colors.surfaceAlt,
                    borderColor: active ? colors.borderStrong : colors.border,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={[styles.columnDot, { backgroundColor: accent }]} />
                <Text style={[styles.columnLabel, { color: active ? colors.text : colors.textMuted }]}>
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.columnCount,
                    { backgroundColor: active ? softFill(accent) : colors.track },
                  ]}
                >
                  <Text style={[styles.columnCountText, { color: active ? accent : colors.textMuted }]}>
                    {countsByColumn.get(item.id) ?? 0}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />

        {teams.length > 0 ? (
          <FlatList
            data={[{ id: 'all', name: 'All teams' }, ...teams]}
            keyExtractor={(team) => team.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.teamStrip}
            renderItem={({ item }) => {
              const value = item.id === 'all' ? null : item.id;
              const active = teamFilter === value;
              return (
                <Pressable
                  onPress={() => setTeamFilter(value)}
                  style={[
                    styles.teamChip,
                    {
                      backgroundColor: active ? colors.brandSoft : 'transparent',
                      borderColor: active ? colors.brandBorder : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.teamLabel, { color: active ? colors.brand : colors.textSubtle }]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>

      <FlatList
        data={columnTasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={
          <EmptyState
            icon="documents-outline"
            title="This column is empty"
            description="Add a task or move one across from another column."
            actionLabel="Add task"
            onAction={() =>
              navigation.navigate('CreateTask', { projectId: project.id, status: activeColumn ?? undefined })
            }
          />
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
            onMove={() => setMoveTarget(item)}
          />
        )}
      />

      <Pressable
        onPress={() =>
          navigation.navigate('CreateTask', { projectId: project.id, status: activeColumn ?? undefined })
        }
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.brand, bottom: tabBarHeight + 16 },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel="Create task"
      >
        <Ionicons name="add" size={26} color="#ffffff" />
      </Pressable>

      <OptionSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        title="Switch project"
        options={projectOptions}
        value={project.id}
        onSelect={setActiveProjectId}
        emptyLabel="You are not a member of any project yet."
      />

      <OptionSheet
        visible={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        title="Move task"
        subtitle={moveTarget ? `${moveTarget.key} · ${moveTarget.title}` : undefined}
        options={moveOptions}
        value={moveTarget?.status}
        onSelect={handleMove}
      />

      <Sheet
        visible={columnSheet}
        onClose={() => setColumnSheet(false)}
        title="Add a column"
        subtitle="Columns become the statuses available on this board."
      >
        <Input
          label="Column name"
          placeholder="e.g. Blocked"
          value={newColumn}
          onChangeText={setNewColumn}
          autoCapitalize="words"
        />
        <Button
          label="Add column"
          onPress={handleAddColumn}
          loading={savingColumn}
          disabled={!newColumn.trim()}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  columnStrip: {
    gap: 6,
    paddingRight: 4,
  },
  columnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  columnDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  columnCount: {
    minWidth: 16,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  columnCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addColumn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamStrip: {
    gap: 6,
  },
  teamChip: {
    paddingHorizontal: 9,
    height: 26,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  teamLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
