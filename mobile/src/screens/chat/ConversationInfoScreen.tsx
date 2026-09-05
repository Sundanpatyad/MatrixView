import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Avatar, Badge, Button, Card, EmptyState, Input, Screen, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/lib/format';
import { pickImages } from '@/lib/pickers';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ConversationInfo'>;

export function ConversationInfoScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const colors = useColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { conversations, users, presence, connected, renameGroup, setGroupAvatar, addMembers, removeMember } = useChat();

  const conversation = conversations.find((entry) => entry.id === conversationId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation?.rawName ?? conversation?.name ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addable = useMemo(
    () => users.filter((entry) => !conversation?.memberIds.includes(entry.id)),
    [conversation?.memberIds, users],
  );

  const filteredAddable = useMemo(() => {
    const term = memberQuery.trim().toLowerCase();
    if (!term) return addable;
    return addable.filter(
      (entry) =>
        entry.name.toLowerCase().includes(term) || entry.email.toLowerCase().includes(term),
    );
  }, [addable, memberQuery]);

  if (!conversation) {
    return (
      <Screen>
        <AppHeader title="Details" showBack />
        <EmptyState icon="alert-circle-outline" title="Conversation unavailable" />
      </Screen>
    );
  }

  const isGroup = conversation.type === 'group';
  const peer = isGroup ? undefined : conversation.members.find((member) => member.id !== user?.id);
  const title = isGroup ? conversation.name : peer?.name ?? conversation.name;
  const isCreator = conversation.createdBy === user?.id;

  const handleRename = async () => {
    if (!nameDraft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await renameGroup(conversationId, nameDraft.trim());
      setRenameOpen(false);
      toast.success('Group renamed');
    } catch (error) {
      toast.fromError(error, 'Could not rename the group.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvatar = async () => {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      await setGroupAvatar(conversationId, file);
      toast.success('Group photo updated');
    } catch (error) {
      toast.fromError(error, 'Could not update the photo.');
    }
  };

  const handleAdd = async () => {
    if (!selected.length || submitting) return;
    setSubmitting(true);
    try {
      await addMembers(conversationId, selected);
      setSelected([]);
      setAddOpen(false);
      toast.success('Members added');
    } catch (error) {
      toast.fromError(error, 'Could not add members.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = async (memberId: string, memberName: string) => {
    const leaving = memberId === user?.id;
    const ok = await confirm({
      title: leaving ? 'Leave group' : 'Remove member',
      message: leaving ? `Leave ${conversation.name}?` : `Remove ${memberName} from ${conversation.name}?`,
      confirmLabel: leaving ? 'Leave' : 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeMember(conversationId, memberId);
      if (leaving) navigation.navigate('Tabs', { screen: 'Chat' });
      else toast.success(`${memberName} removed`);
    } catch (error) {
      toast.fromError(error, 'Could not update members.');
    }
  };

  return (
    <Screen>
      <AppHeader title={isGroup ? 'Group info' : 'Contact info'} showBack />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Pressable onPress={isGroup ? handleAvatar : undefined}>
            <Avatar
              name={title}
              uri={isGroup ? conversation.avatarUrl : peer?.avatarUrl}
              size={96}
              square={isGroup}
              userId={isGroup ? undefined : peer?.id}
            />
            {isGroup ? (
              <View style={[styles.cameraBadge, { backgroundColor: colors.brand, borderColor: colors.bg }]}>
                <Ionicons name="camera" size={14} color="#ffffff" />
              </View>
            ) : null}
          </Pressable>

          <Text style={[styles.heroName, { color: colors.text }]}>{title}</Text>
          {isGroup ? (
            <Text style={[styles.heroMeta, { color: colors.textSubtle }]}>
              Group · {conversation.members.length} members · created {formatDate(conversation.createdAt)}
            </Text>
          ) : (
            <Text style={[styles.heroMeta, { color: colors.textSubtle }]}>{peer?.email}</Text>
          )}

          {isGroup && isCreator ? (
            <Button
              label="Rename group"
              variant="secondary"
              size="sm"
              icon="create-outline"
              onPress={() => {
                setNameDraft(conversation.rawName || conversation.name);
                setRenameOpen(true);
              }}
              style={{ marginTop: 12 }}
            />
          ) : null}
        </View>

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {isGroup ? `Members (${conversation.members.length})` : 'Details'}
            </Text>
            {isGroup ? (
              <Pressable onPress={() => setAddOpen(true)} hitSlop={8}>
                <Ionicons name="person-add-outline" size={19} color={colors.brand} />
              </Pressable>
            ) : null}
          </View>

          {conversation.members.map((member) => {
            const isSelf = member.id === user?.id;
            const online = isSelf
              ? connected
              : presence[member.id]?.online ?? false;
            return (
              <View key={member.id} style={styles.memberRow}>
                <Avatar name={member.name} uri={member.avatarUrl} size={40} userId={member.id} />
                <View style={styles.memberText}>
                  <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                    {member.name}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.memberEmail, { color: colors.textSubtle }]} numberOfLines={1}>
                    {online ? 'Online' : 'Offline'}
                  </Text>
                </View>

                {conversation.createdBy === member.id ? <Badge label="Owner" color={colors.brand} /> : null}

                {isGroup && (isCreator || isSelf) ? (
                  <Pressable onPress={() => void confirmRemove(member.id, member.name)} hitSlop={8}>
                    <Ionicons name={isSelf ? 'exit-outline' : 'close-circle-outline'} size={20} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </Card>
      </ScrollView>

      <Sheet visible={renameOpen} onClose={() => setRenameOpen(false)} title="Rename group">
        <Input label="Group name" value={nameDraft} onChangeText={setNameDraft} autoCapitalize="words" autoFocus />
        <Button
          label="Save"
          onPress={handleRename}
          loading={submitting}
          disabled={!nameDraft.trim()}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </Sheet>

      <Sheet
        visible={addOpen}
        onClose={() => {
          setAddOpen(false);
          setMemberQuery('');
        }}
        title="Add members"
        subtitle={`${selected.length} selected`}
      >
        {addable.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSubtle }]}>
            Everyone in your organisation is already in this group.
          </Text>
        ) : (
          <View style={styles.addList}>
            <Input
              placeholder="Search teammates"
              icon="search-outline"
              value={memberQuery}
              onChangeText={setMemberQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {filteredAddable.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSubtle }]}>No teammates match that search.</Text>
            ) : (
              filteredAddable.map((entry) => {
                const active = selected.includes(entry.id);
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() =>
                      setSelected((prev) =>
                        prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id],
                      )
                    }
                    style={[
                      styles.addRow,
                      {
                        backgroundColor: active ? colors.brandSoft : colors.surfaceAlt,
                        borderColor: active ? colors.brandBorder : colors.border,
                      },
                    ]}
                  >
                    <Avatar name={entry.name} uri={entry.avatarUrl} size={32} userId={entry.id} />
                    <View style={styles.memberText}>
                      <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      <Text style={[styles.memberEmail, { color: colors.textSubtle }]} numberOfLines={1}>
                        {entry.email}
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={21}
                      color={active ? colors.brand : colors.textSubtle}
                    />
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <Button
          label="Add to group"
          onPress={handleAdd}
          loading={submitting}
          disabled={!selected.length}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
    letterSpacing: -0.3,
  },
  heroMeta: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  memberText: { flex: 1 },
  memberName: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  addList: {
    gap: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
});
