import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Button, Input, OptionSheet, Screen, type SheetOption } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { TaskPriority, TaskType } from '@/lib/api';
import { formatDate, titleCase, toIsoDate } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { priorityColor, radius, taskTypeColor, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTask'>;

const TYPES: TaskType[] = ['task', 'bug', 'story', 'time'];
const PRIORITIES: TaskPriority[] = ['lowest', 'low', 'medium', 'high', 'highest'];

export function CreateTaskScreen({ route, navigation }: Props) {
  const { projectId, status } = route.params;
  const colors = useColors();
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
  const [estimate, setEstimate] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);

  const [typeSheet, setTypeSheet] = useState(false);
  const [prioritySheet, setPrioritySheet] = useState(false);
  const [assigneeSheet, setAssigneeSheet] = useState(false);
  const [teamSheet, setTeamSheet] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
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

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        assigneeId: assigneeId || undefined,
        assigneeName: assignee?.name || undefined,
        estimateHours: estimate ? Number(estimate) : undefined,
        dueDate: dueDate ? toIsoDate(dueDate) : undefined,
        teamId: teamId ?? undefined,
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

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
            onPress={() => setShowPicker(true)}
            onClear={dueDate ? () => setDueDate(null) : undefined}
          />

          <Input
            label="Estimate (hours)"
            placeholder="0"
            value={estimate}
            onChangeText={(value) => setEstimate(value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
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
      </KeyboardAvoidingView>

      {showPicker ? (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (event.type === 'set' && date) setDueDate(date);
          }}
        />
      ) : null}

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
});
