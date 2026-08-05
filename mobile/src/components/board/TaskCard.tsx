import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { formatShortDate, isOverdue, titleCase } from '@/lib/format';
import type { BoardTask } from '@/lib/api';
import { priorityColor, radius, taskTypeColor, useColors, useTheme } from '@/theme';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  task: 'checkbox-outline',
  bug: 'bug-outline',
  story: 'bookmark-outline',
  time: 'time-outline',
};

function softFill(hex: string, isDark: boolean): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${isDark ? 0.22 : 0.12})`;
}

interface TaskCardProps {
  task: BoardTask;
  onPress: () => void;
  onMove?: () => void;
  projectName?: string;
  compact?: boolean;
}

export function TaskCard({ task, onPress, onMove, projectName, compact = false }: TaskCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
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
        <View style={[styles.typeChip, { backgroundColor: softFill(typeColor, isDark) }]}>
          <Ionicons name={TYPE_ICON[task.type] ?? 'ellipse-outline'} size={10} color={typeColor} />
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
            <View
              key={label}
              style={[
                styles.label,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : colors.surfaceSunken,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.labelText, { color: colors.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        {task.assigneeName ? (
          <Avatar name={task.assigneeName} size={20} />
        ) : (
          <View style={[styles.unassigned, { borderColor: colors.borderStrong }]}>
            <Ionicons name="person-outline" size={10} color={colors.textSubtle} />
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
            <Ionicons name="chatbubble-outline" size={11} color={colors.textSubtle} />
            <Text style={[styles.meta, { color: colors.textSubtle }]}>{task.comments.length}</Text>
          </View>
        ) : null}

        {task.attachments.length > 0 ? (
          <View style={styles.metaGroup}>
            <Ionicons name="attach-outline" size={12} color={colors.textSubtle} />
            <Text style={[styles.meta, { color: colors.textSubtle }]}>{task.attachments.length}</Text>
          </View>
        ) : null}

        {task.dueDate ? (
          <View style={styles.metaGroup}>
            <Ionicons name="calendar-outline" size={11} color={overdue ? colors.danger : colors.textSubtle} />
            <Text style={[styles.meta, { color: overdue ? colors.danger : colors.textSubtle }]}>
              {formatShortDate(task.dueDate)}
            </Text>
          </View>
        ) : null}

        {onMove ? (
          <Pressable
            onPress={onMove}
            hitSlop={8}
            style={[styles.moveButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            accessibilityLabel={`Move ${task.key}`}
          >
            <Ionicons name="swap-horizontal" size={13} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  key: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  spacer: { flex: 1, minWidth: 4 },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  label: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  unassigned: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignee: {
    fontSize: 11,
    flexShrink: 1,
    maxWidth: 96,
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  meta: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  moveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
    flexShrink: 0,
  },
});
