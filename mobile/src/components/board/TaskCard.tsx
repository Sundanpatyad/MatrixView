import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { formatShortDate, isOverdue, titleCase } from '@/lib/format';
import type { BoardTask } from '@/lib/api';
import { priorityColor, radius, taskTypeColor, useColors } from '@/theme';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  task: 'checkbox-outline',
  bug: 'bug-outline',
  story: 'bookmark-outline',
  time: 'time-outline',
};

interface TaskCardProps {
  task: BoardTask;
  onPress: () => void;
  projectName?: string;
  compact?: boolean;
}

export function TaskCard({ task, onPress, projectName, compact = false }: TaskCardProps) {
  const colors = useColors();
  const typeColor = taskTypeColor[task.type] ?? colors.brand;
  const overdue = isOverdue(task.dueDate) && task.status !== 'done';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.typeChip, { backgroundColor: `${typeColor}22` }]}>
          <Ionicons name={TYPE_ICON[task.type] ?? 'ellipse-outline'} size={12} color={typeColor} />
          <Text style={[styles.key, { color: typeColor }]}>{task.key}</Text>
        </View>

        <View style={styles.spacer} />

        <View style={[styles.priorityDot, { backgroundColor: priorityColor[task.priority] ?? colors.textSubtle }]} />
        <Text style={[styles.priorityText, { color: colors.textSubtle }]}>{titleCase(task.priority)}</Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={compact ? 1 : 2}>
        {task.title}
      </Text>

      {!compact && task.labels.length > 0 ? (
        <View style={styles.labels}>
          {task.labels.slice(0, 3).map((label) => (
            <View key={label} style={[styles.label, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.labelText, { color: colors.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        {task.assigneeName ? (
          <Avatar name={task.assigneeName} size={22} />
        ) : (
          <View style={[styles.unassigned, { borderColor: colors.borderStrong }]}>
            <Ionicons name="person-outline" size={11} color={colors.textSubtle} />
          </View>
        )}

        <Text style={[styles.assignee, { color: colors.textSubtle }]} numberOfLines={1}>
          {task.assigneeName || 'Unassigned'}
        </Text>

        <View style={styles.spacer} />

        {projectName ? (
          <Text style={[styles.meta, { color: colors.textSubtle }]} numberOfLines={1}>
            {projectName}
          </Text>
        ) : null}

        {task.comments.length > 0 ? (
          <View style={styles.metaGroup}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textSubtle} />
            <Text style={[styles.meta, { color: colors.textSubtle }]}>{task.comments.length}</Text>
          </View>
        ) : null}

        {task.attachments.length > 0 ? (
          <View style={styles.metaGroup}>
            <Ionicons name="attach-outline" size={13} color={colors.textSubtle} />
            <Text style={[styles.meta, { color: colors.textSubtle }]}>{task.attachments.length}</Text>
          </View>
        ) : null}

        {task.dueDate ? (
          <View style={styles.metaGroup}>
            <Ionicons name="calendar-outline" size={12} color={overdue ? colors.danger : colors.textSubtle} />
            <Text style={[styles.meta, { color: overdue ? colors.danger : colors.textSubtle }]}>
              {formatShortDate(task.dueDate)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
    gap: 9,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm - 2,
  },
  key: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  spacer: { flex: 1 },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  label: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  labelText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  unassigned: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignee: {
    fontSize: 11.5,
    maxWidth: 110,
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
  },
});
