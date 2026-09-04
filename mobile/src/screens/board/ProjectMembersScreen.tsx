import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Avatar, Badge, Button, EmptyState, Input, Screen, Sheet } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { ProjectRole } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectMembers'>;

export function ProjectMembersScreen({ route }: Props) {
  const { projectId } = route.params;
  const colors = useColors();
  const toast = useToast();
  const { getProject, isProjectAdmin, addMember, removeMember, updateMemberRole } = useWorkspace();

  const project = getProject(projectId);
  const isAdmin = isProjectAdmin(projectId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const [submitting, setSubmitting] = useState(false);

  if (!project) {
    return (
      <Screen>
        <AppHeader title="Members" showBack />
        <EmptyState icon="alert-circle-outline" title="Project not found" />
      </Screen>
    );
  }

  const handleInvite = async () => {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addMember(projectId, { email: email.trim(), name: name.trim() || undefined, role });
      setEmail('');
      setName('');
      setInviteOpen(false);
      toast.success('Invite sent. They must Accept before they can see the board.');
    } catch (error) {
      toast.fromError(error, 'Could not add the member.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = (memberId: string, memberName: string) => {
    Alert.alert(
      'Remove member',
      `Remove ${memberName} from ${project.name}? Their tasks will move to the backlog (unassigned).`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(projectId, memberId);
            toast.success(`${memberName} removed`);
          } catch (error) {
            toast.fromError(error, 'Could not remove the member.');
          }
        },
      },
    ]);
  };

  const toggleRole = async (memberId: string, current: ProjectRole) => {
    const next: ProjectRole = current === 'admin' ? 'member' : 'admin';
    try {
      await updateMemberRole(projectId, memberId, next);
      toast.success(`Role changed to ${next}`);
    } catch (error) {
      toast.fromError(error, 'Could not change the role.');
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Members"
        subtitle={`${project.name} · ${project.members.length}`}
        showBack
        actions={
          isAdmin
            ? [{ icon: 'person-add-outline', onPress: () => setInviteOpen(true), accessibilityLabel: 'Invite member' }]
            : []
        }
      />

      <FlatList
        data={project.members}
        keyExtractor={(member) => member.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No members yet"
            description="Invite teammates so they can pick up work on this board."
            actionLabel={isAdmin ? 'Invite someone' : undefined}
            onAction={isAdmin ? () => setInviteOpen(true) : undefined}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Avatar name={item.name || item.email} uri={item.avatarUrl} size={42} />

            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name || item.email}
              </Text>
              <Text style={[styles.email, { color: colors.textSubtle }]} numberOfLines={1}>
                {item.email}
              </Text>
              <View style={styles.badges}>
                <Badge label={item.role} color={item.role === 'admin' ? colors.brand : colors.textSubtle} />
                {item.status === 'pending' ? <Badge label="Pending" color={colors.warning} /> : null}
                <Text style={[styles.added, { color: colors.textSubtle }]}>Joined {formatDate(item.addedAt)}</Text>
              </View>
            </View>

            {isAdmin ? (
              <View style={styles.actions}>
                <Pressable onPress={() => toggleRole(item.id, item.role)} hitSlop={8}>
                  <Ionicons
                    name={item.role === 'admin' ? 'shield-checkmark' : 'shield-outline'}
                    size={19}
                    color={item.role === 'admin' ? colors.brand : colors.textSubtle}
                  />
                </Pressable>
                <Pressable onPress={() => confirmRemove(item.id, item.name || item.email)} hitSlop={8}>
                  <Ionicons name="person-remove-outline" size={19} color={colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      />

      <Sheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite to project"
        subtitle="They stay Pending until they Accept. They cannot see the board until then."
      >
        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="teammate@company.com"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Name (optional)"
            placeholder="Teammate name"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <View>
            <Text style={[styles.formLabel, { color: colors.textMuted }]}>Role</Text>
            <View style={styles.roleRow}>
              {(['member', 'admin'] as ProjectRole[]).map((option) => {
                const active = role === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setRole(option)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: active ? colors.brandSoft : colors.surfaceAlt,
                        borderColor: active ? colors.brandBorder : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.roleText, { color: active ? colors.brand : colors.textMuted }]}>
                      {option === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button
            label="Send invite"
            onPress={handleInvite}
            loading={submitting}
            disabled={!email.trim()}
            fullWidth
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  info: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  email: {
    fontSize: 12,
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  added: {
    fontSize: 11,
  },
  actions: {
    gap: 14,
    alignItems: 'center',
  },
  form: {
    gap: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
