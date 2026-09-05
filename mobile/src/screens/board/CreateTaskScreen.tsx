import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Button, Input, KeyboardAware, OptionSheet, Sheet, type SheetOption, Screen } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { TaskPriority, TaskType } from '@/lib/api';
import { formatDate, titleCase, toIsoDate } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { priorityColor, radius, taskTypeColor, useColors, useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTask'>;

const TYPES: TaskType[] = ['task', 'bug', 'story', 'time'];
const PRIORITIES: TaskPriority[] = ['lowest', 'low', 'medium', 'high', 'highest'];
const MAX_ESTIMATE_HOURS = 1000;

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Build a Date whose time components represent a duration (for countdown / time pickers). */
function dateFromEstimateHours(hours: number): Date {
  const clamped = Math.max(0, Math.min(MAX_ESTIMATE_HOURS, hours));
  const totalMinutes = Math.round(clamped * 60);
  const date = new Date(0);
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return date;
}

function estimateHoursFromDate(date: Date): number {
  return Math.round((date.getHours() + date.getMinutes() / 60) * 100) / 100;
}

function formatEstimateHours(hours: number | null): string {
  if (hours == null) return 'Not set';
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (whole === 0 && minutes === 0) return '0h';
  if (minutes === 0) return `${whole}h`;
  if (whole === 0) return `${minutes}m`;
  return `${whole}h ${minutes}m`;
}

function validateEstimateHours(hours: number | null): string | null {
  if (hours == null) return null;
  if (!Number.isFinite(hours)) return 'Estimate must be a valid number.';
  if (hours < 0) return 'Estimate cannot be negative.';
  if (hours > MAX_ESTIMATE_HOURS) return `Estimate cannot exceed ${MAX_ESTIMATE_HOURS} hours.`;
  return null;
}

function validateDueDate(date: Date | null): string | null {
  if (!date) return null;
  if (Number.isNaN(date.getTime())) return 'Due date is invalid.';
  if (date.getTime() < startOfToday().getTime()) return 'Due date cannot be in the past.';
  return null;
}

export function CreateTaskScreen({ route, navigation }: Props) {
  const { projectId, status, sprintId } = route.params;
  const { isDark } = useTheme();
  const toast = useToast();
  const { getProject, createTask, updateTask, teamsForProject } = useWorkspace();

  const project = getProject(projectId);
  const teams = teamsForProject(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [estimateHours, setEstimateHours] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);

  const [typeSheet, setTypeSheet] = useState(false);
  const [prioritySheet, setPrioritySheet] = useState(false);
  const [assigneeSheet, setAssigneeSheet] = useState(false);
  const [teamSheet, setTeamSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHoursPicker, setShowHoursPicker] = useState(false);
  const [draftDate, setDraftDate] = useState(() => startOfToday());
  const [draftHours, setDraftHours] = useState(() => dateFromEstimateHours(1));
  const [submitting, setSubmitting] = useState(false);

  const assignee = project?.members.find((member) => member.id === assigneeId);
  const team = teams.find((entry) => entry.id === teamId);

  const typeOptions = useMemo<SheetOption<TaskType>[]>(
    () => TYPES.map((value) => ({ value, label: titleCase(value), color: taskTypeColor[value] })),
    [],
  );

  const priorityOptions = useMemo<SheetOption<TaskPriority>[]>(
    () => PRIORITIES.map((value) => ({ value, label: titleCase(value), color: priorityColor[value] })),
    [],
  );

  const assigneeOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: '', label: 'Unassigned', icon: 'person-outline' },
      ...(project?.members ?? []).map((member) => ({
        value: member.id,
        label: member.name || member.email,
        description: member.email,
      })),
    ],
    [project],
  );

  const teamOptions = useMemo<SheetOption<string>[]>(
    () => [
      { value: '', label: 'No team', icon: 'remove-circle-outline' },
      ...teams.map((entry) => ({
        value: entry.id,
        label: entry.name,
        description: `${entry.memberIds.length} members`,
      })),
    ],
    [teams],
  );

  const openDatePicker = () => {
    setDraftDate(dueDate ?? startOfToday());
    setShowDatePicker(true);
  };

  const openHoursPicker = () => {
    setDraftHours(dateFromEstimateHours(estimateHours ?? 1));
    setShowHoursPicker(true);
  };

  const commitDate = (date: Date) => {
    const error = validateDueDate(date);
    if (error) {
      toast.error(error);
      return;
    }
    setDueDate(date);
    setShowDatePicker(false);
  };

  const commitHours = (date: Date) => {
    const hours = estimateHoursFromDate(date);
    const error = validateEstimateHours(hours);
    if (error) {
      toast.error(error);
      return;
    }
    setEstimateHours(hours);
    setShowHoursPicker(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;

    const dueError = validateDueDate(dueDate);
    if (dueError) {
      toast.error(dueError);
      return;
    }

    const hoursError = validateEstimateHours(estimateHours);
    if (hoursError) {
      toast.error(hoursError);
      return;
    }

    setSubmitting(true);
    try {
      const task = await createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        assigneeId: assigneeId || undefined,
        assigneeName: assignee?.name || undefined,
        estimateHours: estimateHours ?? undefined,
        dueDate: dueDate ? toIsoDate(dueDate) : undefined,
        teamId: teamId ?? undefined,
        sprintId: sprintId ?? undefined,
      });

      // The API always drops new tasks in the first column, so honour the
      // column the user actually opened the composer from.
      if (status && status !== task.status) {
        await updateTask(task.id, { status });
      }

      toast.success(`${task.key} created`);
      navigation.goBack();
    } catch (error) {
      toast.fromError(error, 'Could not create the task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="New task" subtitle={project?.name} showBack />

      <KeyboardAware>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Title"
            placeholder="What needs to be done?"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <Input
            label="Description"
            placeholder="Add context, acceptance criteria, links…"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.row}>
            <FieldButton
              flex
              label="Type"
              value={titleCase(type)}
              color={taskTypeColor[type]}
              onPress={() => setTypeSheet(true)}
            />
            <FieldButton
              flex
              label="Priority"
              value={titleCase(priority)}
              color={priorityColor[priority]}
              onPress={() => setPrioritySheet(true)}
            />
          </View>

          <FieldButton
            label="Assignee"
            value={assignee?.name ?? 'Unassigned'}
            icon="person-outline"
            onPress={() => setAssigneeSheet(true)}
          />

          {teams.length > 0 ? (
            <FieldButton
              label="Team"
              value={team?.name ?? 'No team'}
              icon="git-branch-outline"
              onPress={() => setTeamSheet(true)}
            />
          ) : null}

          <FieldButton
            label="Due date"
            value={dueDate ? formatDate(dueDate.toISOString()) : 'Not set'}
            icon="calendar-outline"
            onPress={openDatePicker}
            onClear={dueDate ? () => setDueDate(null) : undefined}
          />

          <FieldButton
            label="Estimate (hours)"
            value={formatEstimateHours(estimateHours)}
            icon="time-outline"
            onPress={openHoursPicker}
            onClear={estimateHours != null ? () => setEstimateHours(null) : undefined}
          />

          <Button
            label="Create task"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!title.trim()}
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAware>

      {/* Android: system date dialog */}
      {showDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="default"
          minimumDate={startOfToday()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && date) commitDate(date);
          }}
        />
      ) : null}

      {/* iOS: native spinner wheels in a sheet (not the inline calendar) */}
      <Sheet
        visible={showDatePicker && Platform.OS === 'ios'}
        onClose={() => setShowDatePicker(false)}
        title="Due date"
        scrollable={false}
      >
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="spinner"
          themeVariant={isDark ? 'dark' : 'light'}
          minimumDate={startOfToday()}
          onChange={(_, date) => {
            if (date) setDraftDate(date);
          }}
          style={styles.iosPicker}
        />
        <Button label="Set due date" onPress={() => commitDate(draftDate)} fullWidth />
      </Sheet>

      {/* Android: native time picker used as duration (H:M → hours) */}
      {showHoursPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftHours}
          mode="time"
          display="default"
          is24Hour
          onChange={(event, date) => {
            setShowHoursPicker(false);
            if (event.type === 'set' && date) commitHours(date);
          }}
        />
      ) : null}

      {/* iOS: native countdown duration picker */}
      <Sheet
        visible={showHoursPicker && Platform.OS === 'ios'}
        onClose={() => setShowHoursPicker(false)}
        title="Estimate"
        subtitle="Hours and minutes"
        scrollable={false}
      >
        <DateTimePicker
          value={draftHours}
          mode="countdown"
          display="spinner"
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_, date) => {
            if (date) setDraftHours(date);
          }}
          style={styles.iosPicker}
        />
        <Button label="Set estimate" onPress={() => commitHours(draftHours)} fullWidth />
      </Sheet>

      <OptionSheet
        visible={typeSheet}
        onClose={() => setTypeSheet(false)}
        title="Task type"
        options={typeOptions}
        value={type}
        onSelect={setType}
      />
      <OptionSheet
        visible={prioritySheet}
        onClose={() => setPrioritySheet(false)}
        title="Priority"
        options={priorityOptions}
        value={priority}
        onSelect={setPriority}
      />
      <OptionSheet
        visible={assigneeSheet}
        onClose={() => setAssigneeSheet(false)}
        title="Assign to"
        options={assigneeOptions}
        value={assigneeId}
        onSelect={setAssigneeId}
      />
      <OptionSheet
        visible={teamSheet}
        onClose={() => setTeamSheet(false)}
        title="Team"
        options={teamOptions}
        value={teamId ?? ''}
        onSelect={(value) => setTeamId(value || null)}
      />
    </Screen>
  );
}

function FieldButton({
  label,
  value,
  onPress,
  icon,
  color,
  flex = false,
  onClear,
}: {
  label: string;
  value: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  flex?: boolean;
  onClear?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={flex ? styles.flex : undefined}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          pressed && { opacity: 0.8 },
        ]}
      >
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        {icon ? <Ionicons name={icon} size={17} color={colors.textSubtle} /> : null}
        <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
        {onClear ? (
          <Pressable onPress={onClear} hitSlop={10}>
            <Ionicons name="close-circle" size={17} color={colors.textSubtle} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  iosPicker: {
    alignSelf: 'stretch',
    height: 216,
  },
});
