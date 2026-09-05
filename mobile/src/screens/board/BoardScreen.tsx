import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

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
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { BoardTask, ProjectPhase, ProjectSprint } from '@/lib/api';
import { formatDate, toIsoDate } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, resolveAccentColor, statusAccent, tintColor, useColors, useTheme } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sprintsForSwitcher(phases: ProjectPhase[], sprints: ProjectSprint[]) {
  const ordered: ProjectSprint[] = [];
  const seen = new Set<string>();
  for (const sprint of sprints.filter((item) => !item.phaseId)) {
    ordered.push(sprint);
    seen.add(sprint.id);
  }
  for (const phase of phases) {
    for (const sprint of sprints.filter((item) => item.phaseId === phase.id)) {
      ordered.push(sprint);
      seen.add(sprint.id);
    }
  }
  for (const sprint of sprints) {
    if (!seen.has(sprint.id)) ordered.push(sprint);
  }
  return ordered;
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
    phasesForProject,
    sprintsForProject,
    addColumn,
    startSprint,
    extendSprint,
    completeSprint,
    boardSprintId,
    setBoardSprintId,
  } = useWorkspace();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [projectSheet, setProjectSheet] = useState(false);
  const [moveTarget, setMoveTarget] = useState<BoardTask | null>(null);
  const [columnSheet, setColumnSheet] = useState(false);
  const [newColumn, setNewColumn] = useState('');
  const [savingColumn, setSavingColumn] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [boardSheet, setBoardSheet] = useState(false);
  const [moreSheet, setMoreSheet] = useState(false);
  const [peopleSheet, setPeopleSheet] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [pickingExtend, setPickingExtend] = useState(false);
  const [extendDraft, setExtendDraft] = useState(new Date());

  // The board always needs a concrete project, unlike the dashboard's "all" view.
  const project = useMemo(() => {
    if (activeProjectId !== 'all') {
      const match = projects.find((entry) => entry.id === activeProjectId);
      if (match) return match;
    }
    return projects[0] ?? null;
  }, [activeProjectId, projects]);

  const teams = project ? teamsForProject(project.id) : [];
  const phases = project ? phasesForProject(project.id) : [];
  const sprints = project ? sprintsForProject(project.id) : [];
  const switcherSprints = sprintsForSwitcher(phases, sprints);
  const activeSprint = boardSprintId ? sprints.find((sprint) => sprint.id === boardSprintId) : undefined;
  const boardColumns = activeSprint?.columns ?? project?.columns ?? [];
  const isAdmin = project ? isProjectAdmin(project.id) : false;

  useEffect(() => {
    if (!project) return;
    setActiveColumn((current) => {
      if (current && boardColumns.some((column) => column.id === current)) return current;
      return boardColumns[0]?.id ?? null;
    });
    setTeamFilter(null);
    setAssigneeFilter([]);
  }, [project, activeSprint?.id]);

  useEffect(() => {
    if (boardSprintId && !sprints.some((sprint) => sprint.id === boardSprintId)) {
      setBoardSprintId(null);
    }
  }, [boardSprintId, sprints, setBoardSprintId]);

  const projectTasks = useMemo(
    () =>
      project
        ? tasks.filter((task) => {
            if (task.projectId !== project.id) return false;
            const sprintId = task.sprintId ?? null;
            if (activeSprint) return sprintId === activeSprint.id;
            return !sprintId;
          })
        : [],
    [project, tasks, activeSprint],
  );

  const countsByColumn = useMemo(() => {
    const counts = new Map<string, number>();
    projectTasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));
    return counts;
  }, [projectTasks]);

  const columnTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const members = project?.members ?? [];
    return projectTasks
      .filter((task) => task.status === activeColumn)
      .filter((task) => (teamFilter ? task.teamId === teamFilter : true))
      .filter((task) => {
        if (assigneeFilter.length === 0) return true;
        return assigneeFilter.some((token) => {
          if (token === 'unassigned') {
            const name = (task.assigneeName ?? '').trim().toLowerCase();
            return !task.assigneeId || !name || name === 'unassigned';
          }
          if (token === 'me') {
            return task.assigneeId === user?.id || task.assigneeName === user?.name;
          }
          const member = members.find((item) => item.id === token);
          if (!member) return false;
          return (
            task.assigneeId === member.id ||
            task.assigneeName.trim().toLowerCase() === member.name.trim().toLowerCase()
          );
        });
      })
      .filter((task) =>
        term
          ? task.title.toLowerCase().includes(term) ||
            task.key.toLowerCase().includes(term) ||
            task.assigneeName.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }, [activeColumn, projectTasks, search, teamFilter, assigneeFilter, project?.members, user]);

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
      await addColumn(project.id, newColumn.trim(), activeSprint?.id);
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

  const boardOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: 'backlog', label: 'Backlog', description: 'Unscheduled work', icon: 'file-tray-outline' },
      ...switcherSprints.map((sprint) => {
        const phase = phases.find((item) => item.id === sprint.phaseId);
        return {
          value: sprint.id,
          label: sprint.name,
          description: `${phase ? `${phase.name} · ` : 'No phase · '}${sprint.status}`,
          icon: 'calendar-outline' as const,
        };
      }),
    ],
    [phases, switcherSprints],
  );

  const moveOptions = useMemo<SheetOption<string>[]>(
    () =>
      (boardColumns).map((column) => ({
        value: column.id,
        label: column.label,
        color: resolveAccentColor(column.accent || statusAccent[column.id], colors.brand),
      })),
    [colors.brand, boardColumns],
  );

  function toggleAssignee(token: string) {
    if (token === 'everyone') {
      setAssigneeFilter([]);
      return;
    }
    setAssigneeFilter((prev) =>
      prev.includes(token) ? prev.filter((item) => item !== token) : [...prev, token],
    );
  }

  const peopleLabel = useMemo(() => {
    if (assigneeFilter.length === 0) return 'Everyone';
    const members = project?.members ?? [];
    const names = assigneeFilter.map((token) => {
      if (token === 'unassigned') return 'Unassigned';
      if (token === 'me') return 'Me';
      return members.find((member) => member.id === token)?.name.split(' ')[0] ?? 'Person';
    });
    return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
  }, [assigneeFilter, project?.members]);

  const moreOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: 'members', label: 'Members', icon: 'people-outline' },
      { value: 'teams', label: 'Teams', icon: 'git-branch-outline' },
      ...(isAdmin
        ? [
            { value: 'plan', label: 'Plan sprints', icon: 'calendar-outline' as const },
            { value: 'activity', label: 'Team activity', icon: 'pulse-outline' as const },
          ]
        : []),
    ],
    [isAdmin],
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
        subtitle={`${activeSprint ? activeSprint.name : 'Backlog'} · ${projectTasks.length} tasks`}
        onTitlePress={() => setProjectSheet(true)}
        actions={[
          {
            icon: 'albums-outline',
            onPress: () => setBoardSheet(true),
            accessibilityLabel: 'Switch board',
          },
          {
            icon: 'ellipsis-horizontal',
            onPress: () => setMoreSheet(true),
            accessibilityLabel: 'More',
          },
        ]}
      />

      <View style={styles.controls}>
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setPeopleSheet(true)}
            style={[
              styles.filterChip,
              {
                backgroundColor: assigneeFilter.length ? colors.brandSoft : colors.surfaceAlt,
                borderColor: assigneeFilter.length ? colors.brandBorder : colors.border,
              },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={14}
              color={assigneeFilter.length ? colors.brand : colors.textSubtle}
            />
            <Text
              style={[styles.filterChipLabel, { color: assigneeFilter.length ? colors.brand : colors.text }]}
              numberOfLines={1}
            >
              {peopleLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSubtle} />
          </Pressable>
        </View>

        <Input
          placeholder="Search tasks, keys or people"
          icon="search-outline"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />

        <FlatList
          data={boardColumns}
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
            const accent = resolveAccentColor(item.accent || statusAccent[item.id], colors.brand);
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
                    { backgroundColor: active ? tintColor(accent, 0.16) : colors.track },
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

      {activeSprint ? (
        <View style={[styles.sprintBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.sprintName, { color: colors.text }]} numberOfLines={1}>
            {activeSprint.name}
          </Text>
          <Text style={[styles.sprintMeta, { color: colors.textSubtle }]} numberOfLines={1}>
            {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)} · {activeSprint.status}
          </Text>
          {isAdmin && activeSprint.status !== 'done' ? (
            <View style={styles.sprintActions}>
              {activeSprint.status === 'planned' ? (
                <Pressable
                  onPress={() =>
                    void startSprint(project.id, activeSprint.id).catch((error) =>
                      toast.fromError(error, 'Could not start the sprint.'),
                    )
                  }
                  style={[styles.sprintLink, { borderColor: colors.border }]}
                >
                  <Text style={[styles.sprintLinkText, { color: colors.text }]}>Start</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  setExtendDraft(addDays(new Date(`${activeSprint.endDate}T12:00:00`), 7));
                  setPickingExtend(true);
                }}
                style={[styles.sprintLink, { borderColor: colors.border }]}
              >
                <Text style={[styles.sprintLinkText, { color: colors.text }]}>Extend</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void completeSprint(project.id, activeSprint.id).catch((error) =>
                    toast.fromError(error, 'Could not complete the sprint.'),
                  )
                }
                style={[styles.sprintLink, { borderColor: colors.border }]}
              >
                <Text style={[styles.sprintLinkText, { color: colors.danger }]}>Complete</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={columnTasks}
        keyExtractor={(task) => task.id}
        contentInsetAdjustmentBehavior="never"
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
              navigation.navigate('CreateTask', {
                projectId: project.id,
                status: activeColumn ?? undefined,
                sprintId: activeSprint?.id,
              })
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
          navigation.navigate('CreateTask', {
            projectId: project.id,
            status: activeColumn ?? undefined,
            sprintId: activeSprint?.id,
          })
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
        visible={moreSheet}
        onClose={() => setMoreSheet(false)}
        title="More"
        options={moreOptions}
        onSelect={(value) => {
          if (value === 'members') navigation.navigate('ProjectMembers', { projectId: project.id });
          else if (value === 'teams') navigation.navigate('ManageTeams', { projectId: project.id });
          else if (value === 'plan') navigation.navigate('ManageSprints', { projectId: project.id });
          else if (value === 'activity') navigation.navigate('TeamActivity', { projectId: project.id });
        }}
      />

      <Sheet visible={peopleSheet} onClose={() => setPeopleSheet(false)} title="Assigned to">
        {[
          { value: 'everyone', label: 'Everyone' },
          { value: 'me', label: 'Assigned to me' },
          { value: 'unassigned', label: 'Unassigned' },
          ...(project.members ?? [])
            .filter((member) => member.status !== 'pending')
            .map((member) => ({
              value: member.id,
              label: member.id === user?.id || member.name === user?.name ? `${member.name} (you)` : member.name,
            })),
        ].map((option) => {
          const checked =
            option.value === 'everyone' ? assigneeFilter.length === 0 : assigneeFilter.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleAssignee(option.value)}
              style={[
                styles.peopleRow,
                {
                  backgroundColor: checked ? colors.brandSoft : colors.surfaceAlt,
                  borderColor: checked ? colors.brandBorder : 'transparent',
                },
              ]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={20}
                color={checked ? colors.brand : colors.textSubtle}
              />
              <Text style={[styles.peopleLabel, { color: colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </Sheet>

      <OptionSheet
        visible={boardSheet}
        onClose={() => setBoardSheet(false)}
        title="Board"
        options={boardOptions}
        value={boardSprintId ?? 'backlog'}
        onSelect={(value) => setBoardSprintId(value === 'backlog' ? null : value)}
      />

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

      {pickingExtend && Platform.OS === 'android' ? (
        <DateTimePicker
          value={extendDraft}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setPickingExtend(false);
            if (event.type === 'set' && date && activeSprint) {
              void extendSprint(project.id, activeSprint.id, toIsoDate(date)).catch((error) =>
                toast.fromError(error, 'Could not extend the sprint.'),
              );
            }
          }}
        />
      ) : null}

      <Sheet
        visible={pickingExtend && Platform.OS === 'ios'}
        onClose={() => setPickingExtend(false)}
        title="Extend sprint"
        scrollable={false}
      >
        <DateTimePicker
          value={extendDraft}
          mode="date"
          display="spinner"
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_, date) => {
            if (date) setExtendDraft(date);
          }}
        />
        <Button
          label="Save new end date"
          onPress={() => {
            if (!activeSprint) return;
            const sprint = activeSprint;
            setPickingExtend(false);
            void extendSprint(project.id, sprint.id, toIsoDate(extendDraft)).catch((error) =>
              toast.fromError(error, 'Could not extend the sprint.'),
            );
          }}
          fullWidth
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '72%',
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  peopleLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
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
  sprintBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  sprintName: {
    fontSize: 13,
    fontWeight: '700',
  },
  sprintMeta: {
    fontSize: 11,
  },
  sprintActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  sprintLink: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sprintLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    paddingTop: 8,
    gap: 10,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
