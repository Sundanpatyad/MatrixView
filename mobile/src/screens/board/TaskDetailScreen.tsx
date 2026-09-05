import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppHeader,
  Avatar,
  presenceUserIdFromMembers,
  Badge,
  Card,
  EmptyState,
  KeyboardAware,
  OptionSheet,
  Screen,
  type SheetOption,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { PickedFile, TaskPriority } from '@/lib/api';
import { formatBytes, formatDate, formatRelative, isOverdue, titleCase } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { pickDocuments, pickImages } from '@/lib/pickers';
import type { RootStackParamList } from '@/navigation/types';
import {
  priorityColor,
  radius,
  resolveAccentColor,
  statusAccent,
  taskTypeColor,
  useColors,
} from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

const PRIORITIES: TaskPriority[] = ['lowest', 'low', 'medium', 'high', 'highest'];

export function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { getTask, getProject, updateTask, addComment, addTaskAttachments, removeTaskAttachment } = useWorkspace();

  const task = getTask(taskId);
  const project = task ? getProject(task.projectId) : undefined;

  const [statusSheet, setStatusSheet] = useState(false);
  const [prioritySheet, setPrioritySheet] = useState(false);
  const [assigneeSheet, setAssigneeSheet] = useState(false);
  const [comment, setComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PickedFile[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const statusOptions = useMemo<SheetOption<string>[]>(
    () =>
      (project?.columns ?? []).map((column) => ({
        value: column.id,
        label: column.label,
        color: resolveAccentColor(column.accent || statusAccent[column.id], colors.brand),
      })),
    [colors.brand, project],
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

  if (!task) {
    return (
      <Screen>
        <AppHeader title="Task" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Task not found"
          description="It may have been deleted or moved to another project."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const column = project?.columns.find((entry) => entry.id === task.status);
  const statusColor = resolveAccentColor(
    column?.accent || statusAccent[task.status],
    colors.brand,
  );
  const overdue = isOverdue(task.dueDate) && task.status !== 'done';

  const patch = async (input: Parameters<typeof updateTask>[1], success: string) => {
    try {
      await updateTask(task.id, input);
      toast.success(success);
    } catch (error) {
      toast.fromError(error, 'Could not update the task.');
    }
  };

  const attachFiles = async (picker: () => Promise<PickedFile[]>) => {
    try {
      const files = await picker();
      if (!files.length) return;
      setUploading(true);
      await addTaskAttachments(task.id, files);
      toast.success(files.length === 1 ? 'Attachment added' : `${files.length} attachments added`);
    } catch (error) {
      toast.fromError(error, 'Could not attach the file.');
    } finally {
      setUploading(false);
    }
  };

  const handleComment = async () => {
    if (!comment.trim() && pendingFiles.length === 0) return;
    setPosting(true);
    try {
      await addComment(task.id, comment.trim(), pendingFiles);
      setComment('');
      setPendingFiles([]);
    } catch (error) {
      toast.fromError(error, 'Could not post the comment.');
    } finally {
      setPosting(false);
    }
  };

  const openAttachment = (url?: string) => {
    const resolved = resolveMediaUrl(url);
    if (!resolved) return;
    Linking.openURL(resolved).catch(() => toast.error('Could not open this attachment.'));
  };

  return (
    <Screen>
      <AppHeader title={task.key} subtitle={project?.name} showBack />

      <KeyboardAware offset={8}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.text }]}>{task.title}</Text>

          <View style={styles.chipRow}>
            <Pressable onPress={() => setStatusSheet(true)}>
              <Badge label={column?.label ?? titleCase(task.status)} color={statusColor} solid dot />
            </Pressable>
            <Pressable onPress={() => setPrioritySheet(true)}>
              <Badge label={`${titleCase(task.priority)} priority`} color={priorityColor[task.priority]} />
            </Pressable>
            <Badge label={titleCase(task.type)} color={taskTypeColor[task.type]} />
          </View>

          <Card style={styles.card}>
            <DetailRow
              icon="person-outline"
              label="Assignee"
              value={task.assigneeName || 'Unassigned'}
              onPress={() => setAssigneeSheet(true)}
              leading={
                task.assigneeName ? (
                  <Avatar
                    name={task.assigneeName}
                    size={24}
                    userId={presenceUserIdFromMembers(project?.members ?? [], task.assigneeId)}
                  />
                ) : undefined
              }
            />
            <Divider />
            <DetailRow icon="person-circle-outline" label="Reporter" value={task.reporterName || task.createdByName} />
            <Divider />
            <DetailRow
              icon="calendar-outline"
              label="Due date"
              value={task.dueDate ? formatDate(task.dueDate) : 'Not set'}
              valueColor={overdue ? colors.danger : undefined}
            />
            <Divider />
            <DetailRow
              icon="time-outline"
              label="Hours"
              value={`${task.loggedHours || 0} logged / ${task.estimateHours || 0} estimated`}
            />
          </Card>

          {task.description ? (
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>{task.description}</Text>
            </Card>
          ) : null}

          {task.labels.length > 0 ? (
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Labels</Text>
              <View style={styles.chipRow}>
                {task.labels.map((label) => (
                  <Badge key={label} label={label} color={colors.textSubtle} />
                ))}
              </View>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Attachments {task.attachments.length ? `(${task.attachments.length})` : ''}
              </Text>
              <View style={styles.actionRow}>
                <Pressable onPress={() => attachFiles(pickImages)} hitSlop={8} disabled={uploading}>
                  <Ionicons name="image-outline" size={19} color={colors.brand} />
                </Pressable>
                <Pressable onPress={() => attachFiles(pickDocuments)} hitSlop={8} disabled={uploading}>
                  <Ionicons name="attach-outline" size={20} color={colors.brand} />
                </Pressable>
              </View>
            </View>

            {task.attachments.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textSubtle }]}>
                {uploading ? 'Uploading…' : 'No attachments yet.'}
              </Text>
            ) : (
              task.attachments.map((attachment) => (
                <Pressable
                  key={attachment.id}
                  onPress={() => openAttachment(attachment.url ?? attachment.dataUrl)}
                  style={[styles.attachment, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Ionicons name="document-outline" size={18} color={colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                      {attachment.name}
                    </Text>
                    <Text style={[styles.muted, { color: colors.textSubtle }]}>
                      {formatBytes(attachment.size)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      try {
                        await removeTaskAttachment(task.id, attachment.id);
                      } catch (error) {
                        toast.fromError(error, 'Could not remove the attachment.');
                      }
                    }}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={17} color={colors.textSubtle} />
                  </Pressable>
                </Pressable>
              ))
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Comments {task.comments.length ? `(${task.comments.length})` : ''}
            </Text>

            {task.comments.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textSubtle }]}>
                No comments yet. Start the discussion below.
              </Text>
            ) : (
              task.comments.map((entry) => (
                <View key={entry.id} style={styles.comment}>
                  <Avatar name={entry.authorName} uri={entry.authorAvatarUrl} size={30} userId={entry.authorId} />
                  <View style={styles.flex}>
                    <View style={styles.commentHead}>
                      <Text style={[styles.commentAuthor, { color: colors.text }]}>{entry.authorName}</Text>
                      <Text style={[styles.muted, { color: colors.textSubtle }]}>
                        {formatRelative(entry.createdAt)}
                      </Text>
                    </View>
                    {entry.body ? (
                      <Text style={[styles.body, { color: colors.textMuted }]}>{entry.body}</Text>
                    ) : null}
                    {entry.attachments.map((attachment) => (
                      <Pressable
                        key={attachment.id}
                        onPress={() => openAttachment(attachment.url ?? attachment.dataUrl)}
                        style={[styles.commentAttachment, { borderColor: colors.border }]}
                      >
                        <Ionicons name="attach-outline" size={14} color={colors.brand} />
                        <Text style={[styles.commentAttachmentText, { color: colors.brand }]} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>

        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.bgElevated,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {pendingFiles.length > 0 ? (
            <View style={styles.pendingRow}>
              <Text style={[styles.muted, { color: colors.textSubtle }]}>
                {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} attached
              </Text>
              <Pressable onPress={() => setPendingFiles([])} hitSlop={8}>
                <Text style={[styles.clear, { color: colors.danger }]}>Clear</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              onPress={async () => {
                try {
                  const files = await pickDocuments();
                  if (files.length) setPendingFiles((prev) => [...prev, ...files].slice(0, 10));
                } catch (error) {
                  toast.fromError(error);
                }
              }}
              hitSlop={8}
            >
              <Ionicons name="attach-outline" size={22} color={colors.textSubtle} />
            </Pressable>

            <TextInput
              style={[
                styles.commentInput,
                { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              placeholder="Write a comment…"
              placeholderTextColor={colors.textSubtle}
              value={comment}
              onChangeText={setComment}
              multiline
            />

            <Pressable
              onPress={handleComment}
              disabled={posting || (!comment.trim() && pendingFiles.length === 0)}
              style={[
                styles.send,
                {
                  backgroundColor:
                    comment.trim() || pendingFiles.length ? colors.brand : colors.surfaceHover,
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={19}
                color={comment.trim() || pendingFiles.length ? '#ffffff' : colors.textSubtle}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAware>

      <OptionSheet
        visible={statusSheet}
        onClose={() => setStatusSheet(false)}
        title="Change status"
        options={statusOptions}
        value={task.status}
        onSelect={(status) => patch({ status }, 'Status updated')}
      />

      <OptionSheet
        visible={prioritySheet}
        onClose={() => setPrioritySheet(false)}
        title="Change priority"
        options={priorityOptions}
        value={task.priority}
        onSelect={(priority) => patch({ priority }, 'Priority updated')}
      />

      <OptionSheet
        visible={assigneeSheet}
        onClose={() => setAssigneeSheet(false)}
        title="Assign task"
        options={assigneeOptions}
        value={task.assigneeId}
        onSelect={(memberId) => {
          const member = project?.members.find((entry) => entry.id === memberId);
          patch(
            { assigneeId: memberId, assigneeName: member?.name ?? '' },
            member ? `Assigned to ${member.name}` : 'Assignee cleared',
          );
        }}
      />
    </Screen>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onPress,
  valueColor,
  leading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  valueColor?: string;
  leading?: React.ReactNode;
}) {
  const colors = useColors();
  const content = (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={17} color={colors.textSubtle} />
      <Text style={[styles.detailLabel, { color: colors.textSubtle }]}>{label}</Text>
      {leading}
      <Text style={[styles.detailValue, { color: valueColor ?? colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {content}
    </Pressable>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
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
  actionRow: {
    flexDirection: 'row',
    gap: 14,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  muted: {
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 13,
    flex: 1,
  },
  detailValue: {
    fontSize: 13.5,
    fontWeight: '600',
    maxWidth: '52%',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: '600',
  },
  comment: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  commentAuthor: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  commentAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  commentAttachmentText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 180,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  clear: {
    fontSize: 12,
    fontWeight: '700',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14.5,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
