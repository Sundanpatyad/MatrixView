import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Avatar, Button, EmptyState, Input, Screen, Sheet } from '@/components/ui';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { ProjectTeam } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageTeams'>;

export function ManageTeamsScreen({ route }: Props) {
  const { projectId } = route.params;
  const colors = useColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { getProject, teamsForProject, isProjectAdmin, createTeam, updateTeam, deleteTeam, tasks } = useWorkspace();

  const project = getProject(projectId);
  const teams = teamsForProject(projectId);
  const isAdmin = isProjectAdmin(projectId);

  const [editing, setEditing] = useState<ProjectTeam | null>(null);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tasks
      .filter((task) => task.projectId === projectId && task.teamId)
      .forEach((task) => counts.set(task.teamId!, (counts.get(task.teamId!) ?? 0) + 1));
    return counts;
  }, [projectId, tasks]);

  if (!project) {
    return (
      <Screen>
        <AppHeader title="Teams" showBack />
        <EmptyState icon="alert-circle-outline" title="Project not found" />
      </Screen>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setTeamName('');
    setMemberQuery('');
    setSelected([]);
    setCreating(true);
  };

  const openEdit = (team: ProjectTeam) => {
    setEditing(team);
    setTeamName(team.name);
    setMemberQuery('');
    setSelected(team.memberIds);
    setCreating(true);
  };

  const toggleMember = (memberId: string) => {
    setSelected((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const handleSave = async () => {
    if (!teamName.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateTeam(editing.id, { name: teamName.trim(), memberIds: selected });
        toast.success('Team updated');
      } else {
        await createTeam(projectId, { name: teamName.trim(), memberIds: selected });
        toast.success('Team created');
      }
      setCreating(false);
    } catch (error) {
      toast.fromError(error, 'Could not save the team.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (team: ProjectTeam) => {
    const ok = await confirm({
      title: 'Delete team',
      message: `Delete ${team.name}? Tasks stay on the board.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTeam(team.id);
      toast.success('Team deleted');
    } catch (error) {
      toast.fromError(error, 'Could not delete the team.');
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Teams"
        subtitle={project.name}
        showBack
        actions={isAdmin ? [{ icon: 'add', onPress: openCreate, accessibilityLabel: 'Create team' }] : []}
      />

      <FlatList
        data={teams}
        keyExtractor={(team) => team.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="git-branch-outline"
            title="No teams yet"
            description="Group members into teams to filter the board by squad."
            actionLabel={isAdmin ? 'Create team' : undefined}
            onAction={isAdmin ? openCreate : undefined}
          />
        }
        renderItem={({ item }) => {
          const members = project.members.filter((member) => item.memberIds.includes(member.id));
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <View style={styles.flex}>
                  <Text style={[styles.teamName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.teamMeta, { color: colors.textSubtle }]}>
                    {members.length} members · {taskCounts.get(item.id) ?? 0} tasks
                  </Text>
                </View>

                {isAdmin ? (
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                      <Ionicons name="create-outline" size={19} color={colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => void confirmDelete(item)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={19} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {members.length > 0 ? (
                <View style={styles.avatars}>
                  {members.slice(0, 8).map((member) => (
                    <View key={member.id} style={styles.avatarWrap}>
                      <Avatar name={member.name || member.email} uri={member.avatarUrl} size={28} userId={member.userId || member.id} />
                    </View>
                  ))}
                  {members.length > 8 ? (
                    <Text style={[styles.more, { color: colors.textSubtle }]}>+{members.length - 8}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <Sheet
        visible={creating}
        onClose={() => setCreating(false)}
        title={editing ? 'Edit team' : 'New team'}
        subtitle="Pick the project members who belong to this team."
      >
        <Input label="Team name" placeholder="Platform squad" value={teamName} onChangeText={setTeamName} />

        <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Members</Text>
        <Input
          placeholder="Search members"
          icon="search-outline"
          value={memberQuery}
          onChangeText={setMemberQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.memberList}>
          {project.members
            .filter((member) => {
              const term = memberQuery.trim().toLowerCase();
              if (!term) return true;
              return (
                (member.name || '').toLowerCase().includes(term) || member.email.toLowerCase().includes(term)
              );
            })
            .map((member) => {
            const active = selected.includes(member.id);
            return (
              <Pressable
                key={member.id}
                onPress={() => toggleMember(member.id)}
                style={[
                  styles.memberRow,
                  {
                    backgroundColor: active ? colors.brandSoft : colors.surfaceAlt,
                    borderColor: active ? colors.brandBorder : colors.border,
                  },
                ]}
              >
                <Avatar name={member.name || member.email} uri={member.avatarUrl} size={30} userId={member.userId || member.id} />
                <View style={styles.flex}>
                  <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                    {member.name || member.email}
                  </Text>
                  <Text style={[styles.memberEmail, { color: colors.textSubtle }]} numberOfLines={1}>
                    {member.email}
                  </Text>
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={21}
                  color={active ? colors.brand : colors.textSubtle}
                />
              </Pressable>
            );
          })}
        </View>

        <Button
          label={editing ? 'Save changes' : 'Create team'}
          onPress={handleSave}
          loading={submitting}
          disabled={!teamName.trim()}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
  },
  teamMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 14,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    marginRight: -8,
  },
  more: {
    fontSize: 12,
    marginLeft: 14,
    fontWeight: '600',
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 11.5,
    marginTop: 1,
  },
});
